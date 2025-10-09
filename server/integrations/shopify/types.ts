/**
 * Shopify Integration Types
 *
 * This module contains TypeScript types and interfaces for Shopify integration
 */

// Shopify OAuth Types
export interface ShopifyOAuthQuery {
  shop: string;
  code?: string;
  hmac?: string;
  timestamp?: string;
  state?: string;
}

export interface ShopifyAccessTokenResponse {
  access_token: string;
  scope: string;
}

// Shopify Product Types
export interface ShopifyProduct {
  id?: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: 'active' | 'draft' | 'archived';
  variants: ShopifyProductVariant[];
  images?: ShopifyProductImage[];
}

export interface ShopifyProductVariant {
  id?: number;
  product_id?: number;
  title?: string;
  price: string;
  sku?: string;
  position?: number;
  inventory_management?: string;
  fulfillment_service?: string;
  inventory_policy?: string;
  compare_at_price?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  taxable?: boolean;
  barcode?: string;
  grams?: number;
  weight?: number;
  weight_unit?: string;
  inventory_quantity?: number;
  requires_shipping?: boolean;
}

export interface ShopifyProductImage {
  id?: number;
  product_id?: number;
  position?: number;
  src: string;
  alt?: string;
}

// Shopify Order Types
export interface ShopifyOrder {
  id: number;
  email?: string;
  created_at: string;
  updated_at: string;
  number: number;
  order_number: number;
  name: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: ShopifyCustomer;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
  shipping_lines: ShopifyShippingLine[];
  note?: string;
  tags?: string;
  source_name?: string;
  source_identifier?: string;
  source_url?: string;
}

export interface ShopifyCustomer {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  default_address?: ShopifyAddress;
}

export interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
  name?: string;
}

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
  variant_title?: string;
  vendor?: string;
  fulfillment_status: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  name: string;
  properties?: Array<{ name: string; value: string }>;
}

export interface ShopifyShippingLine {
  id: number;
  title: string;
  price: string;
  code: string;
  source: string;
}

// Shopify Fulfillment Types
export interface ShopifyFulfillment {
  id?: number;
  order_id: number;
  status?: 'pending' | 'open' | 'success' | 'cancelled' | 'error' | 'failure';
  tracking_company?: string;
  tracking_numbers?: string[];
  tracking_urls?: string[];
  notify_customer?: boolean;
  line_items?: Array<{
    id: number;
    quantity: number;
  }>;
}

// Shopify Webhook Types
export interface ShopifyWebhookTopic {
  topic: string;
  address: string;
}

export interface ShopifyWebhook {
  id?: number;
  topic: string;
  address: string;
  format: 'json' | 'xml';
  created_at?: string;
  updated_at?: string;
}

// EcomLatam Integration Settings
export interface ShopifyStoreSettings {
  autoImportOrders?: boolean;
  autoFulfillOrders?: boolean;
  autoSyncInventory?: boolean;
  orderTagPrefix?: string;
  fulfillmentService?: string;
  locationId?: number;
}

// Webhook Payload Types
export interface ShopifyOrderWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  [key: string]: any;
}

export interface ShopifyProductWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  [key: string]: any;
}

// Shopify FulfillmentOrder Types (for Fulfillment Service model)
export interface ShopifyFulfillmentOrder {
  id: number;
  shop_id: number;
  order_id: number;
  assigned_location_id: number;
  request_status: 'unsubmitted' | 'submitted' | 'accepted' | 'rejected' | 'cancellation_requested' | 'cancellation_accepted' | 'cancelled' | 'closed';
  status: 'open' | 'in_progress' | 'cancelled' | 'incomplete' | 'closed';
  supported_actions: Array<'create_fulfillment' | 'request_cancellation' | 'cancel_fulfillment_order'>;
  destination: ShopifyFulfillmentDestination;
  line_items: ShopifyFulfillmentOrderLineItem[];
  fulfill_at?: string;
  fulfill_by?: string;
  international_duties?: any;
  fulfillment_holds: any[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyFulfillmentDestination {
  id?: number;
  address1?: string;
  address2?: string;
  city?: string;
  company?: string;
  country?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  province?: string;
  zip?: string;
}

export interface ShopifyFulfillmentOrderLineItem {
  id: number;
  shop_id: number;
  fulfillment_order_id: number;
  quantity: number;
  line_item_id: number;
  inventory_item_id: number;
  fulfillable_quantity: number;
  variant_id: number;
}

export interface ShopifyAssignedFulfillmentOrder {
  assignment_status: 'cancellation_requested' | 'fulfillment_requested' | 'fulfillment_accepted';
  destination: ShopifyFulfillmentDestination;
  id: number;
  line_items: ShopifyFulfillmentOrderLineItem[];
  order_id: number;
  request_status: string;
  shop_id: number;
  status: string;
}

export interface ShopifyFulfillmentOrdersResponse {
  fulfillment_orders: ShopifyFulfillmentOrder[];
}

export interface ShopifyFulfillmentRequest {
  message?: string;
  fulfillment_order_line_items?: Array<{
    id: number;
    quantity: number;
  }>;
}
