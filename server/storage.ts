import { users, type User, type InsertUser } from "@shared/schema";
import { type Product, type InsertProduct } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private currentUserId: number;
  private currentProductId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.currentUserId = 1;
    this.currentProductId = 1;
    
    // Initialize with some demo products for the UI
    this.initializeProducts();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const newProduct: Product = { ...product, id };
    this.products.set(id, newProduct);
    return newProduct;
  }
  
  async updateProduct(id: number, updateData: InsertProduct): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    
    if (!existingProduct) {
      return undefined;
    }
    
    const updatedProduct: Product = { ...updateData, id };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    if (!this.products.has(id)) {
      return false;
    }
    
    return this.products.delete(id);
  }
  
  private initializeProducts() {
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
    
    demoProducts.forEach(product => {
      const id = this.currentProductId++;
      this.products.set(id, { ...product, id });
    });
  }
}

export const storage = new MemStorage();
