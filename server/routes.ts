import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
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
import { eq, desc, asc, sql, inArray } from "drizzle-orm";

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
  
  // Middleware to ensure moderator or admin role
  const requireModerator = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || (req.user?.role !== 'admin' && req.user?.role !== 'moderator')) {
      return res.status(403).json({ message: "Forbidden: Moderator access required" });
    }
    next();
  };
  
  // Middleware to ensure finance or admin role
  const requireFinance = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || (req.user?.role !== 'admin' && req.user?.role !== 'finance')) {
      return res.status(403).json({ message: "Forbidden: Finance access required" });
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
  
  // Bulk import products
  app.post("/api/products/bulk-import", requireAdmin, async (req, res) => {
    try {
      // Registro de debugging para ver cómo llega la solicitud
      console.log('Bulk import request received:', 
                  typeof req.body, 
                  req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'No keys');
      
      const { products } = req.body;
      
      if (!Array.isArray(products) || products.length === 0) {
        const errorResponse = { message: "No products provided for import" };
        console.log('Sending error response:', errorResponse);
        return res.status(400).json(errorResponse);
      }
      
      console.log(`Attempting to import ${products.length} products`);
      
      // Validate all products
      const validProducts = [];
      const invalidProducts = [];
      
      for (const productData of products) {
        const parseResult = productSchema.safeParse(productData);
        if (parseResult.success) {
          validProducts.push(parseResult.data);
        } else {
          // Simplified error format to avoid serialization issues
          const formattedErrors = Object.entries(parseResult.error.format())
            .filter(([key]) => key !== '_errors')
            .map(([key, value]) => `${key}: ${(value as any)._errors?.join(', ') || 'Invalid'}`);
          
          invalidProducts.push({
            data: {
              name: productData.name || 'Unknown',
              sku: productData.sku || 'Unknown'
            },
            errors: formattedErrors
          });
        }
      }
      
      console.log(`Valid products: ${validProducts.length}, Invalid products: ${invalidProducts.length}`);
      
      // Only proceed if we have valid products
      if (validProducts.length === 0) {
        const errorResponse = { 
          message: "None of the products were valid for import",
          invalidCount: invalidProducts.length,
          errors: invalidProducts.map(p => `${p.data.name} (${p.data.sku}): ${p.errors.join(', ')}`)
        };
        console.log('Sending validation error response:', JSON.stringify(errorResponse).substring(0, 200) + '...');
        return res.status(400).json(errorResponse);
      }
      
      // Import valid products
      const importedProducts = [];
      
      for (const productData of validProducts) {
        try {
          const product = await storage.createProduct(productData);
          // Only include essential product info to avoid large responses
          importedProducts.push({
            id: product.id,
            name: product.name,
            sku: product.sku
          });
        } catch (error) {
          console.error("Error importing product:", error);
          invalidProducts.push({
            data: {
              name: productData.name || 'Unknown',
              sku: productData.sku || 'Unknown'
            },
            errors: [(error as Error).message]
          });
        }
      }
      
      // Crear una respuesta simplificada que sea más fácil de serializar
      const response = {
        message: `Imported ${importedProducts.length} products successfully${invalidProducts.length > 0 ? `, ${invalidProducts.length} products failed validation` : ''}`,
        success: importedProducts.length,
        failed: invalidProducts.length,
        // Solo incluir IDs y nombres en lugar de los objetos completos
        importedProducts: importedProducts.map(p => `${p.name} (ID: ${p.id})`),
        // Simplificar los errores para evitar problemas de serialización
        failedProducts: invalidProducts.length > 0 
          ? invalidProducts.map(p => `${p.data.name} (${p.data.sku}): ${p.errors.join(', ')}`) 
          : []
      };
      
      console.log('Sending success response:', JSON.stringify(response).substring(0, 200) + '...');
      
      // Validar que la respuesta se puede serializar correctamente
      const jsonString = JSON.stringify(response);
      const parsedBack = JSON.parse(jsonString);
      
      // Enviar la respuesta simplificada
      res.status(200).json(response);
    } catch (error) {
      console.error("Error in bulk import:", error);
      const errorResponse = { 
        message: "Failed to process bulk import", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      console.log('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
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
      
      // Get order items for quantity calculations
      const orderItemsPromises = ordersList.map(order => 
        db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
      );
      const allOrderItemsResults = await Promise.all(orderItemsPromises);
      
      // Create a map of order ID to its items
      const orderItemsMap = {};
      ordersList.forEach((order, index) => {
        orderItemsMap[order.id] = allOrderItemsResults[index];
      });
      
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
          
          // For delivered orders, count the quantity of items sold
          if (order.status === 'delivered') {
            const orderItems = orderItemsMap[order.id] || [];
            const itemsCount = orderItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
            monthlyData[monthKey].sales += itemsCount;
          }
        }
      });
      
      // Transform to array for chart data
      const salesData = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        sales: Math.round(data.sales), // Round to nearest integer for item counts
        orders: data.orders
      }));
      
      // Get product categories distribution from order items
      const productCategories = {};
      
      // If there are no products created by this user, get products from their orders
      if (productsList.length === 0 && ordersList.length > 0) {
        console.log(`No products created by user ${userId}, fetching from order items instead.`);
        
        // Get all order IDs for this user
        const orderIds = ordersList.map(order => order.id);
        
        // Get all order items for these orders
        const allOrderItems = await db.select()
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds));
        
        // Get unique product IDs from order items
        const productIds = [...new Set(allOrderItems.map(item => item.productId))];
        
        if (productIds.length > 0) {
          // Get products for these order items
          const orderProducts = await db.select()
            .from(products)
            .where(inArray(products.id, productIds));
          
          // Process products from orders to get categories
          orderProducts.forEach(product => {
            // Asegurarse de que los valores null, undefined, o cadenas vacías se conviertan a "Sin categoría"
            const category = (product.category && product.category.trim()) ? product.category.trim() : 'Sin categoría';
            if (!productCategories[category]) {
              productCategories[category] = 0;
            }
            productCategories[category] += 1;
          });
        } else {
          // Si no hay productos en los pedidos, crear una categoría por defecto
          productCategories['Sin categoría'] = 1;
        }
      } else {
        // Process products created by the user
        productsList.forEach(product => {
          // Asegurarse de que los valores null, undefined, o cadenas vacías se conviertan a "Sin categoría"
          const category = (product.category && product.category.trim()) ? product.category.trim() : 'Sin categoría';
          if (!productCategories[category]) {
            productCategories[category] = 0;
          }
          productCategories[category] += 1;
        });
      }
      
      // Si después de todo no hay categorías, asegurarse de que haya al menos una
      if (Object.keys(productCategories).length === 0) {
        productCategories['Sin categoría'] = 1;
      }
      
      // Convertir a array para el gráfico
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
  
  // Update transaction status (admin only)
  app.patch("/api/wallet/transactions/:id/status", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden. Admin access required." });
      }
      
      const transactionId = parseInt(req.params.id);
      const { status, paymentProof } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Check if the status is valid
      if (!['pending', 'processing', 'paid', 'failed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      
      // Update transaction status
      const updatedTransaction = await storage.updateTransactionStatus(
        transactionId, 
        status, 
        paymentProof
      );
      
      if (!updatedTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating transaction status:", error);
      res.status(500).json({ message: "Failed to update transaction status" });
    }
  });
  
  // Get transaction details
  app.get("/api/wallet/transactions/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const transactionId = parseInt(req.params.id);
      const userId = req.user.id;
      const isAdmin = req.user.role === "admin";
      
      // Get all transactions for the user
      const userTransactions = await storage.getUserTransactions(userId);
      
      // Find the specific transaction
      const transaction = userTransactions.find(t => t.id === transactionId);
      
      // If admin, allow access to any transaction
      if (isAdmin && !transaction) {
        // Admin can get any transaction, so try to get it directly from DB
        const allTransactions = await db.select().from(transactions).where(eq(transactions.id, transactionId));
        if (allTransactions.length > 0) {
          return res.json(allTransactions[0]);
        }
      }
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });
  
  // Get user connections
  app.get("/api/connections", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const showAll = req.query.all === 'true' && isAdmin;
      
      // Si es admin y pide todas las conexiones, usar getAllConnections
      // De lo contrario, solo mostrar las conexiones del usuario
      let connections;
      if (showAll) {
        // Obtener todas las conexiones
        connections = await storage.getAllConnections();
        
        // Agregar nombres de usuario a cada conexión
        const userIds = new Set(connections.map(conn => conn.userId));
        const usersMap = new Map();
        
        // Buscar información de todos los usuarios involucrados
        for (const id of userIds) {
          const user = await storage.getUser(id);
          if (user) {
            usersMap.set(id, user.username);
          }
        }
        
        // Añadir la información de nombre de usuario a cada conexión
        connections = connections.map(conn => ({
          ...conn,
          userName: usersMap.get(conn.userId) || `User-${conn.userId}`
        }));
      } else {
        connections = await storage.getUserConnections(userId);
      }
      
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
      
      // Check if this connection belongs to the authenticated user or if user is an admin
      if (connection.userId !== req.user.id && req.user.role !== 'admin') {
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
      
      // Check if this connection belongs to the authenticated user or if user is an admin
      if (connection.userId !== req.user.id && req.user.role !== 'admin') {
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
  
  // Team management endpoints - Only accessible to admin users
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send("Error fetching users");
    }
  });
  
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }
      
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).send("Error creating user");
    }
  });
  
  // PUT endpoint for updating users
  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      console.log("PUT /api/users/:id received with data:", userData);
      
      // Prevent non-admin from changing an admin role
      const user = await storage.getUser(userId);
      if (user?.role === "admin" && userData.role !== "admin" && req.user?.role !== "admin") {
        return res.status(403).send("Only admins can change admin roles");
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).send("Error updating user");
    }
  });
  
  // PATCH endpoint for updating users (same logic as PUT)
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      console.log("PATCH /api/users/:id received with data:", userData);
      
      // Prevent non-admin from changing an admin role
      const user = await storage.getUser(userId);
      if (user?.role === "admin" && userData.role !== "admin" && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Only admins can change admin roles" });
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user", error: error.message });
    }
  });
  
  // Endpoint for resetting user password
  app.patch("/api/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;
      
      console.log(`PATCH /api/users/${userId}/reset-password received`);
      
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }
      
      // Get user to check if exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Hash password before saving to database
      const hashedPassword = await hashPassword(password);
      
      // Update user with new password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user password" });
      }
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Error resetting password", error: error.message });
    }
  });
  
  const httpServer = createServer(app);

  return httpServer;
}
