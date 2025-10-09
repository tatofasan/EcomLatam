/**
 * Shopify API Client
 *
 * This module provides functions to interact with the Shopify API
 */

import { shopify, createShopifySession } from './config';
import type {
  ShopifyProduct,
  ShopifyOrder,
  ShopifyFulfillment,
  ShopifyWebhook,
  ShopifyWebhookTopic,
  ShopifyFulfillmentOrder,
  ShopifyFulfillmentOrdersResponse,
  ShopifyAssignedFulfillmentOrder,
} from './types';

/**
 * Create a REST API client for a specific shop
 */
export const createRestClient = (shop: string, accessToken: string) => {
  const session = createShopifySession(shop, accessToken);
  return new shopify.clients.Rest({ session });
};

/**
 * Create a GraphQL API client for a specific shop
 */
export const createGraphQLClient = (shop: string, accessToken: string) => {
  const session = createShopifySession(shop, accessToken);
  return new shopify.clients.Graphql({ session });
};

/**
 * Products API
 */

// Get all products
export const getProducts = async (shop: string, accessToken: string, params?: { limit?: number; since_id?: number }) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: 'products',
    query: params,
  });

  return response.body as { products: ShopifyProduct[] };
};

// Get a single product
export const getProduct = async (shop: string, accessToken: string, productId: number) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: `products/${productId}`,
  });

  return response.body as { product: ShopifyProduct };
};

// Create a product
export const createProduct = async (shop: string, accessToken: string, product: ShopifyProduct) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.post({
    path: 'products',
    data: { product },
    type: 'application/json',
  });

  return response.body as { product: ShopifyProduct };
};

// Update a product
export const updateProduct = async (shop: string, accessToken: string, productId: number, product: Partial<ShopifyProduct>) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.put({
    path: `products/${productId}`,
    data: { product },
    type: 'application/json',
  });

  return response.body as { product: ShopifyProduct };
};

// Delete a product
export const deleteProduct = async (shop: string, accessToken: string, productId: number) => {
  const client = createRestClient(shop, accessToken);
  await client.delete({
    path: `products/${productId}`,
  });
};

/**
 * Orders API
 */

// Get all orders
export const getOrders = async (
  shop: string,
  accessToken: string,
  params?: {
    status?: 'open' | 'closed' | 'cancelled' | 'any';
    limit?: number;
    since_id?: number;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    financial_status?: string;
    fulfillment_status?: string;
  }
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: 'orders',
    query: params,
  });

  return response.body as { orders: ShopifyOrder[] };
};

// Get a single order
export const getOrder = async (shop: string, accessToken: string, orderId: number) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: `orders/${orderId}`,
  });

  return response.body as { order: ShopifyOrder };
};

/**
 * Fulfillments API
 */

// Create a fulfillment
export const createFulfillment = async (
  shop: string,
  accessToken: string,
  orderId: number,
  fulfillment: ShopifyFulfillment
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.post({
    path: `orders/${orderId}/fulfillments`,
    data: { fulfillment },
    type: 'application/json',
  });

  return response.body as { fulfillment: ShopifyFulfillment };
};

// Update a fulfillment
export const updateFulfillment = async (
  shop: string,
  accessToken: string,
  orderId: number,
  fulfillmentId: number,
  fulfillment: Partial<ShopifyFulfillment>
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.put({
    path: `orders/${orderId}/fulfillments/${fulfillmentId}`,
    data: { fulfillment },
    type: 'application/json',
  });

  return response.body as { fulfillment: ShopifyFulfillment };
};

/**
 * Webhooks API
 */

// Get all webhooks
export const getWebhooks = async (shop: string, accessToken: string) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: 'webhooks',
  });

  return response.body as { webhooks: ShopifyWebhook[] };
};

// Create a webhook
export const createWebhook = async (shop: string, accessToken: string, webhook: ShopifyWebhookTopic) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.post({
    path: 'webhooks',
    data: {
      webhook: {
        ...webhook,
        format: 'json',
      },
    },
    type: 'application/json',
  });

  return response.body as { webhook: ShopifyWebhook };
};

// Delete a webhook
export const deleteWebhook = async (shop: string, accessToken: string, webhookId: number) => {
  const client = createRestClient(shop, accessToken);
  await client.delete({
    path: `webhooks/${webhookId}`,
  });
};

/**
 * Shop Info API
 */

// Get shop information
export const getShopInfo = async (shop: string, accessToken: string) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: 'shop',
  });

  return response.body as { shop: any };
};

/**
 * Inventory API
 */

// Update inventory level for a variant
export const updateInventoryLevel = async (
  shop: string,
  accessToken: string,
  inventoryItemId: number,
  locationId: number,
  available: number
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.post({
    path: 'inventory_levels/set',
    data: {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available,
    },
    type: 'application/json',
  });

  return response.body;
};

/**
 * FulfillmentOrder API (for Fulfillment Service model)
 */

// Get assigned fulfillment orders
export const getAssignedFulfillmentOrders = async (
  shop: string,
  accessToken: string,
  params?: {
    assignment_status?: 'cancellation_requested' | 'fulfillment_requested' | 'fulfillment_accepted';
    location_ids?: number[];
  }
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: 'assigned_fulfillment_orders',
    query: params,
  });

  return response.body as { fulfillment_orders: ShopifyAssignedFulfillmentOrder[] };
};

// Get fulfillment orders for an order
export const getOrderFulfillmentOrders = async (
  shop: string,
  accessToken: string,
  orderId: number
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: `orders/${orderId}/fulfillment_orders`,
  });

  return response.body as ShopifyFulfillmentOrdersResponse;
};

// Get a single fulfillment order
export const getFulfillmentOrder = async (
  shop: string,
  accessToken: string,
  fulfillmentOrderId: number
) => {
  const client = createRestClient(shop, accessToken);
  const response = await client.get({
    path: `fulfillment_orders/${fulfillmentOrderId}`,
  });

  return response.body as { fulfillment_order: ShopifyFulfillmentOrder };
};

// Create fulfillment for a fulfillment order
export const createFulfillmentForOrder = async (
  shop: string,
  accessToken: string,
  fulfillmentOrderId: number,
  trackingInfo?: {
    tracking_company?: string;
    tracking_number?: string;
    tracking_url?: string;
    notify_customer?: boolean;
  }
) => {
  const client = createRestClient(shop, accessToken);

  const fulfillmentData: any = {
    line_items_by_fulfillment_order: [
      {
        fulfillment_order_id: fulfillmentOrderId,
      }
    ],
  };

  if (trackingInfo) {
    fulfillmentData.tracking_info = trackingInfo;
    fulfillmentData.notify_customer = trackingInfo.notify_customer ?? true;
  }

  const response = await client.post({
    path: 'fulfillments',
    data: { fulfillment: fulfillmentData },
    type: 'application/json',
  });

  return response.body as { fulfillment: ShopifyFulfillment };
};

export default {
  createRestClient,
  createGraphQLClient,
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrder,
  createFulfillment,
  updateFulfillment,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getShopInfo,
  updateInventoryLevel,
  // FulfillmentOrder API
  getAssignedFulfillmentOrders,
  getOrderFulfillmentOrders,
  getFulfillmentOrder,
  createFulfillmentForOrder,
};
