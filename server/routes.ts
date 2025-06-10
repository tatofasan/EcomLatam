import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { 
  insertOfferSchema, 
  insertLeadSchema, 
  insertLeadItemSchema, 
  insertCampaignSchema,
  insertTransactionSchema,
  apiLeadSchema,
  apiLeadStatusSchema,
  offers,
  leads,
  leadItems,
  transactions,
  users,
  type InsertTransaction,
  type ApiLead
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, inArray } from "drizzle-orm";
import { verifyUserEmail, activateUserAccount } from "./verification";

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
  
  // Middleware to authenticate using API key for API routes
  const requireApiKey = async (req: Request, res: Response, next: Function) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ 
        success: false,
        message: "API key is required" 
      });
    }
    
    const user = await storage.getUserByApiKey(apiKey);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid API key" 
      });
    }
    
    // Attach the user to the request object for later use
    req.user = user;
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

  // WARNING: This endpoint is for development purposes only and should not be used in production
  // This will be removed in the final production version
  app.post("/api/seed", requireAuth, async (req, res) => {
    console.warn("WARNING: /api/seed endpoint is deprecated and should not be used in production");
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      
      // Seed demo data - These methods are deprecated and will be removed
      await storage.seedDemoProducts();
      await storage.seedDemoOrders(userId);
      await storage.seedDemoConnections(userId);
      await storage.seedDemoTransactions(userId);
      
      res.status(200).json({ 
        message: "Demo data seeded successfully", 
        warning: "This feature is deprecated and will be removed in production"
      });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });
  
  // WARNING: This endpoint is for development purposes only and should not be used in production
  // This will be removed in the final production version
  app.post("/api/seed/orders", requireAuth, async (req, res) => {
    console.warn("WARNING: /api/seed/orders endpoint is deprecated and should not be used in production");
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      
      // Seed only orders for statistics - This method is deprecated and will be removed
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
      
      res.status(200).json({ 
        message: "Order data seeded successfully",
        warning: "This feature is deprecated and will be removed in production"
      });
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
  app.post("/api/products", requireAuth, async (req, res) => {
    // Finance users cannot create products (only admin, moderator and regular users)
    if (req.user?.role === 'finance') {
      return res.status(403).json({ message: "Forbidden: Finance users cannot create products" });
    }

    try {
      console.log("Offer data received:", JSON.stringify(req.body, null, 2));
      const parseResult = insertOfferSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.error("Offer validation error:", JSON.stringify(parseResult.error.format(), null, 2));
        return res.status(400).json({ 
          message: "Invalid offer data", 
          errors: parseResult.error.format() 
        });
      }
      
      const offer = await storage.createOffer(parseResult.data);
      res.status(201).json(offer);
    } catch (error) {
      console.error("Error creating offer:", error);
      res.status(500).json({ message: "Failed to create offer" });
    }
  });
  
  // Bulk import products
  app.post("/api/products/bulk-import", requireModerator, async (req, res) => {
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
        const parseResult = insertOfferSchema.safeParse(productData);
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
          const offer = await storage.createOffer(productData);
          // Only include essential offer info to avoid large responses
          importedProducts.push({
            id: offer.id,
            name: offer.name,
            category: offer.category
          });
        } catch (error) {
          console.error("Error importing product:", error);
          invalidProducts.push({
            data: {
              name: productData.name || 'Unknown',
              category: productData.category || 'Unknown'
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
  app.put("/api/products/:id", requireAuth, async (req, res) => {
    // Finance users cannot update products (only admin, moderator and regular users)
    if (req.user?.role === 'finance') {
      return res.status(403).json({ message: "Forbidden: Finance users cannot update products" });
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
    // Finance users cannot delete products (only admin and regular users)
    if (req.user?.role === 'finance') {
      return res.status(403).json({ message: "Forbidden: Finance users cannot delete products" });
    }
    
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
      const isModerator = req.user.role === 'moderator';
      const hasAdminAccess = isAdmin || isModerator;
      
      // If admin/moderator and specifically requests all orders, don't filter by userId
      const orders = hasAdminAccess ? await storage.getAllOrders() : await storage.getAllOrders(userId);
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
      
      // Check if this order belongs to the authenticated user (or if user is admin/moderator)
      const isAdmin = req.user.role === 'admin';
      const isModerator = req.user.role === 'moderator';
      const hasAdminAccess = isAdmin || isModerator;
      if (order.userId !== req.user.id && !hasAdminAccess) {
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

  // Update order status - only admin or finance users can update
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
      
      // Check if user has admin, moderator, or finance role
      const isAdmin = req.user.role === 'admin';
      const isFinance = req.user.role === 'finance';
      const isModerator = req.user.role === 'moderator';
      
      // Only admin, moderator, or finance users can update order status
      if (!isAdmin && !isFinance && !isModerator) {
        return res.status(403).json({ message: "Forbidden: Only admin, moderator, or finance users can update order status" });
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
      const isFinance = req.user.role === 'finance';
      const isModerator = req.user.role === "moderator";
      const hasSupervisorAccess = isAdmin || isFinance || isModerator;
      
      console.log(`Fetching dashboard metrics for user ID ${userId}, isAdmin: ${isAdmin}, isFinance: ${isFinance}`);
      
      // Get total products count (all for admin/finance, user-created for regular users)
      let productsQuery = db.select().from(products);
      if (!hasSupervisorAccess) {
        productsQuery = productsQuery.where(eq(products.userId, userId));
      }
      const productsList = await productsQuery;
      
      // Get orders data (all for admin/finance, user's orders for regular users)
      let ordersQuery = db.select().from(orders);
      if (!hasSupervisorAccess) {
        ordersQuery = ordersQuery.where(eq(orders.userId, userId));
      }
      const ordersList = await ordersQuery;
      
      console.log(`Dashboard orders for user ${userId} (isAdmin: ${isAdmin}):`, 
                 `Total orders: ${ordersList.length}`,
                 `First few orders user_ids:`, ordersList.slice(0, 3).map(o => o.userId));
      
      // Calculate revenue from confirmed sales
      const saleOrders = ordersList.filter(order => order.status === 'sale');
      const totalRevenue = saleOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      
      // Calculate total payouts from confirmed sales
      const totalPayout = saleOrders.reduce((sum, order) => sum + (order.payout || 0), 0);
      
      // Get recent orders (limit to 5)
      let recentOrdersQuery = db.select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(5);
        
      if (!hasSupervisorAccess) {
        recentOrdersQuery = recentOrdersQuery.where(eq(orders.userId, userId));
      }
      
      const recentOrders = await recentOrdersQuery;
      
      // Get lead counts by status
      const saleCount = ordersList.filter(order => order.status === 'sale').length;
      const holdCount = ordersList.filter(order => order.status === 'hold').length;
      const rejectedCount = ordersList.filter(order => order.status === 'rejected').length;
      const trashCount = ordersList.filter(order => order.status === 'trash').length;
      
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
          
          // For confirmed sales, count the quantity of items sold
          if (order.status === 'sale') {
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
            // Ensure null, undefined, or empty strings are converted to "Uncategorized"
            const category = (product.category && product.category.trim()) ? product.category.trim() : 'Uncategorized';
            if (!productCategories[category]) {
              productCategories[category] = 0;
            }
            productCategories[category] += 1;
          });
        } else {
          // If no products in orders, create default category
          productCategories['Uncategorized'] = 1;
        }
      } else {
        // Process products created by the user
        productsList.forEach(product => {
          // Ensure null, undefined, or empty strings are converted to "Uncategorized"
          const category = (product.category && product.category.trim()) ? product.category.trim() : 'Uncategorized';
          if (!productCategories[category]) {
            productCategories[category] = 0;
          }
          productCategories[category] += 1;
        });
      }
      
      // If after all there are no categories, ensure there's at least one
      if (Object.keys(productCategories).length === 0) {
        productCategories['Uncategorized'] = 1;
      }
      
      // Convert to array for chart
      const productCategoriesData = Object.entries(productCategories).map(([name, value]) => ({
        name,
        value
      }));
      
      res.json({
        totalProducts: productsList.length,
        totalOrders: ordersList.length,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalPayout: parseFloat(totalPayout.toFixed(2)),
        recentOrders,
        orderStatus: {
          sale: saleCount,
          hold: holdCount,
          rejected: rejectedCount,
          trash: trashCount,
          total: ordersList.length
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
      const isFinance = req.user.role === 'finance';
      const isModerator = req.user.role === "moderator";
      // Los moderadores no tienen acceso a las transacciones del wallet
      const hasSupervisorAccess = isAdmin || isFinance;
      
      let userTransactions = [];
      
      if (hasSupervisorAccess) {
        // Admin and Finance users see all transactions
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
      const isFinance = req.user.role === 'finance';
      const hasSupervisorAccess = isAdmin || isFinance;
      
      let balance = 0;
      console.log(`Fetching balance for user ID ${userId}, role: ${req.user.role}, is supervisor: ${hasSupervisorAccess}`);
      
      if (hasSupervisorAccess) {
        // Admin and Finance users see total balance of all users
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
        console.log(`Admin/Finance balance calculation: Orders total: ${ordersTotal}, Withdrawals total: ${withdrawalsTotal}, Final balance: ${balance}`);
      } else {
        // Regular users see only their balance
        balance = await storage.getUserBalance(userId);
        console.log(`Regular user balance for user ${userId}: ${balance}`);
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
      const { amount, walletAddress, walletId, walletName } = req.body;
      
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
      
      // Format wallet description
      const walletDescription = walletName ? `${walletName} (${walletAddress.substring(0, 8)}...)` : walletAddress;
      
      // Create withdrawal transaction (negative amount)
      const withdrawal: InsertTransaction = {
        type: "withdrawal",
        amount: -Math.abs(amount), // Ensure amount is negative
        status: "pending",
        description: `Withdrawal to ${walletDescription}`,
        reference: `WIT${Date.now().toString().slice(-6)}`,
        settings: {
          walletAddress,
          walletId,
          walletName
        }
      };
      
      const transaction = await storage.createTransaction(withdrawal, userId);
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });
  
  // Update user wallet address (Legacy endpoint - maintaining for backwards compatibility)
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
      
      // Convert to new wallet format if user doesn't have wallets array yet
      if (!settings.wallets || !Array.isArray(settings.wallets)) {
        settings.wallets = [{
          id: "default",
          name: "Principal",
          address: walletAddress,
          isDefault: true
        }];
      } else {
        // Update default wallet address if it exists
        const defaultWalletIndex = settings.wallets.findIndex(w => w.isDefault);
        if (defaultWalletIndex >= 0) {
          settings.wallets[defaultWalletIndex].address = walletAddress;
        } else if (settings.wallets.length > 0) {
          // Set first wallet as default and update address
          settings.wallets[0].address = walletAddress;
          settings.wallets[0].isDefault = true;
        } else {
          // Create new wallet if array is empty
          settings.wallets.push({
            id: "default",
            name: "Principal",
            address: walletAddress,
            isDefault: true
          });
        }
      }
      
      // Keep legacy walletAddress for backwards compatibility
      settings.walletAddress = walletAddress;
      
      const updatedUser = await storage.updateUser(userId, { settings });
      
      res.json({ success: true, walletAddress, wallets: settings.wallets });
    } catch (error) {
      console.error("Error updating wallet address:", error);
      res.status(500).json({ message: "Failed to update wallet address" });
    }
  });
  
  // Get user wallet address (Legacy endpoint - maintaining for backwards compatibility)
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
      
      let walletAddress = user.settings?.walletAddress || '';
      let wallets: Array<{id: string; name: string; address: string; isDefault?: boolean}> = [];
      
      // Get wallet info from settings
      if (user.settings?.wallets && Array.isArray(user.settings.wallets)) {
        wallets = user.settings.wallets;
        
        // If no legacy walletAddress but has wallets, use default wallet address
        if (!walletAddress && wallets.length > 0) {
          const defaultWallet = wallets.find(w => w.isDefault);
          if (defaultWallet) {
            walletAddress = defaultWallet.address;
          } else {
            walletAddress = wallets[0].address;
          }
        }
      } 
      // Create a default wallet structure if there's a legacy walletAddress but no wallets array
      else if (walletAddress) {
        wallets = [{
          id: "default",
          name: "Principal",
          address: walletAddress,
          isDefault: true
        }];
      }
      
      res.json({ walletAddress, wallets });
    } catch (error) {
      console.error("Error fetching wallet address:", error);
      res.status(500).json({ message: "Failed to fetch wallet address" });
    }
  });
  
  // Update current user profile (only for the logged in user)
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const userData = req.body;
      
      console.log("PATCH /api/user/profile received:", {
        userId,
        userData,
        userDataType: typeof userData,
        userDataKeys: Object.keys(userData)
      });
      
      // Validate userData is an object with properties
      if (!userData || typeof userData !== 'object' || Object.keys(userData).length === 0) {
        console.error("Invalid userData received:", userData);
        return res.status(400).json({ 
          message: "Invalid request data", 
          details: "Request body must contain at least one field to update"
        });
      }
      
      // Only allow updating fullName and settings (prevent changing email, username, role, etc.)
      const allowedUpdates: Record<string, any> = {};
      
      if (userData.fullName !== undefined) {
        allowedUpdates.fullName = userData.fullName;
      }
      
      if (userData.settings !== undefined) {
        // Get current user to merge settings properly
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Merge existing settings with new settings
        allowedUpdates.settings = {
          ...(user.settings || {}),
          ...(userData.settings || {})
        };
      }
      
      if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({ 
          message: "No valid fields to update", 
          details: "Only fullName and settings can be updated"
        });
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, allowedUpdates);
      if (!updatedUser) {
        console.error(`Failed to update user with ID ${userId}`);
        return res.status(500).json({ message: "Failed to update user profile" });
      }
      
      console.log("Updated user profile:", updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Error updating user profile", error: errorMessage });
    }
  });
  
  // Change password for current user
  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Verify current user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password (this would need to be implemented in auth.ts)
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user with new password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Error changing password", error: errorMessage });
    }
  });
  
  // Update transaction status (admin only)
  app.patch("/api/wallet/transactions/:id/status", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is admin or finance - moderators cannot approve payments
      if (req.user.role !== "admin" && req.user.role !== "finance") {
        return res.status(403).json({ message: "Forbidden. Admin or Finance access required for payment approval." });
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
      const isFinance = req.user.role === "finance";
      const hasSupervisorAccess = isAdmin || isFinance;
      
      // Get all transactions for the user
      const userTransactions = await storage.getUserTransactions(userId);
      
      // Find the specific transaction
      const transaction = userTransactions.find(t => t.id === transactionId);
      
      // If admin or finance, allow access to any transaction
      if (hasSupervisorAccess && !transaction) {
        // Admin or finance users can get any transaction, so try to get it directly from DB
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
  
  // -----------------------------------------------
  // API KEY MANAGEMENT AND API ENDPOINTS
  // -----------------------------------------------
  
  // Get current user's API key
  app.get("/api/user/api-key", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ apiKey: user.apiKey || null });
    } catch (error) {
      console.error("Error fetching API key:", error);
      res.status(500).json({ message: "Failed to fetch API key" });
    }
  });
  
  // Generate new API key for current user
  app.post("/api/user/api-key", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const apiKey = await storage.generateApiKey(userId);
      
      res.json({ apiKey });
    } catch (error) {
      console.error("Error generating API key:", error);
      res.status(500).json({ message: "Failed to generate API key" });
    }
  });
  
  // API endpoint for order ingestion (requires API key)
  app.post("/api/external/orders", requireApiKey, async (req, res) => {
    try {
      // Validate the request body against the API order schema
      const parseResult = apiOrderSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid order data", 
          errors: parseResult.error.format() 
        });
      }
      
      const orderData = parseResult.data;
      
      // Check if the product exists
      const product = await storage.getProduct(orderData.productId);
      
      if (!product) {
        return res.status(404).json({ 
          success: false,
          message: "Product not found" 
        });
      }
      
      // Create order with user ID from API key
      const userId = req.user.id;
      
      // Generate a unique order number with timestamp
      const orderNumber = `ORD-${Date.now()}-${userId}`;
      
      // Use product price instead of provided salePrice (business rule)
      const finalPrice = product.price;
      const quantity = orderData.quantity || 1;
      
      // Build shipping address from components
      const addressParts = [
        orderData.customerAddress,
        orderData.postalCode,
        orderData.city,
        orderData.province
      ].filter(Boolean);
      
      const shippingAddress = addressParts.length > 0 
        ? addressParts.join(', ') 
        : "No shipping address provided";
      
      // Create the order using storage
      const order = await storage.createOrder({
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail || null,
        customerPhone: orderData.customerPhone,
        shippingAddress: shippingAddress,
        status: "pending",
        totalAmount: finalPrice * quantity,
        notes: orderData.notes || null,
        orderNumber: orderNumber
      }, userId);
      
      // Add order item
      await storage.addOrderItem({
        orderId: order.id,
        productId: orderData.productId,
        quantity: quantity,
        price: finalPrice,  // Always use product's configured price
        subtotal: finalPrice * quantity
      });
      
      res.status(201).json({ 
        success: true,
        message: "Order created successfully",
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt
        }
      });
    } catch (error) {
      console.error("Error creating order via API:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create order" 
      });
    }
  });
  
  // API endpoint for order status (requires API key)
  app.get("/api/external/orders/:orderNumber/status", requireApiKey, async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const userId = req.user.id;
      
      // Query the database for the order
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .limit(1);
      
      if (!order) {
        return res.status(404).json({ 
          success: false,
          message: "Order not found" 
        });
      }
      
      // Check if the order belongs to the user associated with the API key
      if (order.userId !== userId) {
        return res.status(403).json({ 
          success: false,
          message: "You do not have permission to access this order" 
        });
      }
      
      // Get order items
      const orderItems = await storage.getOrderItems(order.id);
      
      res.json({ 
        success: true,
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal
          }))
        }
      });
    } catch (error) {
      console.error("Error fetching order status via API:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch order status" 
      });
    }
  });
  
  // Get user connections
  app.get("/api/connections", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Finance users cannot access connections
      if (req.user.role === 'finance') {
        return res.status(403).json({ message: "Forbidden: Finance users cannot access connections" });
      }
      
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const isModerator = req.user.role === 'moderator';
      const hasAdminAccess = isAdmin || isModerator;
      const showAll = req.query.all === 'true' && hasAdminAccess;
      
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
      
      // Finance users cannot create connections
      if (req.user.role === 'finance') {
        return res.status(403).json({ message: "Forbidden: Finance users cannot manage connections" });
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
      
      // Finance users cannot update connections
      if (req.user.role === 'finance') {
        return res.status(403).json({ message: "Forbidden: Finance users cannot manage connections" });
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
      const isModerator = req.user.role === "moderator";
      const isAdmin = req.user.role === "admin";
      const hasAdminAccess = isAdmin || isModerator;
      
      if (connection.userId !== req.user.id && !hasAdminAccess) {
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
      
      // Finance users cannot delete connections
      if (req.user.role === 'finance') {
        return res.status(403).json({ message: "Forbidden: Finance users cannot manage connections" });
      }
      
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Check if this connection belongs to the authenticated user or if user is an admin/moderator
      const isModerator = req.user.role === 'moderator';
      const isAdmin = req.user.role === 'admin';
      const hasAdminAccess = isAdmin || isModerator;
      
      if (connection.userId !== req.user.id && !hasAdminAccess) {
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
  
  // Team management endpoints - Accessible to admin and finance users
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      // Ensure user is admin, finance or moderator
      if (req.user?.role !== "admin" && req.user?.role !== "finance" && req.user?.role !== "moderator") {
        return res.status(403).json({ message: "Forbidden: Admin or Finance access required" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send("Error fetching users");
    }
  });
  
  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      // Ensure user is admin, finance or moderator
      if (req.user?.role !== "admin" && req.user?.role !== "finance" && req.user?.role !== "moderator") {
        return res.status(403).json({ message: "Forbidden: Admin or Finance access required" });
      }
      
      const userData = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }
      
      // Finance and Moderator users cannot create admin users
      if ((req.user.role === 'finance' || req.user.role === 'moderator') && userData.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Only admins can create admin users" });
      }
      
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).send("Error creating user");
    }
  });
  
  // PUT endpoint for updating users
  app.put("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Ensure user is admin, finance or moderator
      if (req.user?.role !== "admin" && req.user?.role !== "finance" && req.user?.role !== "moderator") {
        return res.status(403).json({ message: "Forbidden: Admin or Finance access required" });
      }
      
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      console.log("PUT /api/users/:id received with data:", userData);
      
      // Get the user to be updated
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Finance and Moderator users cannot modify admin users
      if ((req.user.role === "finance" || req.user.role === "moderator") && user.role === "admin") {
        return res.status(403).json({ message: "Forbidden: Only admins can modify admin users" });
      }
      
      // Prevent finance from changing a user to admin role
      if (req.user.role === "finance" || req.user.role === "moderator" && userData.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Only admins cannot create or modify admin users" });
      }
      
      // Prevent non-admin from changing an admin role
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
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Ensure user is admin, finance or moderator
      if (req.user?.role !== "admin" && req.user?.role !== "finance" && req.user?.role !== "moderator") {
        return res.status(403).json({ message: "Forbidden: Admin or Finance access required" });
      }
      
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      console.log("PATCH /api/users/:id received:", {
        userId,
        userData,
        userDataType: typeof userData,
        userDataKeys: Object.keys(userData)
      });
      
      // Validar que userData sea un objeto y tenga propiedades
      if (!userData || typeof userData !== 'object' || Object.keys(userData).length === 0) {
        console.error("Invalid userData received:", userData);
        return res.status(400).json({ 
          message: "Invalid request data", 
          details: "Request body must contain at least one field to update"
        });
      }
      
      // Get the user to be updated
      const user = await storage.getUser(userId);
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("Original user:", user);
      
      // Finance and Moderator users cannot modify admin users
      if ((req.user.role === "finance" || req.user.role === "moderator") && user.role === "admin") {
        return res.status(403).json({ message: "Forbidden: Only admins can modify admin users" });
      }
      
      // Prevent finance from changing a user to admin role
      if (req.user.role === "finance" || req.user.role === "moderator" && userData.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Only admins cannot create or modify admin users" });
      }
      
      // Prevent non-admin from changing an admin role
      if (user.role === "admin" && userData.role && userData.role !== "admin" && req.user?.role !== "admin") {
        console.error("Attempt to change admin role by non-admin");
        return res.status(403).json({ message: "Only admins can change admin roles" });
      }
      
      // Actualizar el usuario
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        console.error(`Failed to update user with ID ${userId}`);
        return res.status(500).json({ message: "Failed to update user" });
      }
      
      console.log("Updated user:", updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      // Con TypeScript error es de tipo unknown, hacer error.message puede causar problemas
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Error updating user", error: errorMessage });
    }
  });
  
  // Endpoint for resetting user password
  app.patch("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    try {
      // Ensure user is admin, finance or moderator
      if (req.user?.role !== "admin" && req.user?.role !== "finance" && req.user?.role !== "moderator") {
        return res.status(403).json({ message: "Forbidden: Admin or Finance access required" });
      }
      
      const userId = parseInt(req.params.id);
      const { password } = req.body;
      
      console.log(`PATCH /api/users/${userId}/reset-password received:`, {
        hasPassword: !!password,
        passwordLength: password ? password.length : 0,
        bodyKeys: Object.keys(req.body)
      });
      
      if (!password) {
        console.error("No password provided in request");
        return res.status(400).json({ message: "Password is required" });
      }
      
      // Get user to check if exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.error(`User with ID ${userId} not found for password reset`);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Finance and Moderator users cannot reset admin user passwords
      if (req.user.role === "finance" || req.user.role === "moderator" && user.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Only admins cannot reset admin user passwords" });
      }
      
      console.log(`Resetting password for user: ${user.username} (${userId})`);
      
      // Hash password before saving to database
      try {
        const hashedPassword = await hashPassword(password);
        console.log("Password hashed successfully");
        
        // Update user with new password
        const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
        if (!updatedUser) {
          console.error(`Failed to update password for user ${userId}`);
          return res.status(500).json({ message: "Failed to update user password" });
        }
        
        console.log(`Password reset successful for user ${userId}`);
        res.json({ message: "Password reset successfully" });
      } catch (hashError) {
        console.error("Error hashing password:", hashError);
        res.status(500).json({ 
          message: "Error hashing password", 
          error: hashError instanceof Error ? hashError.message : String(hashError)
        });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Error resetting password", error: errorMessage });
    }
  });
  
  // Configure multer for avatar uploads
  const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = './uploads/avatars';
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      // Use a unique filename to avoid collisions
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
  
  // File filter to only allow images
  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  };
  
  const upload = multer({ 
    storage: avatarStorage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    } 
  });
  
  // Upload avatar
  app.post("/api/user/avatar", requireAuth, upload.single('avatar'), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const userId = req.user.id;
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      
      // Get current user to check if they already have an avatar
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete the old avatar file if it exists
      if (currentUser.settings?.avatar) {
        const oldAvatarPath = path.join('.', currentUser.settings.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
      
      // Update the user with the new avatar URL
      const settings = {
        ...(currentUser.settings || {}),
        avatar: avatarUrl
      };
      
      const updatedUser = await storage.updateUser(userId, { settings });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't send password back to client
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });
  
  // Delete avatar
  app.delete("/api/user/avatar", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      
      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user has an avatar
      if (!currentUser.settings?.avatar) {
        return res.status(400).json({ message: "User does not have an avatar" });
      }
      
      // Delete the avatar file
      const avatarPath = path.join('.', currentUser.settings.avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
      
      // Update the user to remove the avatar URL
      const settings = {
        ...(currentUser.settings || {})
      };
      delete settings.avatar;
      
      const updatedUser = await storage.updateUser(userId, { settings });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't send password back to client
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error removing avatar:", error);
      res.status(500).json({ message: "Failed to remove avatar" });
    }
  });
  
  // Serve static files for uploads
  app.use('/uploads', express.static(path.join('.', 'uploads')));
  
  // === Email Verification & User Approval ===
  
  // Verificar email con token
  app.get("/api/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: "Token de verificación inválido" 
        });
      }
      
      const success = await verifyUserEmail(token);
      
      if (success) {
        return res.status(200).json({ 
          success: true, 
          message: "Email verificado correctamente. Tu cuenta está pendiente de aprobación por un administrador." 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: "Token inválido o expirado. Por favor solicita un nuevo token de verificación." 
        });
      }
    } catch (error) {
      console.error("Error al verificar email:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al procesar la verificación de email" 
      });
    }
  });
  
  // Activar cuenta de usuario (solo admin)
  app.post("/api/users/:userId/activate", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "ID de usuario inválido" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      if (user.status !== 'pending') {
        return res.status(400).json({ 
          message: `No se puede activar esta cuenta. Estado actual: ${user.status}` 
        });
      }
      
      const success = await activateUserAccount(userId);
      
      if (success) {
        res.status(200).json({ 
          success: true, 
          message: "Cuenta activada correctamente" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Error al activar la cuenta" 
        });
      }
    } catch (error) {
      console.error("Error al activar cuenta:", error);
      res.status(500).json({ message: "Error al activar cuenta de usuario" });
    }
  });
  
  // Ruta para solicitar un nuevo token de verificación (si el anterior expiró)
  app.post("/api/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: "El correo electrónico es obligatorio" 
        });
      }
      
      // Buscar usuario por email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      
      if (!user) {
        // Por seguridad, no revelamos si el email existe o no
        return res.status(200).json({ 
          success: true, 
          message: "Si tu correo está registrado, recibirás un email con las instrucciones para verificar tu cuenta." 
        });
      }
      
      // Solo reenviamos si el usuario está en estado de verificación de email
      if (user.status !== 'email_verification') {
        // Por seguridad, no revelamos el estado actual
        return res.status(200).json({ 
          success: true, 
          message: "Si tu correo está registrado, recibirás un email con las instrucciones para verificar tu cuenta." 
        });
      }
      
      // Generar nuevo token
      const { createVerificationData } = await import('./verification');
      const { sendVerificationEmail } = await import('./email');
      
      const verificationData = createVerificationData();
      
      // Actualizar usuario con nuevo token
      await db
        .update(users)
        .set({
          verificationToken: verificationData.token,
          verificationExpires: verificationData.expires
        })
        .where(eq(users.id, user.id));
      
      // Enviar email
      await sendVerificationEmail(email, verificationData.token);
      
      res.status(200).json({ 
        success: true, 
        message: "Si tu correo está registrado, recibirás un email con las instrucciones para verificar tu cuenta." 
      });
    } catch (error) {
      console.error("Error al reenviar verificación:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al procesar la solicitud" 
      });
    }
  });
  
  const httpServer = createServer(app);

  return httpServer;
}
