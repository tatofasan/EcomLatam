/**
 * Shopify Integration Configuration
 *
 * This module manages configuration for Shopify integration
 */

import { shopifyApi, Session, ApiVersion } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

// Get configuration from environment variables
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
// Ensure SHOPIFY_APP_URL has protocol
let SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'http://localhost:5000';
if (!SHOPIFY_APP_URL.startsWith('http://') && !SHOPIFY_APP_URL.startsWith('https://')) {
  SHOPIFY_APP_URL = `https://${SHOPIFY_APP_URL}`;
}
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,write_fulfillments';

// Required scopes for the Shopify app (Fulfillment Service model)
export const REQUIRED_SCOPES = [
  'read_products',
  'write_products',
  'read_assigned_fulfillment_orders',
  'write_assigned_fulfillment_orders',
  'write_fulfillments',
];

// Initialize Shopify API
export const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: SHOPIFY_SCOPES.split(','),
  hostName: new URL(SHOPIFY_APP_URL).hostname,
  hostScheme: new URL(SHOPIFY_APP_URL).protocol.replace(':', '') as 'http' | 'https',
  apiVersion: ApiVersion.October24, // Using explicit version instead of LATEST_API_VERSION
  isEmbeddedApp: false,
  isCustomStoreApp: false,
});

// OAuth configuration
export const OAUTH_CONFIG = {
  apiKey: SHOPIFY_API_KEY,
  apiSecret: SHOPIFY_API_SECRET,
  scopes: SHOPIFY_SCOPES.split(','),
  redirectUri: `${SHOPIFY_APP_URL}/api/shopify/callback`,
  appUrl: SHOPIFY_APP_URL,
};

// Webhook topics to register
export const WEBHOOK_TOPICS = {
  ORDERS_CREATE: 'orders/create',
  ORDERS_UPDATED: 'orders/updated',
  ORDERS_CANCELLED: 'orders/cancelled',
  ORDERS_FULFILLED: 'orders/fulfilled',
  PRODUCTS_CREATE: 'products/create',
  PRODUCTS_UPDATE: 'products/update',
  PRODUCTS_DELETE: 'products/delete',
  APP_UNINSTALLED: 'app/uninstalled',
};

// Webhook callback URLs
export const getWebhookUrl = (topic: string): string => {
  const sanitizedTopic = topic.replace('/', '-');
  return `${SHOPIFY_APP_URL}/api/shopify/webhooks/${sanitizedTopic}`;
};

// Validate configuration
export const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!SHOPIFY_API_KEY) {
    errors.push('SHOPIFY_API_KEY is not set in environment variables');
  }

  if (!SHOPIFY_API_SECRET) {
    errors.push('SHOPIFY_API_SECRET is not set in environment variables');
  }

  if (!SHOPIFY_APP_URL) {
    errors.push('SHOPIFY_APP_URL is not set in environment variables');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Create a session object for API calls
export const createShopifySession = (shop: string, accessToken: string): Session => {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'offline',
    isOnline: false,
    accessToken,
    scope: SHOPIFY_SCOPES,
  });
};

export default {
  shopify,
  OAUTH_CONFIG,
  WEBHOOK_TOPICS,
  REQUIRED_SCOPES,
  validateConfig,
  createShopifySession,
  getWebhookUrl,
};
