import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "ecomdrop-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        // Check if user exists and password is correct
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Check user status
        if (user.status === 'email_verification') {
          return done(null, false, { message: "Please verify your email to activate your account" });
        }
        
        if (user.status === 'pending') {
          return done(null, false, { message: "Your account is pending approval by an administrator" });
        }
        
        if (user.status === 'inactive') {
          return done(null, false, { message: "Your account is inactive. Please contact support." });
        }

        // If everything is ok, update last login date
        await storage.updateUser(user.id, { lastLogin: new Date() });
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      // If user doesn't exist (stale session), fail gracefully
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if user already exists
      try {
        const existingUser = await storage.getUserByUsername(req.body.username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      } catch (err) {
        console.error("Error checking existing user:", err);
        return res.status(500).json({ message: "Error checking username availability" });
      }
      
      // Check if email already exists
      if (req.body.email) {
        try {
          const [userWithEmail] = await db
            .select()
            .from(users)
            .where(eq(users.email, req.body.email));
            
          if (userWithEmail) {
            return res.status(400).json({ message: "Email is already registered" });
          }
        } catch (err) {
          console.error("Error checking existing email:", err);
          return res.status(500).json({ message: "Error checking email availability" });
        }
      }

      // Import necessary functions
      const { createVerificationData } = await import('./verification');
      const { sendVerificationEmail } = await import('./email');
      
      // Generate verification data
      const verificationData = createVerificationData();
      
      // Create user with initial email verification status
      let user;
      try {
        const hashedPassword = await hashPassword(req.body.password);
        user = await storage.createUser({
          ...req.body,
          role: "user", // Always assign normal user role
          password: hashedPassword,
          status: "email_verification",
          verificationToken: verificationData.token,
          verificationExpires: verificationData.expires,
          isEmailVerified: false
        });
      } catch (err) {
        console.error("Error creating user:", err);
        return res.status(500).json({ 
          success: false, 
          message: "Error creating user. Please try again."
        });
      }

      // Send verification email
      if (req.body.email) {
        try {
          await sendVerificationEmail(req.body.email, verificationData.token);
          
          // Respond to client (without logging in)
          return res.status(201).json({ 
            success: true, 
            message: "User registered. Please verify your email."
          });
        } catch (emailError) {
          console.error("Error sending verification email:", emailError);
          
          // If there's an error sending email, delete the user
          try {
            await db.delete(users).where(eq(users.id, user.id));
          } catch (deleteErr) {
            console.error("Error deleting user after email failure:", deleteErr);
          }
          
          return res.status(500).json({ 
            success: false, 
            message: "Error sending verification email. Please try again."
          });
        }
      }
      
      // In case no email is provided (shouldn't happen due to frontend validation)
      return res.status(400).json({ 
        success: false, 
        message: "Email is required for registration"
      });
    } catch (err) {
      console.error("Registration error:", err);
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({ message: "Error interno del servidor" });
      }
      
      if (!user) {
        console.log("Authentication failed:", info?.message || "Credenciales inválidas");
        return res.status(401).json({ message: info?.message || "Credenciales inválidas" });
      }
      
      req.logIn(user, async (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Error al iniciar sesión" });
        }
        
        try {
          // Actualizar la fecha de último inicio de sesión
          await storage.updateUser(user.id, {
            lastLogin: new Date()
          });
          
          // Obtener el usuario actualizado
          const updatedUser = await storage.getUser(user.id);
          res.status(200).json(updatedUser || user);
        } catch (error) {
          console.error("Error updating last login:", error);
          res.status(200).json(user);
        }
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
