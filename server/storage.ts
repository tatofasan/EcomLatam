import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  connections, type Connection, type InsertConnection,
  transactions, type Transaction, type InsertTransaction
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Order methods
  getAllOrders(userId?: number): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder, userId: number): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  
  // Order Items methods
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  addOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  
  // Connection methods
  getUserConnections(userId: number): Promise<Connection[]>;
  getConnection(id: number): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection, userId: number): Promise<Connection>;
  updateConnectionStatus(id: number, status: string): Promise<Connection | undefined>;
  deleteConnection(id: number): Promise<boolean>;
  
  // Transaction methods
  getUserTransactions(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, userId: number): Promise<Transaction>;
  getUserBalance(userId: number): Promise<number>;
  
  // Seed methods
  seedDemoProducts(): Promise<void>;
  seedDemoOrders(userId: number): Promise<void>;
  seedDemoConnections(userId: number): Promise<void>;
  seedDemoTransactions(userId: number): Promise<void>;

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

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    
    if (!user) {
      return undefined;
    }
    
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
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

  // Order methods
  async getAllOrders(userId?: number): Promise<Order[]> {
    if (userId) {
      return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }
  
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }
  
  async createOrder(order: InsertOrder, userId: number): Promise<Order> {
    const orderWithUserId = { ...order, userId };
    const [newOrder] = await db
      .insert(orders)
      .values(orderWithUserId)
      .returning();
    return newOrder;
  }
  
  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));
    
    if (!order) {
      return undefined;
    }
    
    const [updatedOrder] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }
  
  // Order Items methods
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
  
  async addOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [newItem] = await db
      .insert(orderItems)
      .values(item)
      .returning();
    return newItem;
  }
  
  // Connection methods
  async getUserConnections(userId: number): Promise<Connection[]> {
    return await db.select().from(connections).where(eq(connections.userId, userId));
  }
  
  async getConnection(id: number): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    return connection || undefined;
  }
  
  async createConnection(connection: InsertConnection, userId: number): Promise<Connection> {
    const connectionWithUserId = { ...connection, userId };
    const [newConnection] = await db
      .insert(connections)
      .values(connectionWithUserId)
      .returning();
    return newConnection;
  }
  
  async updateConnectionStatus(id: number, status: string): Promise<Connection | undefined> {
    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, id));
    
    if (!connection) {
      return undefined;
    }
    
    const [updatedConnection] = await db
      .update(connections)
      .set({ status })
      .where(eq(connections.id, id))
      .returning();
    
    return updatedConnection;
  }
  
  async deleteConnection(id: number): Promise<boolean> {
    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, id));
    
    if (!connection) {
      return false;
    }
    
    await db
      .delete(connections)
      .where(eq(connections.id, id));
    
    return true;
  }
  
  // Transaction methods
  async getUserTransactions(userId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }
  
  async createTransaction(transaction: InsertTransaction, userId: number): Promise<Transaction> {
    const transactionWithUserId = { ...transaction, userId };
    const [newTransaction] = await db
      .insert(transactions)
      .values(transactionWithUserId)
      .returning();
    return newTransaction;
  }
  
  async getUserBalance(userId: number): Promise<number> {
    const userTransactions = await this.getUserTransactions(userId);
    const balance = userTransactions.reduce((total, tx) => total + tx.amount, 0);
    return balance;
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
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=350&fit=crop",
          reference: "WH-101",
          category: "Electronics",
          additionalImages: ["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500&h=350&fit=crop", 
                            "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=500&h=350&fit=crop"],
          weight: 0.3,
          dimensions: "18 x 15 x 8 cm",
          specifications: JSON.stringify({
            "Connectivity": "Bluetooth 5.0",
            "Battery": "24 hours",
            "Colors": ["Black", "White", "Blue"]
          })
        },
        {
          name: "Running Shoes",
          description: "Lightweight Sports Shoes",
          price: 129.99,
          stock: 28,
          status: "active",
          sku: "SH-200",
          imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=350&fit=crop",
          reference: "RS-202",
          category: "Footwear"
        },
        {
          name: "Smart Watch",
          description: "Fitness Tracker Watch",
          price: 199.99,
          stock: 15,
          status: "active",
          sku: "SW-300",
          imageUrl: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&h=350&fit=crop",
          reference: "SW-303",
          category: "Electronics",
          weight: 0.05,
          dimensions: "4 x 4 x 1 cm",
          specifications: JSON.stringify({
            "Display": "AMOLED",
            "Waterproof": true,
            "Sensors": ["Heart Rate", "GPS", "Accelerometer"]
          })
        },
        {
          name: "Mechanical Keyboard",
          description: "RGB Gaming Keyboard",
          price: 79.99,
          stock: 5,
          status: "low",
          sku: "KB-400",
          imageUrl: "https://images.unsplash.com/photo-1585155770447-2f66e2a397b5?w=500&h=350&fit=crop",
          reference: "MK-404",
          category: "Electronics",
          additionalImages: ["https://images.unsplash.com/photo-1595044778792-9c7c8096f843?w=500&h=350&fit=crop"]
        },
        {
          name: "Polaroid Camera",
          description: "Instant Photo Camera",
          price: 69.99,
          stock: 32,
          status: "active",
          sku: "CM-500",
          imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&h=350&fit=crop",
          reference: "PC-505",
          category: "Electronics",
          weight: 0.5,
          dimensions: "15 x 10 x 8 cm"
        },
        {
          name: "Designer Sneakers",
          description: "Urban Fashion Footwear",
          price: 149.99,
          stock: 0,
          status: "draft",
          sku: "SN-600",
          imageUrl: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=500&h=350&fit=crop",
          reference: "DS-606",
          category: "Footwear"
        }
      ];
      
      for (const product of demoProducts) {
        await this.createProduct(product);
      }
    }
  }
  
  // Seed demo orders for a user
  async seedDemoOrders(userId: number) {
    try {
      // Limpiar órdenes existentes y sus items primero
      await db.delete(orderItems).where(eq(orderItems.orderId, sql`ANY(SELECT id FROM orders WHERE "user_id" = ${userId})`));
      await db.delete(orders).where(eq(orders.userId, userId));
      
      const prods = await this.getAllProducts();
      if (prods.length > 0) {
        // Create demo orders with unique order numbers (incluye timestamp para evitar duplicados)
        const timestamp = Date.now().toString().slice(-4);
        const demoOrders = [
          {
            orderNumber: `ORD-001-${timestamp}`,
            customerName: "John Doe",
            customerEmail: "john.doe@example.com",
            customerPhone: "+1234567890",
            shippingAddress: "123 Main St, New York, NY 10001",
            status: "delivered",
            totalAmount: 125.99,
            notes: "Delivery instructions: Leave at the door"
          },
          {
            orderNumber: `ORD-002-${timestamp}`,
            customerName: "Jane Smith",
            customerEmail: "jane.smith@example.com",
            customerPhone: "+1987654321",
            shippingAddress: "456 Market St, San Francisco, CA 94105",
            status: "processing",
            totalAmount: 199.50,
            notes: ""
          },
          {
            orderNumber: `ORD-003-${timestamp}`,
            customerName: "Robert Johnson",
            customerEmail: "robert.johnson@example.com",
            customerPhone: "+1122334455",
            shippingAddress: "789 Broad St, Boston, MA 02110",
            status: "pending",
            totalAmount: 75.25,
            notes: "Gift wrapped please"
          },
          {
            orderNumber: `ORD-004-${timestamp}`,
            customerName: "Diana Prince",
            customerEmail: "diana@example.com",
            customerPhone: "456-789-0123",
            shippingAddress: "101 Elm St, Miami, FL",
            status: "cancelled",
            totalAmount: 129.95,
            notes: "Cancelled by customer"
          },
          {
            orderNumber: `ORD-005-${timestamp}`,
            customerName: "Eduardo García",
            customerEmail: "eduardo@example.com",
            customerPhone: "567-890-1234",
            shippingAddress: "202 Maple Ave, Austin, TX",
            status: "delivered",
            totalAmount: 199.99,
            notes: ""
          },
          {
            orderNumber: `ORD-006-${timestamp}`,
            customerName: "Fatima Khan",
            customerEmail: "fatima@example.com",
            customerPhone: "678-901-2345",
            shippingAddress: "303 Cedar Blvd, Seattle, WA",
            status: "processing",
            totalAmount: 79.95,
            notes: "Express shipping"
          }
        ];
        
        for (const order of demoOrders) {
          await this.createOrder(order as InsertOrder, userId);
        }
        
        // Add order items for each order
        const orders = await this.getAllOrders(userId);
        if (orders.length > 0 && prods.length > 0) {
          const orderItems = [
            {
              orderId: orders[0].id,
              productId: prods[0].id,
              quantity: 2,
              price: prods[0].price,
              subtotal: prods[0].price * 2
            },
            {
              orderId: orders[0].id,
              productId: prods[1].id,
              quantity: 1,
              price: prods[1].price,
              subtotal: prods[1].price
            },
            {
              orderId: orders[1].id,
              productId: prods[2].id,
              quantity: 1,
              price: prods[2].price,
              subtotal: prods[2].price
            },
            {
              orderId: orders[2].id,
              productId: prods[3].id,
              quantity: 3,
              price: prods[3].price,
              subtotal: prods[3].price * 3
            }
          ];
          
          for (const item of orderItems) {
            await this.addOrderItem(item);
          }
        }
      }
    } catch (error) {
      console.error("Error seeding demo orders:", error);
      throw error;
    }
  }
  
  // Seed demo connections for a user
  async seedDemoConnections(userId: number) {
    const existingConnections = await this.getUserConnections(userId);
    if (existingConnections.length === 0) {
      const demoConnections = [
        {
          platform: "shopify",
          name: "My Shopify Store",
          apiKey: "shpat_1234567890",
          apiSecret: "shpss_1234567890",
          status: "active"
        },
        {
          platform: "mercadolibre",
          name: "MercadoLibre Shop",
          apiKey: "APP_USR-1234567890",
          apiSecret: "APP_USR-1234567890",
          status: "active"
        },
        {
          platform: "woocommerce",
          name: "WooCommerce Store",
          apiKey: "ck_1234567890",
          apiSecret: "cs_1234567890",
          status: "error"
        }
      ];
      
      for (const connection of demoConnections) {
        await this.createConnection(connection as InsertConnection, userId);
      }
    }
  }
  
  // Seed demo transactions for a user
  async seedDemoTransactions(userId: number) {
    const existingTransactions = await this.getUserTransactions(userId);
    if (existingTransactions.length === 0) {
      const demoTransactions = [
        {
          type: "deposit",
          amount: 500.00,
          status: "completed",
          description: "Account Funding",
          reference: "DEP12345"
        },
        {
          type: "payment",
          amount: -125.99,
          status: "completed",
          description: "Order ORD-001-2025",
          reference: "PAY78965"
        },
        {
          type: "withdrawal",
          amount: -200.00,
          status: "processing",
          description: "Bank Transfer",
          reference: "WIT54321"
        },
        {
          type: "refund",
          amount: 75.50,
          status: "completed",
          description: "Order ORD-003-2024 Refund",
          reference: "REF98765"
        }
      ];
      
      for (const transaction of demoTransactions) {
        await this.createTransaction(transaction as InsertTransaction, userId);
      }
    }
  }
}

export const storage = new DatabaseStorage();
