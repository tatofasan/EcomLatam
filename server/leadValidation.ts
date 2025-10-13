/**
 * Lead Validation Module
 *
 * This module provides a generic validation function for leads/orders
 * that can be used by multiple sources (Shopify, API, etc.)
 */

import { db } from "./db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LeadDataForValidation {
  customerName: string;
  customerPhone: string;
  customerAddress: string; // Street address
  customerCity: string;
  customerPostalCode: string;
  customerProvince: string; // State/province
  lineItems: Array<{
    productName?: string;
    sku: string;
    price: number; // Unit price
    quantity: number;
  }>;
}

/**
 * Validates a lead/order data according to EcomLatam business rules:
 * 1. Customer name must be valid (min 2 chars)
 * 2. Phone number must be valid (min 8 chars)
 * 3. Street address must be valid (min 5 chars)
 * 4. Postal code must exist (min 3 chars)
 * 5. Province/state must exist (min 2 chars)
 * 6. City must exist (min 2 chars)
 * 7. All line items must have SKUs that exist in the catalog
 * 8. All line item prices must match catalog prices
 */
export async function validateLead(data: LeadDataForValidation): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate customer name
  if (!data.customerName || data.customerName.trim().length < 2) {
    errors.push('INVALID_CUSTOMER_NAME: Customer name is missing or too short (min 2 characters)');
  }

  // 2. Validate phone number
  const phoneClean = data.customerPhone ? data.customerPhone.trim() : '';
  if (!phoneClean || phoneClean.length < 8) {
    errors.push('INVALID_PHONE: Phone number is missing or invalid (min 8 characters)');
  }

  // 3. Validate street address
  if (!data.customerAddress || data.customerAddress.trim().length < 5) {
    errors.push('INVALID_ADDRESS: Street address is missing or too short (min 5 characters)');
  }

  // 4. Validate postal code
  if (!data.customerPostalCode || data.customerPostalCode.trim().length < 3) {
    errors.push('INVALID_POSTAL_CODE: Postal code is missing or invalid (min 3 characters)');
  }

  // 5. Validate province/state
  if (!data.customerProvince || data.customerProvince.trim().length < 2) {
    errors.push('INVALID_PROVINCE: Province/state is missing (min 2 characters)');
  }

  // 6. Validate city
  if (!data.customerCity || data.customerCity.trim().length < 2) {
    errors.push('INVALID_CITY: City is missing or invalid (min 2 characters)');
  }

  // 7 & 8. Validate line items (SKU and price matching)
  if (!data.lineItems || data.lineItems.length === 0) {
    errors.push('NO_LINE_ITEMS: Order has no products');
  } else {
    for (const lineItem of data.lineItems) {
      // Check SKU exists
      if (!lineItem.sku || lineItem.sku.trim() === '') {
        const productName = lineItem.productName || 'Unknown product';
        errors.push(`MISSING_SKU: Product "${productName}" has no SKU`);
        continue;
      }

      // Find product in catalog by SKU
      let catalogProduct;
      try {
        [catalogProduct] = await db
          .select()
          .from(products)
          .where(eq(products.sku, lineItem.sku))
          .limit(1);
      } catch (dbError) {
        console.error('[Lead Validation] Database error:', dbError);
        errors.push(`DB_ERROR: Could not verify SKU "${lineItem.sku}" in catalog`);
        continue;
      }

      if (!catalogProduct) {
        const productName = lineItem.productName || lineItem.sku;
        errors.push(`SKU_NOT_FOUND: SKU "${lineItem.sku}" not found in catalog for product "${productName}"`);
        continue;
      }

      // Validate price matches (allow 1 cent difference for rounding)
      const lineItemPrice = lineItem.price;
      const catalogPrice = parseFloat(catalogProduct.price || '0');
      const priceDifference = Math.abs(lineItemPrice - catalogPrice);

      if (priceDifference > 0.01) {
        const productName = lineItem.productName || catalogProduct.name;
        errors.push(
          `PRICE_MISMATCH: Product "${productName}" (SKU: ${lineItem.sku}) has price ${lineItemPrice.toFixed(2)} ` +
          `but catalog price is ${catalogPrice.toFixed(2)}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Formats validation errors for display in order notes
 */
export function formatValidationErrors(errors: string[]): string {
  return `⚠️ ORDER VALIDATION FAILED - AUTOMATIC TRASH\n\n` +
    `Validation Errors:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
}
