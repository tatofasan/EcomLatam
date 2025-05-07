import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  productSchema, 
  insertOrderSchema, 
  insertOrderItemSchema, 
  insertConnectionSchema,
  insertTransactionSchema,
  products,
  orders,
  orderItems,
  transactions,
  type InsertTransaction
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Middleware to ensure authentication for protected routes
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };
  
  // Middleware to ensure admin role
  const requireAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };

  // Seed demo data if database is empty
  app.post("/api/seed", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      
      // Seed demo data
      await storage.seedDemoProducts();
      await storage.seedDemoOrders(userId);
      await storage.seedDemoConnections(userId);
      await storage.seedDemoTransactions(userId);
      
      res.status(200).json({ message: "Demo data seeded successfully" });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });
  
  // Seed only orders for visualization
  app.post("/api/seed/orders", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      
      // Seed only orders for statistics
      await storage.seedDemoOrders(userId);
      
      // Crear un pedido específico de ayer con actualización hoy
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const today = new Date();
      
      // Generar un número de orden único
      const orderNumber = `ORD-AYER-${Date.now().toString().slice(-4)}`;
      
      // Crear un pedido de ayer con actividad hoy
      const [specialOrder] = await db
        .insert(orders)
        .values({
          orderNumber,
          userId: userId,
          customerName: "Test Customer",
          customerEmail: "test@example.com",
          customerPhone: "123-456-7890",
          shippingAddress: "Test Address, Test City",
          status: "delivered", // Estado que no es 'pending' para que sea claro que hubo un cambio
          totalAmount: 199.99,
          notes: "Pedido de prueba (ayer-hoy)",
          createdAt: yesterday,
          updatedAt: today
        })
        .returning();
      
      // Agregar un item al pedido
      const [product] = await db.select().from(products).limit(1);
      if (product) {
        await db.insert(orderItems).values({
          orderId: specialOrder.id,
          productId: product.id,
          quantity: 1,
          price: product.price,
          subtotal: product.price
        });
      }
      
      res.status(200).json({ message: "Order data seeded successfully" });
    } catch (error) {
      console.error("Error seeding order data:", error);
      res.status(500).json({ message: "Failed to seed order data" });
    }
  });

  // API Routes
  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get a single product
  app.get("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Create a product
  app.post("/api/products", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log("Product data received:", JSON.stringify(req.body, null, 2));
      const parseResult = productSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.error("Product validation error:", JSON.stringify(parseResult.error.format(), null, 2));
        return res.status(400).json({ 
          message: "Invalid product data", 
          errors: parseResult.error.format() 
        });
      }
      
      const product = await storage.createProduct(parseResult.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Update a product
  app.put("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const productId = parseInt(req.params.id);
      const parseResult = productSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid product data", 
          errors: parseResult.error.format() 
        });
      }
      
      const product = await storage.updateProduct(productId, parseResult.data);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Delete a product
  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const success = await storage.deleteProduct(productId);
      
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Get all orders filtered by user role (admin sees all, regular users see only their orders)
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      // If admin and specifically requests all orders, don't filter by userId
      const orders = isAdmin ? await storage.getAllOrders() : await storage.getAllOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get a single order with its items
  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Check if this order belongs to the authenticated user (or if user is admin)
      const isAdmin = req.user.role === 'admin';
      if (order.userId !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const items = await storage.getOrderItems(orderId);
      
      res.json({
        ...order,
        items
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Create a new order
  app.post("/api/orders", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const parseResult = insertOrderSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid order data", 
          errors: parseResult.error.format() 
        });
      }
      
      const userId = req.user.id;
      const order = await storage.createOrder(parseResult.data, userId);
      
      // Handle order items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const itemData = {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity
          };
          
          await storage.addOrderItem(itemData);
        }
      }
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Check if the status is valid
      if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Check if this order belongs to the authenticated user (or if user is admin)
      const isAdmin = req.user.role === 'admin';
      if (order.userId !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updatedOrder = await storage.updateOrderStatus(orderId, status);
      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Dashboard metrics - filtered by user role
  app.get("/api/dashboard/metrics", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      console.log(`Fetching dashboard metrics for user ID ${userId}, isAdmin: ${isAdmin}`);
      
      // Get total products count (all for admin, user-created for regular users)
      let productsQuery = db.select().from(products);
      if (!isAdmin) {
        productsQuery = productsQuery.where(eq(products.userId, userId));
      }
      const productsList = await productsQuery;
      
      // Get orders data (all for admin, user's orders for regular users)
      let ordersQuery = db.select().from(orders);
      if (!isAdmin) {
        ordersQuery = ordersQuery.where(eq(orders.userId, userId));
      }
      const ordersList = await ordersQuery;
      
      console.log(`Dashboard orders for user ${userId} (isAdmin: ${isAdmin}):`, 
                 `Total orders: ${ordersList.length}`,
                 `First few orders user_ids:`, ordersList.slice(0, 3).map(o => o.userId));
      
      // Calculate revenue from completed orders
      const deliveredOrders = ordersList.filter(order => order.status === 'delivered');
      const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      
      // Get recent orders (limit to 5)
      let recentOrdersQuery = db.select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(5);
        
      if (!isAdmin) {
        recentOrdersQuery = recentOrdersQuery.where(eq(orders.userId, userId));
      }
      
      const recentOrders = await recentOrdersQuery;
      
      // Get order counts by status
      const pendingCount = ordersList.filter(order => order.status === 'pending').length;
      const processingCount = ordersList.filter(order => order.status === 'processing').length;
      const deliveredCount = ordersList.filter(order => order.status === 'delivered').length;
      const cancelledCount = ordersList.filter(order => order.status === 'cancelled').length;
      
      // Get sales data by month
      const monthlyData = {};
      
      // Initialize with last 6 months
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = monthDate.toLocaleString('default', { month: 'short' });
        monthlyData[monthKey] = { sales: 0, orders: 0 };
      }
      
      // Populate with actual data
      ordersList.forEach(order => {
        const orderDate = new Date(order.createdAt);
        const monthKey = orderDate.toLocaleString('default', { month: 'short' });
        
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].orders += 1;
          if (order.status === 'delivered') {
            monthlyData[monthKey].sales += order.totalAmount;
          }
        }
      });
      
      // Transform to array for chart data
      const salesData = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        sales: parseFloat(data.sales.toFixed(2)),
        orders: data.orders
      }));
      
      // Get product categories distribution
      const productCategories = {};
      productsList.forEach(product => {
        const category = product.category || 'Uncategorized';
        if (!productCategories[category]) {
          productCategories[category] = 0;
        }
        productCategories[category] += 1;
      });
      
      const productCategoriesData = Object.entries(productCategories).map(([name, value]) => ({
        name,
        value
      }));
      
      res.json({
        totalProducts: productsList.length,
        totalOrders: ordersList.length,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        recentOrders,
        orderStatus: {
          pending: pendingCount,
          processing: processingCount,
          delivered: deliveredCount,
          cancelled: cancelledCount
        },
        salesData,
        productCategoriesData
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });
  
  // Get wallet transactions - filtered by user role
  app.get("/api/wallet/transactions", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      let userTransactions = [];
      
      if (isAdmin) {
        // Admin sees all transactions
        userTransactions = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
      } else {
        // Regular users see only their transactions
        userTransactions = await storage.getUserTransactions(userId);
      }
      
      res.json(userTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  
  // Get user balance
  app.get("/api/wallet/balance", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      let balance = 0;
      
      if (isAdmin) {
        // Admin sees total balance of all users
        // Obtener la suma de todos los pedidos entregados
        const [deliveredOrdersResult] = await db
          .select({ total: sql`SUM(total_amount)` })
          .from(orders)
          .where(eq(orders.status, "delivered"));
        
        // Obtener la suma de todos los retiros
        const [withdrawalsResult] = await db
          .select({ total: sql`SUM(amount)` })
          .from(transactions)
          .where(eq(transactions.type, "withdrawal"));
          
        const ordersTotal = deliveredOrdersResult.total ? Number(deliveredOrdersResult.total) : 0;
        const withdrawalsTotal = withdrawalsResult.total ? Number(withdrawalsResult.total) : 0;
        
        balance = ordersTotal + withdrawalsTotal; // withdrawalsTotal ya es negativo
      } else {
        // Regular users see only their balance
        balance = await storage.getUserBalance(userId);
      }
      
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });
  
  // Create a withdrawal transaction
  app.post("/api/wallet/withdraw", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const { amount, walletAddress } = req.body;
      
      // Validate request
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }
      
      if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ message: "Wallet address is required" });
      }
      
      // Check if user has sufficient balance
      const currentBalance = await storage.getUserBalance(userId);
      
      if (amount > currentBalance) {
        return res.status(400).json({ message: "Insufficient balance for withdrawal" });
      }
      
      // Create withdrawal transaction (negative amount)
      const withdrawal: InsertTransaction = {
        type: "withdrawal",
        amount: -Math.abs(amount), // Ensure amount is negative
        status: "pending",
        description: `Withdrawal to ${walletAddress}`,
        reference: `WIT${Date.now().toString().slice(-6)}`
      };
      
      const transaction = await storage.createTransaction(withdrawal, userId);
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });
  
  // Update user wallet address
  app.patch("/api/user/wallet-address", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const { walletAddress } = req.body;
      
      if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ message: "Invalid wallet address" });
      }
      
      // Update user settings with wallet address
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const settings = user.settings || {};
      settings.walletAddress = walletAddress;
      
      const updatedUser = await storage.updateUser(userId, { settings });
      
      res.json({ success: true, walletAddress });
    } catch (error) {
      console.error("Error updating wallet address:", error);
      res.status(500).json({ message: "Failed to update wallet address" });
    }
  });
  
  // Get user wallet address
  app.get("/api/user/wallet-address", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const walletAddress = user.settings?.walletAddress || '';
      
      res.json({ walletAddress });
    } catch (error) {
      console.error("Error fetching wallet address:", error);
      res.status(500).json({ message: "Failed to fetch wallet address" });
    }
  });
  
  // Get user connections
  app.get("/api/connections", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const connections = await storage.getUserConnections(userId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Create a new connection
  app.post("/api/connections", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const parseResult = insertConnectionSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid connection data", 
          errors: parseResult.error.format() 
        });
      }
      
      const userId = req.user.id;
      const connection = await storage.createConnection(parseResult.data, userId);
      res.status(201).json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Failed to create connection" });
    }
  });

  // Update connection status
  app.patch("/api/connections/:id/status", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const connectionId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Check if the status is valid
      if (!['active', 'inactive', 'error'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Check if this connection belongs to the authenticated user
      if (connection.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updatedConnection = await storage.updateConnectionStatus(connectionId, status);
      
      res.json(updatedConnection);
    } catch (error) {
      console.error("Error updating connection status:", error);
      res.status(500).json({ message: "Failed to update connection status" });
    }
  });

  // Delete a connection
  app.delete("/api/connections/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Check if this connection belongs to the authenticated user
      if (connection.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const success = await storage.deleteConnection(connectionId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete connection" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });
  
  const httpServer = createServer(app);

  return httpServer;
}
