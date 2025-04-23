import { users, type User, type InsertUser } from "@shared/schema";
import { products, type Product, type InsertProduct } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Initialize PostgreSQL session store
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db
      .insert(products)
      .values(product)
      .returning();
    return newProduct;
  }
  
  async updateProduct(id: number, updateData: InsertProduct): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    
    if (!product) {
      return undefined;
    }
    
    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();
    
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    
    if (!product) {
      return false;
    }
    
    await db
      .delete(products)
      .where(eq(products.id, id));
    
    return true;
  }

  // Function to seed demo products if needed
  async seedDemoProducts() {
    const existingProducts = await this.getAllProducts();
    if (existingProducts.length === 0) {
      const demoProducts: InsertProduct[] = [
        {
          name: "Wireless Headphones",
          description: "Premium Sound Quality",
          price: 89.99,
          stock: 45,
          status: "active",
          sku: "HD-100",
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=350&fit=crop"
        },
        {
          name: "Running Shoes",
          description: "Lightweight Sports Shoes",
          price: 129.99,
          stock: 28,
          status: "active",
          sku: "SH-200",
          imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=350&fit=crop"
        },
        {
          name: "Smart Watch",
          description: "Fitness Tracker Watch",
          price: 199.99,
          stock: 15,
          status: "active",
          sku: "SW-300",
          imageUrl: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&h=350&fit=crop"
        },
        {
          name: "Mechanical Keyboard",
          description: "RGB Gaming Keyboard",
          price: 79.99,
          stock: 5,
          status: "low",
          sku: "KB-400",
          imageUrl: "https://images.unsplash.com/photo-1585155770447-2f66e2a397b5?w=500&h=350&fit=crop"
        },
        {
          name: "Polaroid Camera",
          description: "Instant Photo Camera",
          price: 69.99,
          stock: 32,
          status: "active",
          sku: "CM-500",
          imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&h=350&fit=crop"
        },
        {
          name: "Designer Sneakers",
          description: "Urban Fashion Footwear",
          price: 149.99,
          stock: 0,
          status: "draft",
          sku: "SN-600",
          imageUrl: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=500&h=350&fit=crop"
        }
      ];
      
      for (const product of demoProducts) {
        await this.createProduct(product);
      }
    }
  }
}

export const storage = new DatabaseStorage();
