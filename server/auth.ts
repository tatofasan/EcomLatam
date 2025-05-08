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
        
        // Verificar si el usuario existe y la contraseña es correcta
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Usuario o contraseña incorrectos" });
        }
        
        // Verificar estado del usuario
        if (user.status === 'email_verification') {
          return done(null, false, { message: "Por favor, verifica tu correo electrónico para activar tu cuenta" });
        }
        
        if (user.status === 'pending') {
          return done(null, false, { message: "Tu cuenta está pendiente de aprobación por un administrador" });
        }
        
        if (user.status === 'inactive') {
          return done(null, false, { message: "Tu cuenta está inactiva. Contacta con soporte." });
        }

        // Si todo está bien, actualizar última fecha de login
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
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Verificar si el usuario ya existe
      try {
        const existingUser = await storage.getUserByUsername(req.body.username);
        if (existingUser) {
          return res.status(400).json({ message: "El nombre de usuario ya existe" });
        }
      } catch (err) {
        console.error("Error al verificar usuario existente:", err);
        return res.status(500).json({ message: "Error al verificar disponibilidad de usuario" });
      }
      
      // Verificar si el email ya existe
      if (req.body.email) {
        try {
          const [userWithEmail] = await db
            .select()
            .from(users)
            .where(eq(users.email, req.body.email));
            
          if (userWithEmail) {
            return res.status(400).json({ message: "El correo electrónico ya está registrado" });
          }
        } catch (err) {
          console.error("Error al verificar email existente:", err);
          return res.status(500).json({ message: "Error al verificar disponibilidad de correo" });
        }
      }

      // Importar funciones necesarias
      const { createVerificationData } = await import('./verification');
      const { sendVerificationEmail } = await import('./email');
      
      // Generar datos de verificación
      const verificationData = createVerificationData();
      
      // Crear el usuario con estado inicial en verificación de email
      let user;
      try {
        const hashedPassword = await hashPassword(req.body.password);
        user = await storage.createUser({
          ...req.body,
          role: "user", // Siempre asignar rol de usuario normal
          password: hashedPassword,
          status: "email_verification",
          verificationToken: verificationData.token,
          verificationExpires: verificationData.expires,
          isEmailVerified: false
        });
      } catch (err) {
        console.error("Error al crear usuario:", err);
        return res.status(500).json({ 
          success: false, 
          message: "Error al crear usuario. Por favor, intenta nuevamente."
        });
      }

      // Enviar email de verificación
      if (req.body.email) {
        try {
          await sendVerificationEmail(req.body.email, verificationData.token);
          
          // Responder al cliente (sin iniciar sesión)
          return res.status(201).json({ 
            success: true, 
            message: "Usuario registrado. Por favor verifica tu correo electrónico."
          });
        } catch (emailError) {
          console.error("Error al enviar correo de verificación:", emailError);
          
          // Si hay error al enviar el correo, eliminamos el usuario
          try {
            await db.delete(users).where(eq(users.id, user.id));
          } catch (deleteErr) {
            console.error("Error al eliminar usuario tras fallo de email:", deleteErr);
          }
          
          return res.status(500).json({ 
            success: false, 
            message: "Error al enviar correo de verificación. Por favor, intenta nuevamente."
          });
        }
      }
      
      // En caso de que no se proporcione un email (no debería ocurrir por validación frontend)
      return res.status(400).json({ 
        success: false, 
        message: "El correo electrónico es obligatorio para el registro"
      });
    } catch (err) {
      console.error("Error en el registro:", err);
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    try {
      // Actualizar la fecha de último inicio de sesión
      const userId = req.user?.id;
      if (userId) {
        await storage.updateUser(userId, {
          lastLogin: new Date()
        });
        // Obtener el usuario actualizado
        const updatedUser = await storage.getUser(userId);
        res.status(200).json(updatedUser);
      } else {
        res.status(200).json(req.user);
      }
    } catch (error) {
      console.error("Error updating last login:", error);
      res.status(200).json(req.user);
    }
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
