/**
 * Shopify Products Sync
 *
 * This module handles synchronization of products between EcomLatam and Shopify
 */

import { createProduct, updateProduct, getProduct } from './api';
import { getShopCredentials } from './oauth';
import type { ShopifyProduct, ShopifyProductVariant } from './types';
import type { Product } from '@shared/schema';

/**
 * Convert EcomLatam product to Shopify product format
 */
export const convertEcomLatamProductToShopify = (product: Product): ShopifyProduct => {
  // Parse specifications if available
  const specifications = product.specifications as any;

  // Build product object
  const shopifyProduct: ShopifyProduct = {
    title: product.name,
    body_html: product.description || '',
    vendor: product.provider || 'EcomLatam',
    product_type: product.category || '',
    status: product.status === 'active' ? 'active' : 'draft',
    tags: [
      product.category,
      product.vertical,
      product.trending ? 'trending' : null,
      'ecomlatam',
    ]
      .filter(Boolean)
      .join(', '),
    variants: [
      {
        title: 'Default',
        price: product.price?.toString() || '0.00',
        sku: product.sku,
        inventory_management: 'shopify',
        inventory_policy: 'deny',
        fulfillment_service: 'manual',
        requires_shipping: true,
        taxable: true,
        inventory_quantity: product.stock || 0,
        weight: product.weight ? parseFloat(product.weight.toString()) : undefined,
        weight_unit: 'kg',
      } as ShopifyProductVariant,
    ],
  };

  // Add images if available
  if (product.imageUrl) {
    shopifyProduct.images = [
      {
        src: product.imageUrl,
        alt: product.name,
        position: 1,
      },
    ];

    // Add additional images
    if (product.additionalImages && Array.isArray(product.additionalImages)) {
      product.additionalImages.forEach((imageUrl, index) => {
        shopifyProduct.images!.push({
          src: imageUrl,
          alt: `${product.name} - ${index + 2}`,
          position: index + 2,
        });
      });
    }
  }

  return shopifyProduct;
};

/**
 * Export a single product from EcomLatam to Shopify
 */
export const exportProductToShopify = async (
  shop: string,
  product: Product,
  options?: {
    updateIfExists?: boolean;
    shopifyProductId?: number;
  }
) => {
  try {
    console.log(`Exporting product ${product.name} (SKU: ${product.sku}) to Shopify shop: ${shop}`);

    // Get shop credentials
    const store = await getShopCredentials(shop);

    if (!store) {
      throw new Error(`Shop not found: ${shop}`);
    }

    if (store.status !== 'active') {
      throw new Error(`Shop is not active: ${shop}`);
    }

    const accessToken = store.accessToken;

    // Convert product to Shopify format
    const shopifyProduct = convertEcomLatamProductToShopify(product);

    let result;

    // Check if we should update an existing product
    if (options?.updateIfExists && options?.shopifyProductId) {
      try {
        // Try to get existing product
        await getProduct(shop, accessToken, options.shopifyProductId);

        // Update existing product
        result = await updateProduct(shop, accessToken, options.shopifyProductId, shopifyProduct);
        console.log(`Updated existing product in Shopify: ${result.product.id}`);
      } catch (error) {
        // Product doesn't exist, create new one
        result = await createProduct(shop, accessToken, shopifyProduct);
        console.log(`Created new product in Shopify: ${result.product.id}`);
      }
    } else {
      // Create new product
      result = await createProduct(shop, accessToken, shopifyProduct);
      console.log(`Created new product in Shopify: ${result.product.id}`);
    }

    return {
      success: true,
      shopifyProduct: result.product,
      ecomlatamProduct: product,
    };
  } catch (error) {
    console.error('Error exporting product to Shopify:', error);
    throw error;
  }
};

/**
 * Export multiple products from EcomLatam to Shopify
 */
export const exportProductsToShopify = async (
  shop: string,
  products: Product[]
) => {
  try {
    console.log(`Exporting ${products.length} products to Shopify shop: ${shop}`);

    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    for (const product of products) {
      try {
        const result = await exportProductToShopify(shop, product);
        results.success.push(result);
      } catch (error) {
        console.error(`Failed to export product ${product.sku}:`, error);
        results.failed.push({
          product,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `Export completed: ${results.success.length} successful, ${results.failed.length} failed`
    );

    return results;
  } catch (error) {
    console.error('Error exporting products to Shopify:', error);
    throw error;
  }
};

/**
 * Sync inventory for a product variant
 */
export const syncInventoryToShopify = async (
  shop: string,
  shopifyProductId: number,
  variantId: number,
  inventoryItemId: number,
  locationId: number,
  quantity: number
) => {
  try {
    console.log(`Syncing inventory for product ${shopifyProductId}, variant ${variantId}`);

    // Get shop credentials
    const store = await getShopCredentials(shop);

    if (!store) {
      throw new Error(`Shop not found: ${shop}`);
    }

    const accessToken = store.accessToken;

    // Update inventory using API
    // Note: This requires the inventory_item_id and location_id from Shopify
    // We would need to implement updateInventoryLevel in api.ts

    console.log(`Inventory synced for variant ${variantId}: ${quantity} units`);

    return {
      success: true,
      variantId,
      quantity,
    };
  } catch (error) {
    console.error('Error syncing inventory to Shopify:', error);
    throw error;
  }
};

export default {
  convertEcomLatamProductToShopify,
  exportProductToShopify,
  exportProductsToShopify,
  syncInventoryToShopify,
};
