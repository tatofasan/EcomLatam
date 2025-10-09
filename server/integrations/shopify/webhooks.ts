/**
 * Shopify Webhooks Handler
 *
 * This module handles incoming webhooks from Shopify
 */

import crypto from 'crypto';
import { OAUTH_CONFIG, WEBHOOK_TOPICS, getWebhookUrl } from './config';
import { createWebhook as createWebhookAPI, getWebhooks, deleteWebhook } from './api';
import { getShopCredentials } from './oauth';
import { importOrderToEcomLatam } from './orders';
import { db } from '../../db';
import { shopifyStores } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { ShopifyOrder, ShopifyOrderWebhookPayload } from './types';

/**
 * Verify webhook HMAC signature
 */
export const verifyWebhookHmac = (body: string, hmacHeader: string): boolean => {
  try {
    const generatedHmac = crypto
      .createHmac('sha256', OAUTH_CONFIG.apiSecret)
      .update(body, 'utf8')
      .digest('base64');

    return generatedHmac === hmacHeader;
  } catch (error) {
    console.error('Error verifying webhook HMAC:', error);
    return false;
  }
};

/**
 * Register all webhooks for a shop
 */
export const registerWebhooks = async (shop: string, accessToken: string) => {
  try {
    console.log(`Registering webhooks for shop: ${shop}`);

    const webhooksToRegister = [
      { topic: WEBHOOK_TOPICS.ORDERS_CREATE, address: getWebhookUrl(WEBHOOK_TOPICS.ORDERS_CREATE) },
      { topic: WEBHOOK_TOPICS.ORDERS_CANCELLED, address: getWebhookUrl(WEBHOOK_TOPICS.ORDERS_CANCELLED) },
      { topic: WEBHOOK_TOPICS.APP_UNINSTALLED, address: getWebhookUrl(WEBHOOK_TOPICS.APP_UNINSTALLED) },
    ];

    // Get existing webhooks
    const { webhooks: existingWebhooks } = await getWebhooks(shop, accessToken);
    const webhookIds: number[] = [];

    for (const webhookConfig of webhooksToRegister) {
      // Check if webhook already exists
      const existingWebhook = existingWebhooks.find(
        (w) => w.topic === webhookConfig.topic && w.address === webhookConfig.address
      );

      if (existingWebhook) {
        console.log(`Webhook already exists for topic: ${webhookConfig.topic}`);
        if (existingWebhook.id) {
          webhookIds.push(existingWebhook.id);
        }
      } else {
        // Create new webhook
        const { webhook } = await createWebhookAPI(shop, accessToken, webhookConfig);
        console.log(`Created webhook for topic: ${webhookConfig.topic}, ID: ${webhook.id}`);
        if (webhook.id) {
          webhookIds.push(webhook.id);
        }
      }
    }

    // Save webhook IDs to database
    await db
      .update(shopifyStores)
      .set({
        webhookIds: webhookIds,
        updatedAt: new Date(),
      })
      .where(eq(shopifyStores.shop, shop));

    console.log(`Successfully registered ${webhookIds.length} webhooks for shop: ${shop}`);
    return webhookIds;
  } catch (error) {
    console.error('Error registering webhooks:', error);
    throw error;
  }
};

/**
 * Unregister all webhooks for a shop
 */
export const unregisterWebhooks = async (shop: string, accessToken: string) => {
  try {
    console.log(`Unregistering webhooks for shop: ${shop}`);

    // Get store from database
    const store = await getShopCredentials(shop);

    if (!store || !store.webhookIds) {
      console.log('No webhooks to unregister');
      return;
    }

    const webhookIds = store.webhookIds as number[];

    // Delete each webhook
    for (const webhookId of webhookIds) {
      try {
        await deleteWebhook(shop, accessToken, webhookId);
        console.log(`Deleted webhook ID: ${webhookId}`);
      } catch (error) {
        console.error(`Failed to delete webhook ID ${webhookId}:`, error);
      }
    }

    // Clear webhook IDs from database
    await db
      .update(shopifyStores)
      .set({
        webhookIds: null,
        updatedAt: new Date(),
      })
      .where(eq(shopifyStores.shop, shop));

    console.log(`Successfully unregistered webhooks for shop: ${shop}`);
  } catch (error) {
    console.error('Error unregistering webhooks:', error);
    throw error;
  }
};

/**
 * Handle order created webhook
 */
export const handleOrderCreated = async (shop: string, order: ShopifyOrder) => {
  try {
    console.log(`Processing order created webhook for shop: ${shop}, order: ${order.name}`);

    // Get store from database
    const store = await getShopCredentials(shop);

    if (!store) {
      console.error(`Shop not found in database: ${shop}`);
      return;
    }

    // Check if auto-import is enabled
    const settings = store.settings as any;
    if (!settings?.autoImportOrders) {
      console.log(`Auto-import disabled for shop: ${shop}`);
      return;
    }

    // Import order to EcomLatam
    const result = await importOrderToEcomLatam(shop, order);

    return result;
  } catch (error) {
    console.error('Error handling order created webhook:', error);
    throw error;
  }
};

/**
 * Handle order updated webhook
 *
 * DISABLED: We don't process order updates from Shopify to avoid conflicts.
 * Once an order is imported to EcomLatam, affiliates manage it from the platform.
 * Any changes from Shopify after import could override affiliate's work.
 */
export const handleOrderUpdated = async (shop: string, order: ShopifyOrder) => {
  console.log(`Order updated webhook received for ${order.name} - IGNORED by design`);

  return {
    success: true,
    message: `Order ${order.name} update ignored - orders are managed in EcomLatam`,
  };
};

/**
 * Handle order cancelled webhook
 */
export const handleOrderCancelled = async (shop: string, order: ShopifyOrder) => {
  try {
    console.log(`Processing order cancelled webhook for shop: ${shop}, order: ${order.name}`);

    // Get store from database
    const store = await getShopCredentials(shop);

    if (!store) {
      console.error(`Shop not found in database: ${shop}`);
      return;
    }

    // TODO: Mark order as cancelled in EcomLatam if it exists

    return {
      success: true,
      message: `Order ${order.name} cancellation processed successfully`,
    };
  } catch (error) {
    console.error('Error handling order cancelled webhook:', error);
    throw error;
  }
};

/**
 * Handle app uninstalled webhook
 */
export const handleAppUninstalled = async (shop: string) => {
  try {
    console.log(`Processing app uninstalled webhook for shop: ${shop}`);

    // Mark shop as uninstalled in database
    await db
      .update(shopifyStores)
      .set({
        status: 'inactive',
        uninstalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shopifyStores.shop, shop));

    console.log(`Shop ${shop} marked as uninstalled`);

    return {
      success: true,
      message: `Shop ${shop} uninstalled successfully`,
    };
  } catch (error) {
    console.error('Error handling app uninstalled webhook:', error);
    throw error;
  }
};

export default {
  verifyWebhookHmac,
  registerWebhooks,
  unregisterWebhooks,
  handleOrderCreated,
  handleOrderUpdated,
  handleOrderCancelled,
  handleAppUninstalled,
};
