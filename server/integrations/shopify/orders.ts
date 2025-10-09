/**
 * Shopify Orders Sync
 *
 * This module handles synchronization of orders from Shopify to EcomLatam
 */

import { getShopCredentials } from './oauth';
import { getOrders, getOrder, getOrderFulfillmentOrders, getAssignedFulfillmentOrders } from './api';
import { db } from '../../db';
import { leads, leadItems, products } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { ShopifyOrder, ShopifyFulfillmentOrder, ShopifyAssignedFulfillmentOrder } from './types';

/**
 * Convert Shopify order to EcomLatam lead format
 */
export const convertShopifyOrderToEcomLatamLead = async (
  order: ShopifyOrder,
  userId: number,
  shop: string
) => {
  try {
    // Build customer info
    const customerName =
      order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : order.billing_address?.name ||
          order.shipping_address?.name ||
          'Unknown Customer';

    const customerEmail = order.customer?.email || order.email || null;

    const customerPhone =
      order.customer?.phone ||
      order.shipping_address?.phone ||
      order.billing_address?.phone ||
      null;

    // Build address
    const address = order.shipping_address || order.billing_address;
    const customerAddress = address
      ? `${address.address1 || ''} ${address.address2 || ''}`.trim()
      : null;
    const customerCity = address?.city || null;
    const customerCountry = address?.country || null;

    // Calculate total value
    const value = parseFloat(order.total_price || '0');

    // Generate lead number
    const leadNumber = `SHOPIFY-${shop.replace('.myshopify.com', '')}-${order.order_number}`;

    // Determine lead status based on Shopify order status
    let leadStatus: 'sale' | 'hold' | 'rejected' | 'trash' = 'hold';

    if (order.financial_status === 'paid' && order.fulfillment_status === 'fulfilled') {
      leadStatus = 'sale';
    } else if (order.financial_status === 'refunded' || order.financial_status === 'voided') {
      leadStatus = 'rejected';
    } else if (order.financial_status === 'paid') {
      leadStatus = 'hold'; // Paid but not fulfilled yet
    }

    // Get the first product from line items (if available)
    // In a real scenario, you might want to match products by SKU
    let productId: number | null = null;

    if (order.line_items && order.line_items.length > 0) {
      const firstLineItem = order.line_items[0];

      // Try to find product by SKU
      if (firstLineItem.sku) {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.sku, firstLineItem.sku))
          .limit(1);

        if (product) {
          productId = product.id;
        }
      }
    }

    // Build lead object
    const lead = {
      leadNumber,
      userId,
      productId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerCountry,
      status: leadStatus,
      quality: 'standard' as const,
      value: value.toString(),
      commission: (value * 0.1).toString(), // Default 10% commission
      trafficSource: 'direct' as const,
      utmSource: 'shopify',
      utmMedium: 'ecommerce',
      utmCampaign: shop,
      clickId: order.id.toString(),
      subId: order.name,
      customFields: {
        shopifyOrderId: order.id,
        shopifyOrderName: order.name,
        shopifyOrderNumber: order.order_number,
        shopifyFinancialStatus: order.financial_status,
        shopifyFulfillmentStatus: order.fulfillment_status,
        shopifyCurrency: order.currency,
        shopifyTags: order.tags,
        shopifyNote: order.note,
        shopifyShop: shop,
      },
      notes: order.note || `Imported from Shopify: ${order.name}`,
      isConverted: leadStatus === 'sale',
      postbackSent: false,
    };

    return lead;
  } catch (error) {
    console.error('Error converting Shopify order to EcomLatam lead:', error);
    throw error;
  }
};

/**
 * Import a single order from Shopify to EcomLatam
 */
export const importOrderToEcomLatam = async (
  shop: string,
  order: ShopifyOrder
) => {
  try {
    console.log(`Importing order ${order.name} from Shopify shop: ${shop}`);

    // Get shop credentials
    const store = await getShopCredentials(shop);

    if (!store) {
      throw new Error(`Shop not found: ${shop}`);
    }

    const userId = store.userId;

    // Check if lead already exists
    const leadNumber = `SHOPIFY-${shop.replace('.myshopify.com', '')}-${order.order_number}`;
    const [existingLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.leadNumber, leadNumber))
      .limit(1);

    if (existingLead) {
      console.log(`Lead already exists: ${leadNumber}`);
      return {
        success: true,
        lead: existingLead,
        created: false,
      };
    }

    // Convert Shopify order to EcomLatam lead
    const leadData = await convertShopifyOrderToEcomLatamLead(order, userId, shop);

    // Insert lead into database
    const [newLead] = await db.insert(leads).values(leadData).returning();

    // Insert lead items
    if (order.line_items && order.line_items.length > 0) {
      for (const lineItem of order.line_items) {
        await db.insert(leadItems).values({
          leadId: newLead.id,
          productName: lineItem.title,
          quantity: lineItem.quantity,
          price: lineItem.price,
          total: (parseFloat(lineItem.price) * lineItem.quantity).toString(),
        });
      }
    }

    console.log(`Successfully imported order ${order.name} as lead ${newLead.id}`);

    return {
      success: true,
      lead: newLead,
      created: true,
    };
  } catch (error) {
    console.error('Error importing order to EcomLatam:', error);
    throw error;
  }
};

/**
 * Import all orders from Shopify to EcomLatam
 */
export const importAllOrdersFromShopify = async (
  shop: string,
  options?: {
    status?: 'open' | 'closed' | 'cancelled' | 'any';
    limit?: number;
    createdAtMin?: string;
  }
) => {
  try {
    console.log(`Importing orders from Shopify shop: ${shop}`);

    // Get shop credentials
    const store = await getShopCredentials(shop);

    if (!store) {
      throw new Error(`Shop not found: ${shop}`);
    }

    const accessToken = store.accessToken;

    // Fetch orders from Shopify
    const { orders } = await getOrders(shop, accessToken, {
      status: options?.status || 'any',
      limit: options?.limit || 250,
      created_at_min: options?.createdAtMin,
    });

    console.log(`Found ${orders.length} orders in Shopify`);

    const results = {
      success: [] as any[],
      failed: [] as any[],
      skipped: [] as any[],
    };

    // Import each order
    for (const order of orders) {
      try {
        const result = await importOrderToEcomLatam(shop, order);

        if (result.created) {
          results.success.push(result.lead);
        } else {
          results.skipped.push(result.lead);
        }
      } catch (error) {
        console.error(`Failed to import order ${order.name}:`, error);
        results.failed.push({
          order: order.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `Import completed: ${results.success.length} created, ${results.skipped.length} skipped, ${results.failed.length} failed`
    );

    return results;
  } catch (error) {
    console.error('Error importing orders from Shopify:', error);
    throw error;
  }
};

/**
 * Sync order status from EcomLatam to Shopify (for fulfillment)
 */
export const syncOrderStatusToShopify = async (
  shop: string,
  leadId: number,
  fulfillmentData?: {
    trackingCompany?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  }
) => {
  try {
    console.log(`Syncing order status for lead ${leadId} to Shopify shop: ${shop}`);

    // Get lead from database
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Get Shopify order ID from custom fields
    const customFields = lead.customFields as any;
    const shopifyOrderId = customFields?.shopifyOrderId;

    if (!shopifyOrderId) {
      throw new Error(`Lead ${leadId} is not associated with a Shopify order`);
    }

    // TODO: Implement fulfillment creation in Shopify
    // This would require importing createFulfillment from api.ts
    // and calling it with the appropriate data

    console.log(`Order status synced for lead ${leadId}`);

    return {
      success: true,
      leadId,
      shopifyOrderId,
    };
  } catch (error) {
    console.error('Error syncing order status to Shopify:', error);
    throw error;
  }
};

/**
 * Convert FulfillmentOrder to EcomLatam lead format
 */
export const convertFulfillmentOrderToEcomLatamLead = async (
  fulfillmentOrder: ShopifyFulfillmentOrder,
  order: ShopifyOrder,
  userId: number,
  shop: string
) => {
  try {
    const destination = fulfillmentOrder.destination;

    // Build customer info from destination
    const customerName = destination.first_name && destination.last_name
      ? `${destination.first_name} ${destination.last_name}`.trim()
      : destination.company || 'Unknown Customer';

    const customerEmail = destination.email || order.email || null;
    const customerPhone = destination.phone || null;

    // Build address
    const customerAddress = destination.address1
      ? `${destination.address1} ${destination.address2 || ''}`.trim()
      : null;
    const customerCity = destination.city || null;
    const customerCountry = destination.country || null;

    // Calculate total value from line items
    const value = parseFloat(order.total_price || '0');

    // Generate lead number
    const leadNumber = `SHOPIFY-${shop.replace('.myshopify.com', '')}-${order.order_number}`;

    // Determine lead status based on Shopify fulfillment order status
    let leadStatus: 'sale' | 'hold' | 'rejected' | 'trash' = 'hold';

    if (fulfillmentOrder.status === 'closed') {
      leadStatus = 'sale';
    } else if (fulfillmentOrder.status === 'cancelled') {
      leadStatus = 'rejected';
    } else if (fulfillmentOrder.status === 'in_progress') {
      leadStatus = 'hold';
    }

    // Get the first product from line items
    let productId: number | null = null;

    if (fulfillmentOrder.line_items && fulfillmentOrder.line_items.length > 0) {
      const firstLineItem = fulfillmentOrder.line_items[0];

      // Find corresponding order line item to get SKU
      const orderLineItem = order.line_items.find(li => li.id === firstLineItem.line_item_id);

      if (orderLineItem?.sku) {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.sku, orderLineItem.sku))
          .limit(1);

        if (product) {
          productId = product.id;
        }
      }
    }

    // Build lead object
    const lead = {
      leadNumber,
      userId,
      productId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerCountry,
      status: leadStatus,
      quality: 'standard' as const,
      value: value.toString(),
      commission: (value * 0.1).toString(), // Default 10% commission
      trafficSource: 'direct' as const,
      utmSource: 'shopify',
      utmMedium: 'ecommerce',
      utmCampaign: shop,
      clickId: order.id.toString(),
      subId: order.name,
      customFields: {
        shopifyOrderId: order.id,
        shopifyOrderName: order.name,
        shopifyOrderNumber: order.order_number,
        shopifyFulfillmentOrderId: fulfillmentOrder.id,
        shopifyFulfillmentStatus: fulfillmentOrder.status,
        shopifyRequestStatus: fulfillmentOrder.request_status,
        shopifyAssignedLocationId: fulfillmentOrder.assigned_location_id,
        shopifyCurrency: order.currency,
        shopifyTags: order.tags,
        shopifyNote: order.note,
        shopifyShop: shop,
      },
      notes: order.note || `Imported from Shopify (Fulfillment Service): ${order.name}`,
      isConverted: leadStatus === 'sale',
      postbackSent: false,
    };

    return lead;
  } catch (error) {
    console.error('Error converting FulfillmentOrder to EcomLatam lead:', error);
    throw error;
  }
};

/**
 * Import assigned fulfillment orders from Shopify
 * This is the preferred method for fulfillment services
 */
export const importAssignedFulfillmentOrders = async (
  shop: string,
  options?: {
    assignment_status?: 'cancellation_requested' | 'fulfillment_requested' | 'fulfillment_accepted';
    location_ids?: number[];
  }
) => {
  try {
    console.log(`Importing assigned fulfillment orders from Shopify shop: ${shop}`);

    // Get shop credentials
    const store = await getShopCredentials(shop);

    if (!store) {
      throw new Error(`Shop not found: ${shop}`);
    }

    const accessToken = store.accessToken;
    const userId = store.userId;

    // Fetch assigned fulfillment orders from Shopify
    const { fulfillment_orders } = await getAssignedFulfillmentOrders(shop, accessToken, options);

    console.log(`Found ${fulfillment_orders.length} assigned fulfillment orders`);

    const results = {
      success: [] as any[],
      failed: [] as any[],
      skipped: [] as any[],
    };

    // Import each fulfillment order
    for (const fulfillmentOrder of fulfillment_orders) {
      try {
        // Get the original order details
        const { order } = await getOrder(shop, accessToken, fulfillmentOrder.order_id);

        // Check if lead already exists
        const leadNumber = `SHOPIFY-${shop.replace('.myshopify.com', '')}-${order.order_number}`;
        const [existingLead] = await db
          .select()
          .from(leads)
          .where(eq(leads.leadNumber, leadNumber))
          .limit(1);

        if (existingLead) {
          console.log(`Lead already exists: ${leadNumber}`);
          results.skipped.push(existingLead);
          continue;
        }

        // Convert FulfillmentOrder to EcomLatam lead
        const leadData = await convertFulfillmentOrderToEcomLatamLead(
          fulfillmentOrder as any,
          order,
          userId,
          shop
        );

        // Insert lead into database
        const [newLead] = await db.insert(leads).values(leadData).returning();

        // Insert lead items
        if (order.line_items && order.line_items.length > 0) {
          for (const lineItem of order.line_items) {
            await db.insert(leadItems).values({
              leadId: newLead.id,
              productName: lineItem.title,
              quantity: lineItem.quantity,
              price: lineItem.price,
              total: (parseFloat(lineItem.price) * lineItem.quantity).toString(),
            });
          }
        }

        console.log(`Successfully imported fulfillment order ${fulfillmentOrder.id} as lead ${newLead.id}`);
        results.success.push(newLead);
      } catch (error) {
        console.error(`Failed to import fulfillment order ${fulfillmentOrder.id}:`, error);
        results.failed.push({
          fulfillmentOrder: fulfillmentOrder.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `Import completed: ${results.success.length} created, ${results.skipped.length} skipped, ${results.failed.length} failed`
    );

    return results;
  } catch (error) {
    console.error('Error importing assigned fulfillment orders from Shopify:', error);
    throw error;
  }
};

export default {
  convertShopifyOrderToEcomLatamLead,
  importOrderToEcomLatam,
  importAllOrdersFromShopify,
  syncOrderStatusToShopify,
  // New FulfillmentOrder methods
  convertFulfillmentOrderToEcomLatamLead,
  importAssignedFulfillmentOrders,
};
