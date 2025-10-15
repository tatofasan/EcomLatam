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
import { formatPhone } from '../../phoneValidation';
import { checkDuplicateLeadToday } from '../../leadDuplicateValidation';

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Shopify order for EcomLatam import
 *
 * Checks:
 * 1. SKU matches a product in catalog
 * 2. Unit price matches product price
 * 3. Valid address (address1 exists)
 * 4. Phone number exists
 * 5. Customer name exists
 * 6. Postal code exists
 * 7. Province exists
 * 8. City exists
 */
async function validateShopifyOrder(order: ShopifyOrder): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get address (prefer shipping, fallback to billing)
  const address = order.shipping_address || order.billing_address;

  // 1. Check customer name
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
    : address?.name || '';

  if (!customerName || customerName.length < 2) {
    errors.push('INVALID_CUSTOMER_NAME: Customer name is missing or too short');
  }

  // 2. Check phone number
  const customerPhone = order.customer?.phone || address?.phone || '';
  if (!customerPhone || customerPhone.trim().length < 8) {
    errors.push('INVALID_PHONE: Phone number is missing or invalid');
  }

  // 3. Check address
  if (!address || !address.address1 || address.address1.trim().length < 5) {
    errors.push('INVALID_ADDRESS: Street address is missing or too short');
  }

  // 4. Check postal code
  if (!address || !address.zip || address.zip.trim().length < 3) {
    errors.push('INVALID_POSTAL_CODE: Postal code is missing or invalid');
  }

  // 5. Check province
  if (!address || !address.province || address.province.trim().length < 2) {
    errors.push('INVALID_PROVINCE: Province/state is missing');
  }

  // 6. Check city
  if (!address || !address.city || address.city.trim().length < 2) {
    errors.push('INVALID_CITY: City is missing or invalid');
  }

  // 7. Validate line items (SKU and price validation)
  if (!order.line_items || order.line_items.length === 0) {
    errors.push('NO_LINE_ITEMS: Order has no products');
  } else {
    for (const lineItem of order.line_items) {
      // Check if SKU exists
      if (!lineItem.sku || lineItem.sku.trim() === '') {
        errors.push(`MISSING_SKU: Product "${lineItem.title}" has no SKU`);
        continue;
      }

      // Find product in catalog by SKU
      const [catalogProduct] = await db
        .select()
        .from(products)
        .where(eq(products.sku, lineItem.sku))
        .limit(1);

      if (!catalogProduct) {
        errors.push(`SKU_NOT_FOUND: SKU "${lineItem.sku}" not found in catalog for product "${lineItem.title}"`);
        continue;
      }

      // Validate price matches
      const lineItemPrice = parseFloat(lineItem.price);
      const catalogPrice = parseFloat(catalogProduct.price || '0');

      // Allow small price differences (up to 1 cent) due to currency conversion
      const priceDifference = Math.abs(lineItemPrice - catalogPrice);
      if (priceDifference > 0.01) {
        errors.push(
          `PRICE_MISMATCH: Product "${lineItem.title}" (SKU: ${lineItem.sku}) has price $${lineItemPrice.toFixed(2)} ` +
          `but catalog price is $${catalogPrice.toFixed(2)}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Convert Shopify order to EcomLatam lead format
 */
export const convertShopifyOrderToEcomLatamLead = async (
  order: ShopifyOrder,
  userId: number,
  shop: string
) => {
  try {
    // STEP 1: VALIDATE ORDER
    const validationResult = await validateShopifyOrder(order);

    // Build customer info
    const customerName =
      order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : order.billing_address?.name ||
          order.shipping_address?.name ||
          'Unknown Customer';

    const customerEmail = order.customer?.email || order.email || null;

    const customerPhoneRaw =
      order.customer?.phone ||
      order.shipping_address?.phone ||
      order.billing_address?.phone ||
      '';

    // Validate and format phone number
    const phoneValidation = customerPhoneRaw
      ? await formatPhone(customerPhoneRaw, 'AR', 'shopify', shop)
      : { originalPhone: '', formattedPhone: null, isValid: false };

    // Check for duplicate phone number today
    const duplicateCheck = await checkDuplicateLeadToday(phoneValidation.formattedPhone);

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

    // STEP 2: DETERMINE LEAD STATUS
    let leadStatus: 'sale' | 'hold' | 'rejected' | 'trash' = 'hold';
    let notes = order.note || `Imported from Shopify: ${order.name}`;

    // Check for duplicate first (highest priority)
    if (duplicateCheck.isDuplicate) {
      leadStatus = 'trash';
      notes = `⚠️ LEAD DUPLICADO - AUTOMATIC TRASH\n\n` +
        `Mismo número de teléfono ya ingresado hoy.\n` +
        `Lead original: ${duplicateCheck.duplicateLead?.leadNumber}\n` +
        `Fecha original: ${duplicateCheck.duplicateLead?.createdAt.toISOString()}\n\n` +
        `---\nOriginal Note: ${order.note || 'None'}`;

      console.warn(`[Shopify Import] Order ${order.name} marked as TRASH due to duplicate phone:`, {
        phone: phoneValidation.formattedPhone,
        originalLead: duplicateCheck.duplicateLead?.leadNumber
      });
    } else if (!validationResult.isValid) {
      // If validation failed, mark as trash and include error details
      leadStatus = 'trash';
      notes = `⚠️ ORDER VALIDATION FAILED - AUTOMATIC TRASH\n\n` +
        `Validation Errors:\n${validationResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n` +
        `---\nOriginal Note: ${order.note || 'None'}`;

      console.warn(`[Shopify Import] Order ${order.name} marked as TRASH due to validation errors:`, validationResult.errors);
    } else {
      // Normal status determination for valid orders
      if (order.financial_status === 'paid' && order.fulfillment_status === 'fulfilled') {
        leadStatus = 'sale';
      } else if (order.financial_status === 'refunded' || order.financial_status === 'voided') {
        leadStatus = 'rejected';
      } else if (order.financial_status === 'paid') {
        leadStatus = 'hold'; // Paid but not fulfilled yet
      }
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
      customerPhone: phoneValidation.formattedPhone || phoneValidation.originalPhone,
      customerPhoneOriginal: phoneValidation.originalPhone,
      customerPhoneFormatted: phoneValidation.formattedPhone,
      customerAddress,
      customerCity,
      customerCountry,
      status: leadStatus,
      quality: 'standard' as const,
      value: value.toString(),
      payout: (value * 0.1).toString(), // Default 10% payout
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
        validationStatus: validationResult.isValid ? 'passed' : 'failed',
        validationErrors: validationResult.isValid ? null : validationResult.errors,
      },
      notes: notes, // Use the notes variable that includes validation errors if any
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
    // STEP 1: VALIDATE ORDER
    const validationResult = await validateShopifyOrder(order);

    const destination = fulfillmentOrder.destination;

    // Build customer info from destination
    const customerName = destination.first_name && destination.last_name
      ? `${destination.first_name} ${destination.last_name}`.trim()
      : destination.company || 'Unknown Customer';

    const customerEmail = destination.email || order.email || null;
    const customerPhoneRaw = destination.phone || '';

    // Validate and format phone number
    const phoneValidation = customerPhoneRaw
      ? await formatPhone(customerPhoneRaw, 'AR', 'shopify', shop)
      : { originalPhone: '', formattedPhone: null, isValid: false };

    // Check for duplicate phone number today
    const duplicateCheck = await checkDuplicateLeadToday(phoneValidation.formattedPhone);

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

    // STEP 2: DETERMINE LEAD STATUS
    let leadStatus: 'sale' | 'hold' | 'rejected' | 'trash' = 'hold';
    let notes = order.note || `Imported from Shopify (Fulfillment Service): ${order.name}`;

    // Check for duplicate first (highest priority)
    if (duplicateCheck.isDuplicate) {
      leadStatus = 'trash';
      notes = `⚠️ LEAD DUPLICADO - AUTOMATIC TRASH\n\n` +
        `Mismo número de teléfono ya ingresado hoy.\n` +
        `Lead original: ${duplicateCheck.duplicateLead?.leadNumber}\n` +
        `Fecha original: ${duplicateCheck.duplicateLead?.createdAt.toISOString()}\n\n` +
        `---\nOriginal Note: ${order.note || 'None'}`;

      console.warn(`[Shopify Fulfillment Import] Order ${order.name} marked as TRASH due to duplicate phone:`, {
        phone: phoneValidation.formattedPhone,
        originalLead: duplicateCheck.duplicateLead?.leadNumber
      });
    } else if (!validationResult.isValid) {
      // If validation failed, mark as trash and include error details
      leadStatus = 'trash';
      notes = `⚠️ ORDER VALIDATION FAILED - AUTOMATIC TRASH\n\n` +
        `Validation Errors:\n${validationResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n` +
        `---\nOriginal Note: ${order.note || 'None'}`;

      console.warn(`[Shopify Fulfillment Import] Order ${order.name} marked as TRASH due to validation errors:`, validationResult.errors);
    } else {
      // Normal status determination for valid orders
      if (fulfillmentOrder.status === 'closed') {
        leadStatus = 'sale';
      } else if (fulfillmentOrder.status === 'cancelled') {
        leadStatus = 'rejected';
      } else if (fulfillmentOrder.status === 'in_progress') {
        leadStatus = 'hold';
      }
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
      customerPhone: phoneValidation.formattedPhone || phoneValidation.originalPhone,
      customerPhoneOriginal: phoneValidation.originalPhone,
      customerPhoneFormatted: phoneValidation.formattedPhone,
      customerAddress,
      customerCity,
      customerCountry,
      status: leadStatus,
      quality: 'standard' as const,
      value: value.toString(),
      payout: (value * 0.1).toString(), // Default 10% payout
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
        validationStatus: validationResult.isValid ? 'passed' : 'failed',
        validationErrors: validationResult.isValid ? null : validationResult.errors,
      },
      notes: notes, // Use the notes variable that includes validation errors if any
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
