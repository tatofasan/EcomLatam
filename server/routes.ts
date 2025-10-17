import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { registerShopifyRoutes } from "./routes-shopify";
import { validateLead, formatValidationErrors } from "./leadValidation";
import { formatPhone } from "./phoneValidation";
import { checkDuplicateLeadToday } from "./leadDuplicateValidation";
import { postbackService } from "./postback";
import multer from "multer";
import path from "path";
import fs from "fs";
// Security middleware imports
import { apiLeadLimiter, strictLimiter, orderStatusLimiter } from "./middleware/rateLimiter";
import { validatePositiveInteger, sanitizeSettings, sanitizeCustomFields } from "./middleware/validators";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import {
  insertProductSchema,
  insertLeadSchema,
  insertLeadItemSchema,
  insertCampaignSchema,
  insertConnectionSchema,
  insertTransactionSchema,
  apiLeadSchema,
  apiLeadStatusSchema,
  apiLeadIngestSchema,
  insertTermsSchema,
  insertPayoutExceptionSchema,
  products,
  leads,
  leadItems,
  transactions,
  users,
  termsAndConditions,
  shopifyStores,
  payoutExceptions,
  type InsertTransaction,
  type ApiLead,
  type ApiLeadIngest,
  type InsertTerms,
  type InsertPayoutException
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, inArray, and, gte } from "drizzle-orm";
import { verifyUserEmail, activateUserAccount } from "./verification";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Register Shopify integration routes
  registerShopifyRoutes(app);

  // Middleware to ensure authentication for protected routes
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };
  
  // Middleware to authenticate using API key for API routes
  // SECURITY: Enhanced with status and email verification checks
  const requireApiKey = async (req: Request, res: Response, next: Function) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      // Log attempt without API key for security monitoring
      console.warn('[Security] API request without key:', {
        ip: req.ip,
        endpoint: req.path,
        timestamp: new Date().toISOString()
      });

      return res.status(401).json({
        success: false,
        message: "API key is required"
      });
    }

    const user = await storage.getUserByApiKey(apiKey);

    if (!user) {
      // Log invalid API key attempt
      console.warn('[Security] Invalid API key attempt:', {
        ip: req.ip,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        endpoint: req.path,
        timestamp: new Date().toISOString()
      });

      return res.status(401).json({
        success: false,
        message: "Invalid API key"
      });
    }

    // SECURITY FIX: Verify user account status
    if (user.status !== 'active') {
      console.warn('[Security] Inactive user API attempt:', {
        userId: user.id,
        username: user.username,
        status: user.status,
        endpoint: req.path,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. API access denied.`
      });
    }

    // SECURITY FIX: Verify email is verified
    if (!user.isEmailVerified) {
      console.warn('[Security] Unverified email API attempt:', {
        userId: user.id,
        username: user.username,
        email: user.email,
        endpoint: req.path,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        message: "Email not verified. API access denied."
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
      
      // Crear un lead de ayer con actividad hoy
      const [specialLead] = await db
        .insert(leads)
        .values({
          leadNumber: `LEAD-${Date.now().toString().slice(-4)}`,
          userId: userId,
          customerName: "Test Customer",
          customerEmail: "test@example.com",
          customerPhone: "123-456-7890",
          customerAddress: "Test Address, Test City",
          status: "sale", // Estado válido para leads
          quality: "standard",
          value: "199.99",
          payout: "20.00",
          notes: "Lead de prueba (ayer-hoy)",
          isConverted: true,
          postbackSent: false,
          createdAt: yesterday,
          updatedAt: today
        })
        .returning();
      
      // Agregar un item al lead
      const [offer] = await db.select().from(products).limit(1);
      if (offer) {
        await db.insert(leadItems).values({
          leadId: specialLead.id,
          productName: offer.name,
          quantity: 1,
          price: offer.price,
          total: offer.price
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
  // SECURITY FIX: Added ownership verification and integer validation
  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      // Validate product ID is a positive integer
      const productId = validatePositiveInteger(req.params.id, 'Product ID');

      const product = await storage.getProduct(productId);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // SECURITY FIX: Verify ownership or admin access
      const isOwner = product.userId === req.user?.id;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'moderator';

      if (!isOwner && !isAdmin) {
        console.warn('[Security] Unauthorized product access attempt:', {
          userId: req.user?.id,
          productId,
          productOwner: product.userId,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          message: "You do not have permission to view this product"
        });
      }

      res.json(product);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.includes('Product ID')) {
        return res.status(400).json({ message: error.message });
      }

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
      const parseResult = insertProductSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.error("Offer validation error:", JSON.stringify(parseResult.error.format(), null, 2));
        return res.status(400).json({ 
          message: "Invalid offer data", 
          errors: parseResult.error.format() 
        });
      }
      
      const offer = await storage.createProduct(parseResult.data);
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
        const parseResult = insertProductSchema.safeParse(productData);
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
          const offer = await storage.createProduct(productData);
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
  // SECURITY FIX: Added ownership verification and integer validation
  app.put("/api/products/:id", requireAuth, async (req, res) => {
    // Finance users cannot update products (only admin, moderator and regular users)
    if (req.user?.role === 'finance') {
      return res.status(403).json({ message: "Forbidden: Finance users cannot update products" });
    }

    try {
      // Validate product ID is a positive integer
      const productId = validatePositiveInteger(req.params.id, 'Product ID');

      // SECURITY FIX: Verify that the product exists and check ownership
      const existingProduct = await storage.getProduct(productId);

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      // SECURITY FIX: Ownership verification
      const isOwner = existingProduct.userId === req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        console.warn('[Security] Unauthorized product update attempt:', {
          userId: req.user?.id,
          productId,
          productOwner: existingProduct.userId,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          message: "You do not have permission to update this product"
        });
      }

      // Validate product data
      const parseResult = insertProductSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid product data",
          errors: parseResult.error.format()
        });
      }

      // SECURITY FIX: Prevent userId manipulation (mass assignment protection)
      const safeData = { ...parseResult.data };
      delete (safeData as any).userId; // Never allow changing the owner

      const product = await storage.updateProduct(productId, safeData);

      res.json(product);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.includes('Product ID')) {
        return res.status(400).json({ message: error.message });
      }

      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Delete a product
  // SECURITY FIX: Added ownership verification and integer validation
  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    // Finance users cannot delete products (only admin and regular users)
    if (req.user?.role === 'finance') {
      return res.status(403).json({ message: "Forbidden: Finance users cannot delete products" });
    }

    try {
      // Validate product ID is a positive integer
      const productId = validatePositiveInteger(req.params.id, 'Product ID');

      // SECURITY FIX: Verify that the product exists and check ownership
      const existingProduct = await storage.getProduct(productId);

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      // SECURITY FIX: Ownership verification
      const isOwner = existingProduct.userId === req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        console.warn('[Security] Unauthorized product deletion attempt:', {
          userId: req.user?.id,
          productId,
          productOwner: existingProduct.userId,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          message: "You do not have permission to delete this product"
        });
      }

      const success = await storage.deleteProduct(productId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete product" });
      }

      res.status(204).send();
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.includes('Product ID')) {
        return res.status(400).json({ message: error.message });
      }

      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // ==================== PAYOUT EXCEPTIONS ROUTES ====================

  // GET /api/payout-exceptions - Get payout exceptions with optional filters
  // Admin/Moderator: can view all exceptions
  // Finance: can view all exceptions (read-only)
  // Affiliate: can only view their own exceptions
  app.get("/api/payout-exceptions", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { productId, userId, publisherId } = req.query;
      const userRole = req.user.role;
      const currentUserId = req.user.id;

      // Parse query parameters
      const filters: { productId?: number; userId?: number; publisherId?: string } = {};

      if (productId) {
        const parsed = parseInt(productId as string, 10);
        if (isNaN(parsed)) {
          return res.status(400).json({ message: "Invalid productId parameter" });
        }
        filters.productId = parsed;
      }

      if (userId) {
        const parsed = parseInt(userId as string, 10);
        if (isNaN(parsed)) {
          return res.status(400).json({ message: "Invalid userId parameter" });
        }
        filters.userId = parsed;
      }

      if (publisherId) {
        filters.publisherId = publisherId as string;
      }

      // Role-based access control
      // SECURITY: Affiliates (role='user') can ONLY see their own exceptions
      if (userRole === 'user') {
        // Force userId to be the current user - affiliates cannot query other users
        filters.userId = currentUserId;
      } else if (userRole === 'admin' || userRole === 'moderator' || userRole === 'finance') {
        // Admin/Moderator/Finance can filter by userId if provided
        // If userId filter is provided, use it; otherwise show all
      } else {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }

      const exceptions = await storage.getPayoutExceptions(
        filters.productId,
        filters.userId,
        filters.publisherId
      );

      res.json(exceptions);
    } catch (error) {
      console.error("Error fetching payout exceptions:", error);
      res.status(500).json({ message: "Failed to fetch payout exceptions" });
    }
  });

  // POST /api/payout-exceptions - Create new payout exception
  // Only Admin/Moderator can create exceptions
  app.post("/api/payout-exceptions", requireModerator, async (req, res) => {
    try {
      // Validate request body
      const validationResult = insertPayoutExceptionSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid payout exception data",
          errors: validationResult.error.errors
        });
      }

      const exceptionData = validationResult.data;

      // Verify product exists
      const product = await storage.getProduct(exceptionData.productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Verify user exists
      const user = await storage.getUser(exceptionData.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check for duplicate exception (same productId + userId + publisherId combination)
      const existingExceptions = await storage.getPayoutExceptions(
        exceptionData.productId,
        exceptionData.userId,
        exceptionData.publisherId || undefined
      );

      if (existingExceptions.length > 0) {
        return res.status(409).json({
          message: "A payout exception already exists for this combination of product, user, and publisher"
        });
      }

      const created = await storage.createPayoutException(exceptionData);

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating payout exception:", error);
      res.status(500).json({ message: "Failed to create payout exception" });
    }
  });

  // PUT /api/payout-exceptions/:id - Update payout exception
  // Only Admin/Moderator can update exceptions
  app.put("/api/payout-exceptions/:id", requireModerator, async (req, res) => {
    try {
      const exceptionId = validatePositiveInteger(req.params.id, 'Exception ID');

      // Verify exception exists
      const existing = await storage.getPayoutException(exceptionId);
      if (!existing) {
        return res.status(404).json({ message: "Payout exception not found" });
      }

      // Validate update data
      const validationResult = insertPayoutExceptionSchema.partial().safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid payout exception data",
          errors: validationResult.error.errors
        });
      }

      const updateData = validationResult.data;

      // If productId is being changed, verify it exists
      if (updateData.productId !== undefined) {
        const product = await storage.getProduct(updateData.productId);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
      }

      // If userId is being changed, verify it exists
      if (updateData.userId !== undefined) {
        const user = await storage.getUser(updateData.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
      }

      const updated = await storage.updatePayoutException(exceptionId, updateData);

      if (!updated) {
        return res.status(500).json({ message: "Failed to update payout exception" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Exception ID')) {
        return res.status(400).json({ message: error.message });
      }

      console.error("Error updating payout exception:", error);
      res.status(500).json({ message: "Failed to update payout exception" });
    }
  });

  // DELETE /api/payout-exceptions/:id - Delete payout exception
  // Only Admin/Moderator can delete exceptions
  app.delete("/api/payout-exceptions/:id", requireModerator, async (req, res) => {
    try {
      const exceptionId = validatePositiveInteger(req.params.id, 'Exception ID');

      // Verify exception exists
      const existing = await storage.getPayoutException(exceptionId);
      if (!existing) {
        return res.status(404).json({ message: "Payout exception not found" });
      }

      const success = await storage.deletePayoutException(exceptionId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete payout exception" });
      }

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Exception ID')) {
        return res.status(400).json({ message: error.message });
      }

      console.error("Error deleting payout exception:", error);
      res.status(500).json({ message: "Failed to delete payout exception" });
    }
  });

  // GET /api/calculate-payout - Calculate payout for a specific combination
  // All authenticated users can calculate payouts
  app.get("/api/calculate-payout", requireAuth, async (req, res) => {
    try {
      const { productId, userId, publisherId } = req.query;

      // Validate required parameters
      if (!productId || !userId) {
        return res.status(400).json({
          message: "Missing required parameters: productId and userId are required"
        });
      }

      const parsedProductId = parseInt(productId as string, 10);
      const parsedUserId = parseInt(userId as string, 10);

      if (isNaN(parsedProductId) || isNaN(parsedUserId)) {
        return res.status(400).json({
          message: "Invalid parameters: productId and userId must be valid integers"
        });
      }

      // Verify product exists
      const product = await storage.getProduct(parsedProductId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Verify user exists
      const user = await storage.getUser(parsedUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate payout using hierarchical logic
      const payoutAmount = await storage.calculatePayoutAmount(
        parsedProductId,
        parsedUserId,
        publisherId as string | undefined
      );

      res.json({
        productId: parsedProductId,
        userId: parsedUserId,
        publisherId: publisherId || null,
        payoutAmount
      });
    } catch (error) {
      console.error("Error calculating payout:", error);
      res.status(500).json({ message: "Failed to calculate payout" });
    }
  });

  // ==================== END PAYOUT EXCEPTIONS ROUTES ====================

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

      // Map orders to include totalAmount field from value and shippingAddress from customerAddress
      const mappedOrders = orders.map(order => ({
        ...order,
        totalAmount: parseFloat(order.value || '0'),
        shippingAddress: order.customerAddress || ''
      }));

      res.json(mappedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get Shopify orders from last 7 days
  app.get("/api/orders/shopify/recent", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;

      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get all leads from the last 7 days where utmSource is 'shopify'
      const shopifyLeads = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.userId, userId),
            gte(leads.createdAt, sevenDaysAgo)
          )
        )
        .orderBy(desc(leads.createdAt));

      // Filter only Shopify orders (those with utmSource = 'shopify' or leadNumber starts with 'SHOPIFY-')
      const shopifyOrders = shopifyLeads.filter(lead =>
        lead.utmSource === 'shopify' || lead.leadNumber?.startsWith('SHOPIFY-')
      );

      // Get items for each order
      const ordersWithItems = await Promise.all(
        shopifyOrders.map(async (order) => {
          const items = await storage.getLeadItems(order.id);
          return {
            ...order,
            totalAmount: parseFloat(order.value || '0'),
            items: items.map(item => ({
              id: item.id,
              orderId: item.leadId,
              productName: item.productName,
              quantity: item.quantity || 1,
              price: parseFloat(item.price || '0'),
              subtotal: parseFloat(item.total || '0')
            }))
          };
        })
      );

      res.json({
        orders: ordersWithItems,
        count: ordersWithItems.length,
        dateRange: {
          from: sevenDaysAgo.toISOString(),
          to: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error fetching Shopify orders:", error);
      res.status(500).json({ message: "Failed to fetch Shopify orders" });
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

      // Map the items to ensure correct field names and types for the frontend
      const mappedItems = items.map(item => ({
        id: item.id,
        orderId: item.leadId,
        productId: item.id, // Using item id as productId since leadItems doesn't have productId
        productName: item.productName,
        quantity: item.quantity || 1,
        price: parseFloat(item.price || '0'),
        subtotal: parseFloat(item.total || '0') // Map 'total' field to 'subtotal' for frontend
      }));

      // Map order fields to match frontend expectations
      const mappedOrder = {
        ...order,
        totalAmount: parseFloat(order.value || '0'), // Map 'value' to 'totalAmount' and convert to number
        shippingAddress: order.customerAddress || '', // Map 'customerAddress' to 'shippingAddress'
        customerCity: order.customerCity || null, // Include city for shipping info
        customerCountry: order.customerCountry || null, // Include country for shipping info
        payout: order.payout || '0', // Include payout
        items: mappedItems
      };

      res.json(mappedOrder);
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

      const parseResult = insertLeadSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid order data",
          errors: parseResult.error.format()
        });
      }

      const userId = req.user.id;
      const orderData = parseResult.data;

      // Calculate payout if productId is provided
      // This ensures the payout is frozen at lead creation time
      let calculatedPayout: string | undefined;
      if (orderData.productId) {
        const payoutAmount = await storage.calculatePayoutAmount(
          orderData.productId,
          userId,
          orderData.publisherId || undefined
        );
        calculatedPayout = payoutAmount.toString();
      }

      // Validate and format phone number if provided
      let phoneData = {
        customerPhone: orderData.customerPhone,
        customerPhoneOriginal: orderData.customerPhone,
        customerPhoneFormatted: null
      };

      if (orderData.customerPhone) {
        const phoneValidation = await formatPhone(
          orderData.customerPhone,
          'AR',
          req.user.username || 'manual',
          'manual-entry'
        );

        phoneData = {
          customerPhone: phoneValidation.formattedPhone || phoneValidation.originalPhone,
          customerPhoneOriginal: phoneValidation.originalPhone,
          customerPhoneFormatted: phoneValidation.formattedPhone
        };

        // Check for duplicate phone number today
        // SECURITY FIX: Pass both formatted and original phone for enhanced duplicate detection
        const duplicateCheck = await checkDuplicateLeadToday(
          phoneValidation.formattedPhone,
          phoneValidation.originalPhone
        );

        if (duplicateCheck.isDuplicate) {
          // If duplicate found, mark as trash automatically
          orderData.status = "trash";
          orderData.notes = `Lead duplicado - mismo número de teléfono ya ingresado hoy. Lead original: ${duplicateCheck.duplicateLead?.leadNumber}`;

          console.warn(`[Manual Order Creation] Order marked as TRASH due to duplicate phone:`, {
            phone: phoneValidation.formattedPhone,
            originalLead: duplicateCheck.duplicateLead?.leadNumber
          });
        }
      }

      const order = await storage.createOrder({
        ...orderData,
        ...phoneData,
        ...(calculatedPayout && { payout: calculatedPayout })
      }, userId);
      
      // Handle order items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const itemData = {
            leadId: order.id,
            productName: item.productName || `Product #${item.productId}`,
            quantity: item.quantity,
            price: item.price.toString(),
            total: (item.price * item.quantity).toString()
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
  // SECURITY FIX: Added rate limiting (30 updates per minute)
  app.patch("/api/orders/:id/status", requireAuth, orderStatusLimiter, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orderId = parseInt(req.params.id);
      const { status } = req.body;

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if the status is valid - using lead status values
      if (!['sale', 'hold', 'rejected', 'trash'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value. Valid values are: sale, hold, rejected, trash" });
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

      const oldStatus = order.status;
      const updatedOrder = await storage.updateOrderStatus(orderId, status);

      // Send postback notification if status changed
      if (updatedOrder && oldStatus !== status) {
        try {
          await postbackService.sendPostback(updatedOrder, oldStatus);
        } catch (postbackError) {
          console.error("Error sending postback:", postbackError);
          // Don't fail the request if postback fails - it's logged in the database
        }
      }

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
      
      // Get total offers count (all for admin/finance, user-created for regular users)
      let offersList;
      if (hasSupervisorAccess) {
        offersList = await db.select().from(products);
      } else {
        offersList = await db.select().from(products).where(eq(products.userId, userId));
      }
      
      // Get leads data (all for admin/finance, user's leads for regular users)
      let leadsList;
      if (hasSupervisorAccess) {
        leadsList = await db.select().from(leads);
      } else {
        leadsList = await db.select().from(leads).where(eq(leads.userId, userId));
      }
      
      console.log(`Dashboard leads for user ${userId} (isAdmin: ${isAdmin}):`, 
                 `Total leads: ${leadsList.length}`,
                 `First few leads user_ids:`, leadsList.slice(0, 3).map(l => l.userId));
      
      // Calculate revenue from confirmed sales
      const saleLeads = leadsList.filter(lead => lead.status === 'sale');
      const totalRevenue = saleLeads.reduce((sum, lead) => sum + parseFloat(lead.value || '0'), 0);

      // Calculate total payout from confirmed sales
      const totalPayout = saleLeads.reduce((sum, lead) => sum + parseFloat(lead.payout || '0'), 0);
      
      // Get recent leads (limit to 5)
      let recentLeadsRaw;
      if (hasSupervisorAccess) {
        recentLeadsRaw = await db.select()
          .from(leads)
          .orderBy(desc(leads.createdAt))
          .limit(5);
      } else {
        recentLeadsRaw = await db.select()
          .from(leads)
          .where(eq(leads.userId, userId))
          .orderBy(desc(leads.createdAt))
          .limit(5);
      }
      
      // Format recent leads to match frontend expectations
      const recentLeads = recentLeadsRaw.map(lead => ({
        id: lead.id,
        leadNumber: lead.leadNumber || `LEAD-${lead.id}`,
        customerName: lead.customerName || 'Unknown Customer',
        value: lead.value || '0',
        status: lead.status || 'pending',
        createdAt: lead.createdAt ? lead.createdAt.toISOString() : new Date().toISOString()
      }));
      
      // Get lead counts by status
      const saleCount = leadsList.filter(lead => lead.status === 'sale').length;
      const holdCount = leadsList.filter(lead => lead.status === 'hold').length;
      const rejectedCount = leadsList.filter(lead => lead.status === 'rejected').length;
      const trashCount = leadsList.filter(lead => lead.status === 'trash').length;

      // Generate real sales data for the chart (last 6 months)
      const currentDate = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const salesDataByMonth = new Map<string, { sales: number; orders: number }>();

      // Initialize last 6 months with zero values
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthNames[date.getMonth()];
        salesDataByMonth.set(monthKey, { sales: 0, orders: 0 });
      }

      // Count real sales and orders per month
      leadsList.forEach(lead => {
        if (lead.createdAt) {
          const leadDate = new Date(lead.createdAt);
          const monthKey = `${leadDate.getFullYear()}-${String(leadDate.getMonth() + 1).padStart(2, '0')}`;

          if (salesDataByMonth.has(monthKey)) {
            const monthData = salesDataByMonth.get(monthKey)!;
            monthData.orders += 1; // Count all leads as orders
            if (lead.status === 'sale') {
              monthData.sales += 1; // Count only sales
            }
          }
        }
      });

      // Convert to array format for frontend
      const salesData = Array.from(salesDataByMonth.entries()).map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        return {
          name: monthName,
          sales: data.sales,
          orders: data.orders
        };
      });
      
      // Generate offer categories data
      const categoryMap = new Map();
      offersList.forEach(offer => {
        const category = offer.category || 'Other';
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });
      
      const offerCategoriesData = Array.from(categoryMap.entries()).map(([name, value]) => ({
        name,
        value
      }));

      // Calculate Hot Products (top 6 most sold products in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get product sales from the last 7 days (only from "sale" status leads)
      // Note: Using leads.productId since leadItems doesn't have productId field
      const hotProductsData = await db
        .select({
          productId: leads.productId,
          salesCount: sql<number>`COUNT(${leads.id})::int`,
        })
        .from(leads)
        .where(
          and(
            gte(leads.createdAt, sevenDaysAgo),
            eq(leads.status, 'sale' as any),
            sql`${leads.productId} IS NOT NULL`,
            hasSupervisorAccess ? sql`true` : eq(leads.userId, userId)
          )
        )
        .groupBy(leads.productId)
        .orderBy(desc(sql`COUNT(${leads.id})`))
        .limit(6);

      // Get full product information for hot products
      const hotProductIds = hotProductsData.map(hp => hp.productId).filter(id => id !== null);
      let hotProducts: any[] = [];

      if (hotProductIds.length > 0) {
        const hotProductsFullData = await db
          .select()
          .from(products)
          .where(inArray(products.id, hotProductIds));

        // Sort by sales count (maintain order from hotProductsData)
        hotProducts = hotProductsFullData
          .map(product => {
            const salesInfo = hotProductsData.find(hp => hp.productId === product.id);
            return {
              ...product,
              salesCount: salesInfo?.salesCount || 0
            };
          })
          .sort((a, b) => b.salesCount - a.salesCount);
      }

      // Return dashboard data with current lead/offer schema
      res.json({
        totalOffers: offersList.length,
        totalLeads: leadsList.length,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalPayout: parseFloat(totalPayout.toFixed(2)),
        recentLeads: recentLeads || [],
        leadStatus: {
          sale: saleCount,
          hold: holdCount,
          rejected: rejectedCount,
          trash: trashCount,
          total: leadsList.length
        },
        salesData: salesData || [],
        offerCategoriesData: offerCategoriesData || [],
        hotProducts: hotProducts || []
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
        // Sum all completed transactions across all users
        const [totalBalanceResult] = await db
          .select({ total: sql`SUM(CAST(amount AS DECIMAL))` })
          .from(transactions)
          .where(eq(transactions.status, "completed"));

        balance = totalBalanceResult.total ? Number(totalBalanceResult.total) : 0;
        console.log(`Admin/Finance balance calculation: Total balance across all users: ${balance}`);
        res.json({ balance });
      } else {
        // Regular users see their balance and available balance
        // Available balance = completed balance - pending withdrawals
        balance = await storage.getUserBalance(userId);
        const availableBalance = await storage.getUserAvailableBalance(userId);
        console.log(`Regular user balance for user ${userId}: balance=${balance}, available=${availableBalance}`);
        res.json({
          balance,
          availableBalance
        });
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });
  
  // Create a withdrawal transaction
  // SECURITY FIX: Added rate limiting and database-level locking to prevent race conditions
  app.post("/api/wallet/withdraw", requireAuth, strictLimiter, async (req, res) => {
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

      // Format wallet description
      const walletDescription = walletName
        ? `${walletName} (${walletAddress.substring(0, 8)}...)`
        : walletAddress;

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

      // SECURITY FIX: Use method with database-level locking to prevent race conditions
      const result = await storage.createWithdrawalWithLock(
        userId,
        amount,
        withdrawal
      );

      if (!result.success) {
        return res.status(400).json({
          message: result.error || "Insufficient balance for withdrawal"
        });
      }

      res.status(201).json(result.transaction);
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

        // SECURITY FIX: Sanitize settings to prevent mass assignment attacks
        const sanitizedSettings = sanitizeSettings(userData.settings);

        // Merge existing settings with sanitized new settings
        allowedUpdates.settings = {
          ...(user.settings || {}),
          ...sanitizedSettings
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
  // POSTBACK CONFIGURATION AND NOTIFICATIONS
  // -----------------------------------------------

  // Get current user's postback configuration
  app.get("/api/postback/config", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const config = await storage.getPostbackConfiguration(req.user.id);

      if (!config) {
        // Return default configuration if none exists
        return res.json({
          userId: req.user.id,
          isEnabled: false,
          saleUrl: null,
          holdUrl: null,
          rejectedUrl: null,
          trashUrl: null
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching postback configuration:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  // Get specific user's postback configuration (admin/moderator only)
  app.get("/api/postback/config/:userId", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const isAdmin = req.user.role === 'admin';
      const isModerator = req.user.role === 'moderator';

      if (!isAdmin && !isModerator) {
        return res.status(403).json({ message: "Forbidden: Admin or Moderator access required" });
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const config = await storage.getPostbackConfiguration(userId);

      if (!config) {
        // Return default configuration if none exists
        return res.json({
          userId: userId,
          isEnabled: false,
          saleUrl: null,
          holdUrl: null,
          rejectedUrl: null,
          trashUrl: null
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching postback configuration:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  // Update current user's postback configuration
  app.put("/api/postback/config", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { isEnabled, saleUrl, holdUrl, rejectedUrl, trashUrl } = req.body;

      // Validate configuration data
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ message: "isEnabled must be a boolean" });
      }

      const configData = {
        isEnabled,
        saleUrl: saleUrl || null,
        holdUrl: holdUrl || null,
        rejectedUrl: rejectedUrl || null,
        trashUrl: trashUrl || null
      };

      const config = await storage.createOrUpdatePostbackConfiguration(req.user.id, configData);

      res.json(config);
    } catch (error) {
      console.error("Error updating postback configuration:", error);
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });

  // Update specific user's postback configuration (admin/moderator only)
  app.put("/api/postback/config/:userId", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const isAdmin = req.user.role === 'admin';
      const isModerator = req.user.role === 'moderator';

      if (!isAdmin && !isModerator) {
        return res.status(403).json({ message: "Forbidden: Admin or Moderator access required" });
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { isEnabled, saleUrl, holdUrl, rejectedUrl, trashUrl } = req.body;

      // Validate configuration data
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ message: "isEnabled must be a boolean" });
      }

      const configData = {
        isEnabled,
        saleUrl: saleUrl || null,
        holdUrl: holdUrl || null,
        rejectedUrl: rejectedUrl || null,
        trashUrl: trashUrl || null
      };

      const config = await storage.createOrUpdatePostbackConfiguration(userId, configData);

      res.json(config);
    } catch (error) {
      console.error("Error updating postback configuration:", error);
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });

  // Test a postback URL
  app.post("/api/postback/test", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required" });
      }

      const result = await postbackService.testPostbackUrl(url, req.user.id);

      res.json(result);
    } catch (error) {
      console.error("Error testing postback URL:", error);
      res.status(500).json({ message: "Failed to test URL" });
    }
  });

  // Get current user's postback notifications
  app.get("/api/postback/notifications", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getPostbackNotifications(req.user.id, 15);

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching postback notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get all postback notifications (admin/moderator only)
  app.get("/api/postback/notifications/all", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const isAdmin = req.user.role === 'admin';
      const isModerator = req.user.role === 'moderator';

      if (!isAdmin && !isModerator) {
        return res.status(403).json({ message: "Forbidden: Admin or Moderator access required" });
      }

      const notifications = await storage.getAllPostbackNotifications(15);

      // Include user information for each notification
      const notificationsWithUsers = await Promise.all(
        notifications.map(async (notification) => {
          const user = await storage.getUser(notification.userId);
          return {
            ...notification,
            user: user ? {
              id: user.id,
              username: user.username
            } : null
          };
        })
      );

      res.json(notificationsWithUsers);
    } catch (error) {
      console.error("Error fetching all postback notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
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
  
  // API endpoint for lead ingestion (requires API key) - supports both productId and productSku
  // Enhanced version with robust validations and better error handling
  // SECURITY FIX: Added rate limiting (10 leads per minute)
  app.post("/api/external/orders", apiLeadLimiter, requireApiKey, async (req, res) => {
    const startTime = Date.now();

    try {
      // 1. VALIDATE REQUEST SCHEMA
      const parseResult = apiLeadIngestSchema.safeParse(req.body);

      if (!parseResult.success) {
        console.warn("[API Lead Ingest] Validation failed:", {
          errors: parseResult.error.errors,
          body: req.body
        });

        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid lead data provided",
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }

      const leadData = parseResult.data;
      const userId = req.user!.id;

      // 2. VALIDATE AND FETCH PRODUCT
      let product;
      let productNotFound = false;

      try {
        if (leadData.productId) {
          product = await storage.getProduct(leadData.productId);
        } else if (leadData.productSku) {
          product = await storage.getProductBySku(leadData.productSku);
        }
      } catch (dbError) {
        console.error("[API Lead Ingest] Database error fetching product:", dbError);
        return res.status(500).json({
          success: false,
          error: "DATABASE_ERROR",
          message: "Failed to retrieve product information"
        });
      }

      // If product not found, create a dummy product for validation purposes
      // The validation layer will mark the lead as trash
      const quantity = leadData.quantity || 1;

      if (!product) {
        const identifier = leadData.productId
          ? `ID ${leadData.productId}`
          : `SKU ${leadData.productSku}`;

        console.warn("[API Lead Ingest] Product not found - will create trash lead:", identifier);
        productNotFound = true;

        // Create dummy product object for processing (won't be saved to DB)
        product = {
          id: 0, // Dummy ID
          name: leadData.productSku || 'Unknown Product',
          sku: leadData.productSku || '',
          price: leadData.productPrice?.toString() || '0',
          stock: null,
          status: 'inactive',
          payoutPo: '0',
          userId: userId,
          imageUrl: null,
          additionalImages: null,
          description: null,
          weight: null,
          dimensions: null,
          category: null,
          specifications: null,
          reference: null,
          provider: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      // 3. CALCULATE VALUES AUTOMATICALLY
      // Keep the original lead price separate for validation
      const leadProvidedPrice = leadData.productPrice;
      // Use provided price or fall back to catalog price for calculations
      const productPrice = leadProvidedPrice ?? parseFloat(product.price || "0");
      const leadValue = productPrice * quantity;

      // Calculate payout: use hierarchical payout calculation (exceptions > default)
      // This ensures the payout is frozen at lead creation time
      const payout = await storage.calculatePayoutAmount(
        product.id,
        userId,
        leadData.publisherId || undefined
      );
      const totalPayout = payout * quantity;

      // 4. BUILD COMPLETE ADDRESS WITH ARGENTINA AS DEFAULT COUNTRY
      const fullAddress = [
        leadData.customerAddress,
        leadData.customerCity,
        "Argentina", // Always Argentina
        leadData.customerPostalCode
      ].filter(Boolean).join(', ');

      // 4.1 VALIDATE AND FORMAT PHONE NUMBER
      const phoneValidation = await formatPhone(
        leadData.customerPhone,
        'AR', // Always Argentina for now
        req.user?.username || 'NODEF',
        leadData.publisherId || 'NODEF'
      );

      // 4.1.1 CHECK FOR DUPLICATE PHONE NUMBER TODAY
      // SECURITY FIX: Pass both formatted and original phone for enhanced duplicate detection
      const duplicateCheck = await checkDuplicateLeadToday(
        phoneValidation.formattedPhone,
        phoneValidation.originalPhone
      );

      // 4.2 VALIDATE LEAD DATA
      // IMPORTANT: Pass the original lead price (not the fallback) so validation can detect price mismatches
      const priceForValidation = leadProvidedPrice ?? parseFloat(product.price || "0");

      const validationResult = await validateLead({
        customerName: leadData.customerName,
        customerPhone: leadData.customerPhone,
        customerAddress: leadData.customerAddress,
        customerCity: leadData.customerCity,
        customerPostalCode: leadData.customerPostalCode,
        customerProvince: "Argentina", // API doesn't have separate province field, use country as fallback
        lineItems: [{
          productName: product.name,
          sku: product.sku || '',
          price: priceForValidation,
          quantity: quantity
        }]
      });

      // Determine lead status based on validation and duplicate check
      let leadStatus: 'sale' | 'hold' | 'rejected' | 'trash' = "hold";
      let notes = "";
      let customFields: any = leadData.customFields || {};

      // Check for duplicate lead first (highest priority)
      if (duplicateCheck.isDuplicate) {
        leadStatus = "trash";
        notes = `Lead duplicado - mismo número de teléfono ya ingresado hoy. Lead original: ${duplicateCheck.duplicateLead?.leadNumber}`;
        customFields = {
          ...customFields,
          validationStatus: 'duplicate',
          duplicateReason: 'Same phone number already exists today',
          originalLeadNumber: duplicateCheck.duplicateLead?.leadNumber,
          originalLeadDate: duplicateCheck.duplicateLead?.createdAt.toISOString(),
        };

        console.warn(`[API Lead Ingest] Lead marked as TRASH due to duplicate phone:`, {
          phone: phoneValidation.formattedPhone,
          originalLead: duplicateCheck.duplicateLead?.leadNumber
        });
      } else if (!validationResult.isValid) {
        leadStatus = "trash";
        notes = formatValidationErrors(validationResult.errors);
        customFields = {
          ...customFields,
          validationStatus: 'failed',
          validationErrors: validationResult.errors,
        };

        console.warn(`[API Lead Ingest] Lead marked as TRASH due to validation errors:`, validationResult.errors);
      } else {
        customFields = {
          ...customFields,
          validationStatus: 'passed',
          validationErrors: null,
        };
      }

      // 5. CREATE LEAD
      let lead;
      try {
        lead = await storage.createLead({
          campaignId: leadData.campaignId || null,
          productId: productNotFound ? null : product.id, // Use null if product not found
          customerName: leadData.customerName,
          customerEmail: leadData.customerEmail || null,
          customerPhone: phoneValidation.formattedPhone || phoneValidation.originalPhone,
          customerPhoneOriginal: phoneValidation.originalPhone,
          customerPhoneFormatted: phoneValidation.formattedPhone,
          customerAddress: fullAddress,
          customerCity: leadData.customerCity,
          customerCountry: "Argentina", // Always Argentina
          status: leadStatus,
          quality: "standard",
          value: leadValue.toString(),
          payout: totalPayout.toString(),
          ipAddress: leadData.ipAddress || null,
          userAgent: leadData.userAgent || null,
          publisherId: leadData.publisherId || null,
          clickId: leadData.clickId || null,
          subId: leadData.subId || null,
          subacc1: leadData.subacc1 || null,
          subacc2: leadData.subacc2 || null,
          subacc3: leadData.subacc3 || null,
          subacc4: leadData.subacc4 || null,
          customFields: customFields,
          notes: notes || null,
          isConverted: false,
          postbackSent: false
        }, userId);
      } catch (leadError) {
        console.error("[API Lead Ingest] Failed to create lead:", leadError);
        return res.status(500).json({
          success: false,
          error: "LEAD_CREATION_FAILED",
          message: "Failed to create lead record"
        });
      }

      // 6. CREATE LEAD ITEM
      try {
        await storage.addLeadItem({
          leadId: lead.id,
          productName: product.name,
          quantity: quantity,
          price: productPrice.toString(),
          total: (productPrice * quantity).toString()
        });
      } catch (itemError) {
        console.error("[API Lead Ingest] Failed to create lead item:", itemError);
        // Don't fail the request, but log the error
        console.error("[API Lead Ingest] Lead created but item creation failed for lead:", lead.id);
      }

      // 7. UPDATE STOCK (if applicable) - only for real products
      if (!productNotFound && product.stock !== null) {
        try {
          await storage.updateProduct(product.id, {
            ...product,
            stock: product.stock - quantity
          });
        } catch (stockError) {
          console.error("[API Lead Ingest] Failed to update stock:", stockError);
          // Don't fail the request, the lead is already created
        }
      }

      const processingTime = Date.now() - startTime;

      console.info("[API Lead Ingest] Success:", {
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        productId: product.id,
        userId,
        processingTime: `${processingTime}ms`
      });

      // 8. SUCCESS RESPONSE (SIMPLIFIED)
      // Build message based on validation status
      let responseMessage = "Lead created successfully";
      if (leadStatus === "trash") {
        // Extract first validation error for message
        const firstError = validationResult.errors[0] || "Validation failed";
        responseMessage = firstError;
      }

      res.status(201).json({
        success: true,
        message: responseMessage,
        autoTrash: leadStatus === "trash",
        orderId: lead.id
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error("[API Lead Ingest] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
        processingTime: `${processingTime}ms`
      });

      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while processing the lead",
        requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
    }
  });
  
  // API endpoint for order status (requires API key)
  app.get("/api/external/orders/:orderNumber/status", requireApiKey, async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const userId = req.user.id;
      
      // Query the database for the lead
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.leadNumber, orderNumber))
        .limit(1);
      
      if (!lead) {
        return res.status(404).json({ 
          success: false,
          message: "Lead not found" 
        });
      }
      
      // Check if the lead belongs to the user associated with the API key
      if (lead.userId !== userId) {
        return res.status(403).json({ 
          success: false,
          message: "You do not have permission to access this lead" 
        });
      }
      
      // Get lead items
      const leadItems = await storage.getLeadItems(lead.id);
      
      res.json({ 
        success: true,
        lead: {
          leadNumber: lead.leadNumber,
          status: lead.status,
          customerName: lead.customerName,
          value: lead.value,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
          items: leadItems.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            total: item.total
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

  // Get Shopify stores with real statistics
  app.get("/api/shopify/stores", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const isModerator = req.user.role === 'moderator';
      const hasAdminAccess = isAdmin || isModerator;
      const showAll = req.query.all === 'true' && hasAdminAccess;

      // Query shopifyStores table
      let stores;
      if (showAll) {
        stores = await db.select().from(shopifyStores).orderBy(desc(shopifyStores.installedAt));
      } else {
        stores = await db.select()
          .from(shopifyStores)
          .where(eq(shopifyStores.userId, userId))
          .orderBy(desc(shopifyStores.installedAt));
      }

      // Calculate real stats for each store
      const storesWithStats = await Promise.all(stores.map(async (store) => {
        // Count real products for this store's user
        const productsCount = await db.select({ count: sql<number>`count(*)` })
          .from(products)
          .where(eq(products.userId, store.userId));

        // Count real orders/leads for this store (Shopify orders)
        const ordersCount = await db.select({ count: sql<number>`count(*)` })
          .from(leads)
          .where(and(
            eq(leads.userId, store.userId),
            eq(leads.utmSource, 'shopify')
          ));

        return {
          id: store.id,
          name: store.shop,
          platform: 'shopify' as const,
          status: store.status === 'active' ? 'active' as const : 'inactive' as const,
          products: Number(productsCount[0]?.count || 0),
          orders: Number(ordersCount[0]?.count || 0),
          createdAt: store.installedAt,
          userId: store.userId
        };
      }));

      res.json(storesWithStats);
    } catch (error) {
      console.error("Error fetching Shopify stores:", error);
      res.status(500).json({ message: "Failed to fetch Shopify stores" });
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

      // SECURITY: Remove sensitive fields before sending to client
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
        // Explicitly NOT including: password, apiKey, verificationToken, paymentMethods, settings
      }));

      res.json(sanitizedUsers);
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

  // ================== TERMS AND CONDITIONS ROUTES ==================
  // Public route to get the active terms and conditions
  app.get("/api/terms", async (req, res) => {
    try {
      const [activeTerms] = await db
        .select()
        .from(termsAndConditions)
        .where(eq(termsAndConditions.isActive, true))
        .orderBy(desc(termsAndConditions.effectiveDate))
        .limit(1);

      if (!activeTerms) {
        return res.status(404).json({
          success: false,
          message: "No active terms and conditions found"
        });
      }

      res.json({
        success: true,
        data: activeTerms
      });
    } catch (error) {
      console.error("Error fetching terms:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching terms and conditions"
      });
    }
  });

  // Get all terms versions (admin only)
  app.get("/api/terms/all", requireAdmin, async (req, res) => {
    try {
      const allTerms = await db
        .select()
        .from(termsAndConditions)
        .orderBy(desc(termsAndConditions.effectiveDate));

      res.json({
        success: true,
        data: allTerms
      });
    } catch (error) {
      console.error("Error fetching all terms:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching terms and conditions"
      });
    }
  });

  // Create new terms version (admin only)
  app.post("/api/terms", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTermsSchema.parse(req.body);

      // If the new terms should be active, deactivate all others
      if (validatedData.isActive) {
        await db
          .update(termsAndConditions)
          .set({ isActive: false })
          .where(eq(termsAndConditions.isActive, true));
      }

      const [newTerms] = await db
        .insert(termsAndConditions)
        .values(validatedData)
        .returning();

      res.status(201).json({
        success: true,
        data: newTerms
      });
    } catch (error) {
      console.error("Error creating terms:", error);
      res.status(500).json({
        success: false,
        message: "Error creating terms and conditions"
      });
    }
  });

  // Update terms (admin only)
  app.put("/api/terms/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertTermsSchema.parse(req.body);

      // If the updated terms should be active, deactivate all others
      if (validatedData.isActive) {
        await db
          .update(termsAndConditions)
          .set({ isActive: false })
          .where(eq(termsAndConditions.isActive, true));
      }

      const [updatedTerms] = await db
        .update(termsAndConditions)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(termsAndConditions.id, id))
        .returning();

      if (!updatedTerms) {
        return res.status(404).json({
          success: false,
          message: "Terms and conditions not found"
        });
      }

      res.json({
        success: true,
        data: updatedTerms
      });
    } catch (error) {
      console.error("Error updating terms:", error);
      res.status(500).json({
        success: false,
        message: "Error updating terms and conditions"
      });
    }
  });

  // Delete terms (admin only)
  app.delete("/api/terms/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const [deletedTerms] = await db
        .delete(termsAndConditions)
        .where(eq(termsAndConditions.id, id))
        .returning();

      if (!deletedTerms) {
        return res.status(404).json({
          success: false,
          message: "Terms and conditions not found"
        });
      }

      res.json({
        success: true,
        message: "Terms and conditions deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting terms:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting terms and conditions"
      });
    }
  });

  // Activate specific terms version (admin only)
  app.patch("/api/terms/:id/activate", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Deactivate all terms
      await db
        .update(termsAndConditions)
        .set({ isActive: false })
        .where(eq(termsAndConditions.isActive, true));

      // Activate the selected terms
      const [activatedTerms] = await db
        .update(termsAndConditions)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(termsAndConditions.id, id))
        .returning();

      if (!activatedTerms) {
        return res.status(404).json({
          success: false,
          message: "Terms and conditions not found"
        });
      }

      res.json({
        success: true,
        data: activatedTerms
      });
    } catch (error) {
      console.error("Error activating terms:", error);
      res.status(500).json({
        success: false,
        message: "Error activating terms and conditions"
      });
    }
  });

  // SECURITY FIX: Add error handling middleware for API errors only
  // Note: notFoundHandler is NOT added here because serveStatic (in server/index.ts)
  // handles the catch-all route for the React SPA. Adding notFoundHandler here
  // would prevent the frontend from loading.
  app.use(errorHandler);

  const httpServer = createServer(app);

  return httpServer;
}
