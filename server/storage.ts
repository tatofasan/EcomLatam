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
        // Crear órdenes de demo con fechas distribuidas para las estadísticas
        const timestamp = Date.now().toString().slice(-4);
        const today = new Date();
        const demoOrders = [];
        
        // Datos de clientes para muestra
        const customerData = [
          {
            name: "John Doe",
            email: "john.doe@example.com",
            phone: "+1234567890",
            address: "123 Main St, New York, NY 10001"
          },
          {
            name: "Jane Smith",
            email: "jane.smith@example.com",
            phone: "+1987654321",
            address: "456 Market St, San Francisco, CA 94105"
          },
          {
            name: "Robert Johnson",
            email: "robert.johnson@example.com",
            phone: "+1122334455",
            address: "789 Broad St, Boston, MA 02110"
          },
          {
            name: "Diana Prince",
            email: "diana@example.com",
            phone: "456-789-0123",
            address: "101 Elm St, Miami, FL"
          },
          {
            name: "Eduardo García",
            email: "eduardo@example.com",
            phone: "567-890-1234",
            address: "202 Maple Ave, Austin, TX"
          }
        ];
        
        // Notas para las órdenes
        const orderNotes = [
          "Delivery instructions: Leave at the door",
          "Gift wrapped please",
          "Express shipping",
          "Cancelled by customer",
          ""
        ];
        
        // Crear órdenes para los últimos 7 días
        for (let i = 0; i < 7; i++) {
          const orderDate = new Date();
          orderDate.setDate(today.getDate() - i);
          
          // Generar entre 3-6 órdenes por día
          const numOrdersPerDay = 3 + Math.floor(Math.random() * 4);
          
          for (let j = 0; j < numOrdersPerDay; j++) {
            // Escoger estado aleatorio (más órdenes entregadas y en proceso que pendientes o canceladas)
            const statuses = ["pending", "processing", "delivered", "cancelled"];
            const weights = [20, 30, 40, 10]; // probabilidades en porcentaje
            
            let randomNum = Math.random() * 100;
            let selectedStatus = statuses[0];
            let accumulatedWeight = 0;
            
            for (let k = 0; k < weights.length; k++) {
              accumulatedWeight += weights[k];
              if (randomNum <= accumulatedWeight) {
                selectedStatus = statuses[k];
                break;
              }
            }
            
            // Elegir cliente aleatorio
            const customer = customerData[Math.floor(Math.random() * customerData.length)];
            
            // Generar número de orden único
            const orderNumber = `ORD-${orderDate.getDate().toString().padStart(2, '0')}${(orderDate.getMonth()+1).toString().padStart(2, '0')}-${timestamp}-${j}`;
            
            // Generar monto total aleatorio entre 50 y 250
            const totalAmount = parseFloat((50 + Math.random() * 200).toFixed(2));
            
            // Crear objeto de orden
            const newOrder = {
              orderNumber,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              shippingAddress: customer.address,
              status: selectedStatus,
              totalAmount,
              notes: orderNotes[Math.floor(Math.random() * orderNotes.length)]
            };
            
            demoOrders.push(newOrder);
          }
        }
        
        // Insertamos órdenes directamente en la base de datos para poder especificar fechas personalizadas
        for (const order of demoOrders) {
          // Usamos el objeto "orders" directamente para evitar problemas con userId vs user_id
          // Crear fecha para esta orden (hace i días)
          const orderDate = new Date();
          orderDate.setDate(orderDate.getDate() - parseInt(order.orderNumber.split('-')[1].substring(0, 2)) % 7);
          
          const [newOrder] = await db
            .insert(orders)
            .values({
              orderNumber: order.orderNumber,
              userId: userId,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerPhone: order.customerPhone,
              shippingAddress: order.shippingAddress,
              status: order.status,
              totalAmount: order.totalAmount,
              notes: order.notes,
              createdAt: orderDate,
              updatedAt: orderDate
            })
            .returning();
            
          // Agregar items a cada orden (entre 1 y 3 productos aleatorios)
          const numProducts = 1 + Math.floor(Math.random() * 3);
          
          // Seleccionar productos aleatorios sin repetir
          const selectedProductIndexes = new Set<number>();
          while (selectedProductIndexes.size < numProducts && selectedProductIndexes.size < prods.length) {
            selectedProductIndexes.add(Math.floor(Math.random() * prods.length));
          }
          
          // Convertir Set a Array para iterar
          const productIndexes = Array.from(selectedProductIndexes);
          for (const prodIndex of productIndexes) {
            const product = prods[prodIndex];
            const quantity = 1 + Math.floor(Math.random() * 3); // 1-3 unidades
            
            await this.addOrderItem({
              orderId: newOrder.id,
              productId: product.id,
              quantity,
              price: product.price,
              subtotal: product.price * quantity
            });
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
