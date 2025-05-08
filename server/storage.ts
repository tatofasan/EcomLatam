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
import crypto from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser> | { lastLogin?: Date; apiKey?: string }): Promise<User | undefined>;
  generateApiKey(userId: number): Promise<string>;
  
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
  getAllConnections(): Promise<Connection[]>;
  getConnection(id: number): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection, userId: number): Promise<Connection>;
  updateConnectionStatus(id: number, status: string): Promise<Connection | undefined>;
  deleteConnection(id: number): Promise<boolean>;
  
  // Transaction methods
  getUserTransactions(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, userId: number): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string, paymentProof?: string): Promise<Transaction | undefined>;
  getUserBalance(userId: number): Promise<number>;
  
  // WARNING: These methods are for development purposes only.
  // They are deprecated and will be removed in the final production version.
  // DO NOT USE IN PRODUCTION.
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.id));
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser> | { lastLogin?: Date; apiKey?: string }): Promise<User | undefined> {
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
  
  async generateApiKey(userId: number): Promise<string> {
    const user = await this.getUser(userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Generate a random API key (UUID v4 format)
    const apiKey = crypto.randomUUID();
    
    // Update the user with the new API key
    await this.updateUser(userId, { apiKey });
    
    return apiKey;
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
    
    // Si el nuevo estado es "delivered", actualizamos también la fecha de entrega (updatedAt)
    const updateData: { status: string; updatedAt?: Date } = { status };
    
    if (status === "delivered") {
      updateData.updatedAt = new Date();
    }
    
    const [updatedOrder] = await db
      .update(orders)
      .set(updateData)
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
  
  async getAllConnections(): Promise<Connection[]> {
    return await db.select().from(connections);
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
  
  async createTransaction(transaction: InsertTransaction | { 
    type: "withdrawal" | "bonus" | "discount", 
    amount: number, 
    status: "pending" | "processing" | "paid" | "failed" | "cancelled", 
    description?: string,
    reference?: string
  }, userId: number): Promise<Transaction> {
    const transactionWithUserId = { ...transaction, userId };
    const [newTransaction] = await db
      .insert(transactions)
      .values(transactionWithUserId)
      .returning();
    return newTransaction;
  }
  
  async updateTransactionStatus(id: number, status: string, paymentProof?: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    
    if (!transaction) {
      return undefined;
    }
    
    // Update transaction with new status and payment proof if provided
    const updateData: Record<string, any> = { status };
    
    // If payment proof is provided, store it in the settings field
    if (paymentProof) {
      const settings = transaction.settings || {};
      updateData.settings = {
        ...settings,
        paymentProof
      };
    }
    
    const [updatedTransaction] = await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();
    
    return updatedTransaction;
  }
  
  async getUserBalance(userId: number): Promise<number> {
    console.log(`Calculating balance for user ${userId}`);
    
    // Obtener la suma de pedidos entregados (ingresos)
    const [deliveredOrdersResult] = await db
      .select({ total: sql`SUM(total_amount)` })
      .from(orders)
      .where(and(
        eq(orders.userId, userId),
        eq(orders.status, "delivered")
      ));
    
    // Obtener la suma de todas las transacciones (bonos, descuentos y retiros)
    const [transactionsResult] = await db
      .select({ total: sql`SUM(amount)` })
      .from(transactions)
      .where(eq(transactions.userId, userId));
      
    // Calcular el balance total (pedidos entregados + todas las transacciones)
    const ordersTotal = deliveredOrdersResult.total ? Number(deliveredOrdersResult.total) : 0;
    const transactionsTotal = transactionsResult.total ? Number(transactionsResult.total) : 0;
    
    // El balance es la suma de pedidos entregados + todas las transacciones
    // (las transacciones de withdrawal tienen monto negativo, los bonus positivo, los descuentos negativo)
    const balance = ordersTotal + transactionsTotal;
    
    console.log(`User ${userId} balance calculation:`, {
      ordersTotal,
      transactionsTotal,
      finalBalance: balance
    });
    
    return balance;
  }

  // WARNING: This method is for development purposes only and should not be used in production
  // This will be removed in the final production version
  async seedDemoProducts() {
    console.warn("WARNING: seedDemoProducts method is deprecated and should not be used in production");
    
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
  
  // WARNING: This method is for development purposes only and should not be used in production
  // This will be removed in the final production version
  async seedDemoOrders(userId: number) {
    console.warn("WARNING: seedDemoOrders method is deprecated and should not be used in production");
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
          "Please call before delivery",
          ""
        ];
        
        // Calcular distribución de estados según antigüedad del pedido
        const getStatusByDay = (daysPast: number) => {
          if (daysPast === 0) { // Hoy
            const rand = Math.random() * 100;
            if (rand < 60) return "pending";
            if (rand < 95) return "processing";
            return "cancelled";
          } 
          else if (daysPast === 1) { // Ayer
            const rand = Math.random() * 100;
            if (rand < 20) return "pending";
            if (rand < 70) return "processing";
            if (rand < 90) return "delivered";
            return "cancelled";
          }
          else if (daysPast <= 3) { // 2-3 días atrás
            const rand = Math.random() * 100;
            if (rand < 10) return "pending";
            if (rand < 30) return "processing";
            if (rand < 85) return "delivered";
            return "cancelled";
          }
          else { // 4+ días atrás
            const rand = Math.random() * 100;
            if (rand < 5) return "processing";
            if (rand < 85) return "delivered";
            return "cancelled";
          }
        };
        
        // Crear órdenes para los últimos 7 días con distribución realista de estados
        for (let i = 0; i < 7; i++) {
          const orderDate = new Date();
          orderDate.setDate(today.getDate() - i);
          
          // Más pedidos en días recientes, menos en días antiguos
          const numOrdersPerDay = i === 0 ? 5 + Math.floor(Math.random() * 3) : // 5-7 hoy
                                  i === 1 ? 4 + Math.floor(Math.random() * 3) : // 4-6 ayer 
                                  i <= 3 ? 3 + Math.floor(Math.random() * 3) : // 3-5 hace 2-3 días
                                  2 + Math.floor(Math.random() * 3); // 2-4 hace 4+ días
          
          for (let j = 0; j < numOrdersPerDay; j++) {
            // Determinar estado basado en la antigüedad del pedido
            const selectedStatus = getStatusByDay(i);
            
            // Elegir cliente aleatorio
            const customer = customerData[Math.floor(Math.random() * customerData.length)];
            
            // Generar número de orden único con fecha legible
            const orderNumber = `ORD-${orderDate.getFullYear().toString().substring(2)}${(orderDate.getMonth()+1).toString().padStart(2, '0')}${orderDate.getDate().toString().padStart(2, '0')}-${timestamp}-${j}`;
            
            // Calcular monto total basado en productos (más realista)
            // Entre 1-4 productos por orden
            const itemCount = 1 + Math.floor(Math.random() * 4);
            let orderTotal = 0;
            const selectedItems = [];
            
            for (let k = 0; k < itemCount; k++) {
              const product = prods[Math.floor(Math.random() * prods.length)];
              const quantity = 1 + Math.floor(Math.random() * 3); // 1-3 unidades
              orderTotal += product.price * quantity;
              
              // Guardar info del producto para usarla después en la creación de orderItems
              selectedItems.push({
                productId: product.id,
                quantity,
                price: product.price,
                subtotal: product.price * quantity
              });
            }
            
            // Redondear a 2 decimales
            orderTotal = parseFloat(orderTotal.toFixed(2));
            
            // Crear objeto de orden
            const newOrder = {
              orderNumber,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              shippingAddress: customer.address,
              status: selectedStatus,
              totalAmount: orderTotal,
              notes: orderNotes[Math.floor(Math.random() * orderNotes.length)],
              items: selectedItems
            };
            
            demoOrders.push(newOrder);
          }
        }
        
        // Insertamos órdenes directamente en la base de datos para poder especificar fechas personalizadas
        for (const order of demoOrders) {
          // Extraer el día del número de orden para determinar la fecha
          const datePart = order.orderNumber.split('-')[1];
          const year = parseInt(`20${datePart.substring(0, 2)}`);
          const month = parseInt(datePart.substring(2, 4)) - 1; // Meses en JS son 0-11
          const day = parseInt(datePart.substring(4, 6));
          
          // Crear fecha para esta orden según datePart
          const orderDate = new Date(year, month, day);
          
          // Crear fecha de actualización según el estado
          const updatedDate = new Date(orderDate);
          
          // Ajustar updatedDate según el estado
          if (order.status === "processing") {
            // Para pedidos en proceso: entre 1 y 12 horas después
            updatedDate.setHours(updatedDate.getHours() + Math.floor(1 + Math.random() * 12));
          } else if (order.status === "delivered") {
            // Para pedidos entregados: entre 6 y 48 horas después
            updatedDate.setHours(updatedDate.getHours() + Math.floor(6 + Math.random() * 42));
          } else if (order.status === "cancelled") {
            // Para pedidos cancelados: entre 1 y 24 horas después
            updatedDate.setHours(updatedDate.getHours() + Math.floor(1 + Math.random() * 24));
          }
          
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
              updatedAt: updatedDate
            })
            .returning();
            
          // Agregar los items usando la info calculada previamente en selectedItems
          for (const item of order.items) {
            await this.addOrderItem({
              orderId: newOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal
            });
          }
        }
      }
    } catch (error) {
      console.error("Error seeding demo orders:", error);
      throw error;
    }
  }
  
  // WARNING: This method is for development purposes only and should not be used in production
  // This will be removed in the final production version
  async seedDemoConnections(userId: number) {
    console.warn("WARNING: seedDemoConnections method is deprecated and should not be used in production");
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
  
  // WARNING: This method is for development purposes only and should not be used in production
  // This will be removed in the final production version
  async seedDemoTransactions(userId: number) {
    console.warn("WARNING: seedDemoTransactions method is deprecated and should not be used in production");
    try {
      // Limpiar transacciones existentes primero
      await db.delete(transactions).where(eq(transactions.userId, userId));
      
      // Obtener órdenes existentes para crear transacciones vinculadas a órdenes reales
      const userOrders = await this.getAllOrders(userId);
      
      if (userOrders.length > 0) {
        // Crear transacción inicial de bonificación
        await this.createTransaction({
          type: "bonus",
          amount: 1000.00,
          status: "paid",
          description: "Welcome Bonus",
          reference: "BNS" + Date.now().toString().slice(-6)
        }, userId);
        
        // Crear transacciones de descuento para algunas órdenes
        const someOrders = userOrders.slice(0, Math.ceil(userOrders.length * 0.3)); // 30% de las órdenes
        for (const order of someOrders) {
          await this.createTransaction({
            type: "discount",
            amount: -order.totalAmount * 0.1, // Descuento del 10%
            status: "paid",
            description: `Discount for Order ${order.orderNumber}`,
            reference: `DIS-${order.orderNumber}`
          }, userId);
        }
        
        // Crear transacción de bonificación para clientes frecuentes
        await this.createTransaction({
          type: "bonus",
          amount: 250.00,
          status: "paid",
          description: "Loyal Customer Bonus",
          reference: "BNS" + Date.now().toString().slice(-6)
        }, userId);
        
        // Agregar un retiro si hay suficiente balance
        const currentBalance = await this.getUserBalance(userId);
        if (currentBalance > 300) {
          await this.createTransaction({
            type: "withdrawal",
            amount: -Math.min(currentBalance * 0.3, 500), // Retirar 30% del balance o máximo 500
            status: "paid",
            description: "Withdrawal to Bank Account",
            reference: "WIT" + Date.now().toString().slice(-6)
          }, userId);
        }
      } else {
        // Si no hay órdenes, crear transacciones demo básicas
        const demoTransactions: Array<{
          type: "withdrawal" | "bonus" | "discount";
          amount: number;
          status: "pending" | "processing" | "paid" | "failed" | "cancelled";
          description: string;
          reference: string;
        }> = [
          {
            type: "bonus",
            amount: 500.00,
            status: "paid",
            description: "Welcome Bonus",
            reference: "BNS" + Date.now().toString().slice(-6)
          },
          {
            type: "withdrawal",
            amount: -200.00,
            status: "processing",
            description: "Bank Transfer",
            reference: "WIT" + Date.now().toString().slice(-6)
          }
        ];
        
        for (const transaction of demoTransactions) {
          await this.createTransaction(transaction, userId);
        }
      }
    } catch (error) {
      console.error("Error seeding demo transactions:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
