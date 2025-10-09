/**
 * Shopify Integration Routes
 *
 * This module defines all routes for the Shopify integration
 */

import { type Express, type Request, type Response } from 'express';
import { validateConfig } from './integrations/shopify/config';
import {
  generateAuthUrl,
  isValidShopDomain,
  verifyHmac,
  exchangeCodeForToken,
  saveShopCredentials,
  getShopCredentialsByUserId,
  markShopUninstalled,
} from './integrations/shopify/oauth';
import {
  registerWebhooks,
  unregisterWebhooks,
  verifyWebhookHmac,
  handleOrderCreated,
  handleOrderUpdated,
  handleOrderCancelled,
  handleAppUninstalled,
} from './integrations/shopify/webhooks';
import {
  exportProductToShopify,
  exportProductsToShopify,
} from './integrations/shopify/products';
import {
  importAllOrdersFromShopify,
  importOrderToEcomLatam,
  importAssignedFulfillmentOrders,
} from './integrations/shopify/orders';
import { storage } from './storage';

/**
 * Register Shopify routes
 */
export function registerShopifyRoutes(app: Express) {
  // Middleware to ensure authentication
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
  };

  // Check if Shopify integration is configured
  app.get('/api/shopify/config', (req, res) => {
    const validation = validateConfig();

    res.json({
      configured: validation.valid,
      errors: validation.errors,
    });
  });

  /**
   * OAuth Flow
   */

  // Step 1: Initiate OAuth flow
  app.get('/api/shopify/install', requireAuth, async (req, res) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({ message: 'Shop parameter is required' });
      }

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({ message: 'Invalid shop domain' });
      }

      const userId = req.user!.id;

      // Generate authorization URL
      const authUrl = await generateAuthUrl(shop, userId);

      // Redirect to Shopify for authorization
      res.redirect(authUrl);
    } catch (error) {
      console.error('Error initiating Shopify install:', error);
      res.status(500).json({ message: 'Failed to initiate Shopify installation' });
    }
  });

  // Step 2: OAuth callback
  app.get('/api/shopify/callback', async (req, res) => {
    try {
      const { code, hmac, shop, state } = req.query;

      // Validate required parameters
      if (!code || !hmac || !shop || !state) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      // Verify HMAC
      const isValidHmac = verifyHmac(req.query as any);

      if (!isValidHmac) {
        return res.status(403).json({ message: 'Invalid HMAC signature' });
      }

      // Extract userId from state (in production, use a more secure method)
      const [userIdStr, _] = (state as string).split(':');
      const userId = parseInt(userIdStr);

      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }

      // Exchange code for access token
      const tokenData = await exchangeCodeForToken(shop as string, code as string);

      // Save shop credentials
      await saveShopCredentials(
        userId,
        shop as string,
        tokenData.access_token,
        tokenData.scope
      );

      // Register webhooks
      await registerWebhooks(shop as string, tokenData.access_token);

      // Redirect to success page
      res.redirect('/connections?shopify=installed');
    } catch (error) {
      console.error('Error in Shopify OAuth callback:', error);
      res.status(500).json({ message: 'Failed to complete Shopify installation' });
    }
  });

  /**
   * Shop Management
   */

  // Get connected shops for the current user
  app.get('/api/shopify/shops', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      const shops = await getShopCredentialsByUserId(userId);

      // Don't expose access tokens in the response
      const safeShops = shops.map((shop) => ({
        id: shop.id,
        shop: shop.shop,
        status: shop.status,
        scopes: shop.scopes,
        installedAt: shop.installedAt,
        settings: shop.settings,
        lastSyncAt: shop.lastSyncAt,
      }));

      res.json({ shops: safeShops });
    } catch (error) {
      console.error('Error fetching connected shops:', error);
      res.status(500).json({ message: 'Failed to fetch connected shops' });
    }
  });

  // Disconnect a shop
  app.post('/api/shopify/disconnect', requireAuth, async (req, res) => {
    try {
      const { shop } = req.body;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({ message: 'Shop parameter is required' });
      }

      const userId = req.user!.id;

      // Verify that this shop belongs to the user
      const shops = await getShopCredentialsByUserId(userId);
      const userShop = shops.find((s) => s.shop === shop);

      if (!userShop) {
        return res.status(404).json({ message: 'Shop not found or does not belong to user' });
      }

      // Unregister webhooks
      await unregisterWebhooks(shop, userShop.accessToken);

      // Mark shop as uninstalled
      await markShopUninstalled(shop);

      res.json({ message: 'Shop disconnected successfully' });
    } catch (error) {
      console.error('Error disconnecting shop:', error);
      res.status(500).json({ message: 'Failed to disconnect shop' });
    }
  });

  /**
   * Product Export
   */

  // Export a single product to Shopify
  app.post('/api/shopify/products/export', requireAuth, async (req, res) => {
    try {
      const { shop, productId } = req.body;

      if (!shop || !productId) {
        return res.status(400).json({ message: 'Shop and productId are required' });
      }

      const userId = req.user!.id;

      // Verify that this shop belongs to the user
      const shops = await getShopCredentialsByUserId(userId);
      const userShop = shops.find((s) => s.shop === shop);

      if (!userShop) {
        return res.status(404).json({ message: 'Shop not found or does not belong to user' });
      }

      // Get product
      const product = await storage.getProduct(productId);

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Export product to Shopify
      const result = await exportProductToShopify(shop, product);

      res.json(result);
    } catch (error) {
      console.error('Error exporting product to Shopify:', error);
      res.status(500).json({ message: 'Failed to export product to Shopify' });
    }
  });

  // Export multiple products to Shopify
  app.post('/api/shopify/products/export-bulk', requireAuth, async (req, res) => {
    try {
      const { shop, productIds } = req.body;

      if (!shop || !productIds || !Array.isArray(productIds)) {
        return res.status(400).json({ message: 'Shop and productIds array are required' });
      }

      const userId = req.user!.id;

      // Verify that this shop belongs to the user
      const shops = await getShopCredentialsByUserId(userId);
      const userShop = shops.find((s) => s.shop === shop);

      if (!userShop) {
        return res.status(404).json({ message: 'Shop not found or does not belong to user' });
      }

      // Get products
      const products = [];
      for (const productId of productIds) {
        const product = await storage.getProduct(productId);
        if (product) {
          products.push(product);
        }
      }

      if (products.length === 0) {
        return res.status(404).json({ message: 'No valid products found' });
      }

      // Export products to Shopify
      const results = await exportProductsToShopify(shop, products);

      res.json(results);
    } catch (error) {
      console.error('Error exporting products to Shopify:', error);
      res.status(500).json({ message: 'Failed to export products to Shopify' });
    }
  });

  /**
   * Order Import
   */

  // Import assigned fulfillment orders (RECOMMENDED for Fulfillment Service model)
  app.post('/api/shopify/fulfillment-orders/import', requireAuth, async (req, res) => {
    try {
      const { shop, assignmentStatus, locationIds } = req.body;

      if (!shop) {
        return res.status(400).json({ message: 'Shop parameter is required' });
      }

      const userId = req.user!.id;

      // Verify that this shop belongs to the user
      const shops = await getShopCredentialsByUserId(userId);
      const userShop = shops.find((s) => s.shop === shop);

      if (!userShop) {
        return res.status(404).json({ message: 'Shop not found or does not belong to user' });
      }

      // Import assigned fulfillment orders from Shopify
      const results = await importAssignedFulfillmentOrders(shop, {
        assignment_status: assignmentStatus,
        location_ids: locationIds,
      });

      res.json(results);
    } catch (error) {
      console.error('Error importing fulfillment orders from Shopify:', error);
      res.status(500).json({ message: 'Failed to import fulfillment orders from Shopify' });
    }
  });

  // Import all orders from Shopify (Legacy method)
  app.post('/api/shopify/orders/import', requireAuth, async (req, res) => {
    try {
      const { shop, status, limit, createdAtMin } = req.body;

      if (!shop) {
        return res.status(400).json({ message: 'Shop parameter is required' });
      }

      const userId = req.user!.id;

      // Verify that this shop belongs to the user
      const shops = await getShopCredentialsByUserId(userId);
      const userShop = shops.find((s) => s.shop === shop);

      if (!userShop) {
        return res.status(404).json({ message: 'Shop not found or does not belong to user' });
      }

      // Import orders from Shopify
      const results = await importAllOrdersFromShopify(shop, {
        status,
        limit,
        createdAtMin,
      });

      res.json(results);
    } catch (error) {
      console.error('Error importing orders from Shopify:', error);
      res.status(500).json({ message: 'Failed to import orders from Shopify' });
    }
  });

  /**
   * Webhooks
   */

  // Handle orders/create webhook
  app.post('/api/shopify/webhooks/orders-create', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      // Process order
      await handleOrderCreated(shop, req.body);

      res.status(200).json({ message: 'Webhook processed' });
    } catch (error) {
      console.error('Error processing orders/create webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  // Handle orders/updated webhook - DISABLED
  // We don't process order updates from Shopify to avoid conflicts with affiliate changes
  app.post('/api/shopify/webhooks/orders-updated', async (req, res) => {
    // Just acknowledge the webhook but don't process it
    res.status(200).json({
      message: 'Webhook acknowledged but not processed - orders managed in EcomLatam'
    });
  });

  // Handle orders/cancelled webhook
  app.post('/api/shopify/webhooks/orders-cancelled', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      // Process order cancellation
      await handleOrderCancelled(shop, req.body);

      res.status(200).json({ message: 'Webhook processed' });
    } catch (error) {
      console.error('Error processing orders/cancelled webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  // Handle app/uninstalled webhook
  app.post('/api/shopify/webhooks/app-uninstalled', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      // Process app uninstallation
      await handleAppUninstalled(shop);

      res.status(200).json({ message: 'Webhook processed' });
    } catch (error) {
      console.error('Error processing app/uninstalled webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  /**
   * GDPR Mandatory Compliance Webhooks
   * Required by Shopify for app submission
   *
   * Unified endpoint that handles all GDPR compliance webhooks
   * Routes based on X-Shopify-Topic header
   */
  app.post('/api/shopify/webhooks/gdpr', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const topic = req.headers['x-shopify-topic'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      const payload = req.body;

      // Route to appropriate handler based on topic
      switch (topic) {
        case 'customers/data_request':
          console.log('[GDPR] Customer data request received:', {
            shop,
            customer_id: payload.customer?.id,
            orders_requested: payload.orders_requested,
          });

          // TODO: Implement logic to gather customer data
          // For now, we acknowledge the request
          // In production, you should:
          // 1. Collect all customer data from your database
          // 2. Send the data to the customer via email or secure download link
          // 3. Log the request for compliance records

          return res.status(200).json({ message: 'Customer data request acknowledged' });

        case 'customers/redact':
          console.log('[GDPR] Customer redaction request received:', {
            shop,
            customer_id: payload.customer?.id,
            customer_email: payload.customer?.email,
            orders_to_redact: payload.orders_to_redact,
          });

          // TODO: Implement logic to redact customer data
          // For now, we acknowledge the request
          // In production, you should:
          // 1. Delete or anonymize customer personal data
          // 2. Keep only necessary data for legal/accounting purposes
          // 3. Log the deletion for compliance records

          return res.status(200).json({ message: 'Customer redaction request acknowledged' });

        case 'shop/redact':
          console.log('[GDPR] Shop redaction request received:', {
            shop_id: payload.shop_id,
            shop_domain: payload.shop_domain,
          });

          // TODO: Implement logic to redact shop data
          // For now, we acknowledge the request
          // In production, you should:
          // 1. Delete or anonymize shop data
          // 2. Keep only necessary data for legal/accounting purposes
          // 3. Log the deletion for compliance records

          return res.status(200).json({ message: 'Shop redaction request acknowledged' });

        default:
          console.error('[GDPR] Unknown webhook topic:', topic);
          return res.status(400).json({ message: 'Unknown webhook topic' });
      }
    } catch (error) {
      console.error('[GDPR] Error processing compliance webhook:', error);
      return res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  // Legacy individual endpoints - kept for backward compatibility
  // These can be removed once the unified endpoint is confirmed working

  // Handle customers/data_request webhook
  // This webhook is triggered when a customer requests their data
  app.post('/api/shopify/webhooks/customers-data_request', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      const payload = req.body;
      console.log('[GDPR] Customer data request received:', {
        shop,
        customer_id: payload.customer?.id,
        orders_requested: payload.orders_requested,
      });

      // TODO: Implement logic to gather customer data
      // For now, we acknowledge the request
      // In production, you should:
      // 1. Collect all customer data from your database
      // 2. Send the data to the customer via email or secure download link
      // 3. Log the request for compliance records

      res.status(200).json({ message: 'Customer data request acknowledged' });
    } catch (error) {
      console.error('Error processing customers/data_request webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  // Handle customers/redact webhook
  // This webhook is triggered 48 hours after a customer requests data deletion
  app.post('/api/shopify/webhooks/customers-redact', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      const payload = req.body;
      console.log('[GDPR] Customer redaction request received:', {
        shop,
        customer_id: payload.customer?.id,
        customer_email: payload.customer?.email,
        orders_to_redact: payload.orders_to_redact,
      });

      // TODO: Implement logic to redact customer data
      // For now, we acknowledge the request
      // In production, you should:
      // 1. Delete or anonymize customer personal data
      // 2. Keep only necessary data for legal/accounting purposes
      // 3. Log the deletion for compliance records

      res.status(200).json({ message: 'Customer redaction request acknowledged' });
    } catch (error) {
      console.error('Error processing customers/redact webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  // Handle shop/redact webhook
  // This webhook is triggered 48 hours after a shop uninstalls the app
  app.post('/api/shopify/webhooks/shop-redact', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const shop = req.headers['x-shopify-shop-domain'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook HMAC
      if (!verifyWebhookHmac(body, hmac)) {
        return res.status(403).json({ message: 'Invalid webhook signature' });
      }

      const payload = req.body;
      console.log('[GDPR] Shop redaction request received:', {
        shop_id: payload.shop_id,
        shop_domain: payload.shop_domain,
      });

      // TODO: Implement logic to redact shop data
      // For now, we acknowledge the request
      // In production, you should:
      // 1. Delete or anonymize shop data
      // 2. Keep only necessary data for legal/accounting purposes
      // 3. Log the deletion for compliance records

      res.status(200).json({ message: 'Shop redaction request acknowledged' });
    } catch (error) {
      console.error('Error processing shop/redact webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  console.log('Shopify routes registered successfully');
}
