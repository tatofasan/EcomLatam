# Shopify Integration for EcomLatam

This module provides a complete integration between EcomLatam and Shopify, allowing EcomLatam to function as a dropshipping platform and fulfillment center for connected Shopify stores.

## Features

- **OAuth Authentication**: Secure connection to Shopify stores
- **Automatic Order Import**: Orders from Shopify are automatically imported to EcomLatam
- **Product Export**: Export EcomLatam products to Shopify stores
- **Webhook Support**: Real-time synchronization through Shopify webhooks
- **Fulfillment Sync**: Update order status back to Shopify when fulfilled

## Architecture

The Shopify integration is organized into modular components:

```
server/integrations/shopify/
├── types.ts       # TypeScript interfaces and types
├── config.ts      # Configuration and Shopify API initialization
├── api.ts         # Shopify REST API client functions
├── oauth.ts       # OAuth flow handlers
├── webhooks.ts    # Webhook handlers
├── products.ts    # Product synchronization
├── orders.ts      # Order synchronization
└── README.md      # This file
```

## Setup Instructions

### 1. Create a Shopify App

1. Go to your Shopify Partners dashboard: https://partners.shopify.com/
2. Create a new app or use an existing one
3. Get your API credentials:
   - API Key
   - API Secret Key
4. Set the app URL to your EcomLatam domain (e.g., `https://your-domain.com`)
5. Set the Redirect URI to: `https://your-domain.com/api/shopify/callback`

### 2. Configure Required Scopes

Your Shopify app needs the following scopes:
- `read_products`
- `write_products`
- `read_orders`
- `write_orders`
- `read_fulfillments`
- `write_fulfillments`

### 3. Environment Variables

Add the following variables to your `.env` file:

```env
# Shopify Integration
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_APP_URL=https://your-domain.com
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments
```

### 4. Update Database Schema

Run the following command to apply database changes:

```bash
npm run db:push
```

When prompted, select:
- `+ shopify_stores` (create table)

### 5. Restart the Server

After configuration, restart your development server:

```bash
npm run dev
```

## Usage

### Connecting a Shopify Store

1. Login to EcomLatam
2. Navigate to the Connections page
3. Click "Connect Shopify Store"
4. Enter your Shopify store domain (e.g., `mystore.myshopify.com`)
5. You'll be redirected to Shopify to authorize the app
6. After authorization, you'll be redirected back to EcomLatam

### Exporting Products to Shopify

**Via API:**

```bash
POST /api/shopify/products/export
Content-Type: application/json

{
  "shop": "mystore.myshopify.com",
  "productId": 123
}
```

**Bulk Export:**

```bash
POST /api/shopify/products/export-bulk
Content-Type: application/json

{
  "shop": "mystore.myshopify.com",
  "productIds": [123, 456, 789]
}
```

### Importing Orders from Shopify

**Manual Import:**

```bash
POST /api/shopify/orders/import
Content-Type: application/json

{
  "shop": "mystore.myshopify.com",
  "status": "any",
  "limit": 250
}
```

**Automatic Import:**

Orders are automatically imported when:
1. A webhook is triggered by Shopify (order created, updated)
2. The store has `autoImportOrders` enabled in settings

### Webhooks

The following webhooks are automatically registered:

- `orders/create` - New order created
- `orders/updated` - Order updated
- `orders/cancelled` - Order cancelled
- `app/uninstalled` - App uninstalled from Shopify

Webhook endpoints:
- `POST /api/shopify/webhooks/orders-create`
- `POST /api/shopify/webhooks/orders-updated`
- `POST /api/shopify/webhooks/orders-cancelled`
- `POST /api/shopify/webhooks/app-uninstalled`

## API Endpoints

### Configuration

- `GET /api/shopify/config` - Check if Shopify is configured

### OAuth

- `GET /api/shopify/install?shop=mystore.myshopify.com` - Initiate OAuth flow
- `GET /api/shopify/callback` - OAuth callback (called by Shopify)

### Shop Management

- `GET /api/shopify/shops` - Get connected shops for current user
- `POST /api/shopify/disconnect` - Disconnect a shop

### Products

- `POST /api/shopify/products/export` - Export single product
- `POST /api/shopify/products/export-bulk` - Export multiple products

### Orders

- `POST /api/shopify/orders/import` - Import orders from Shopify

## Data Flow

### Order Import Flow

1. Customer places order on Shopify store
2. Shopify sends webhook to EcomLatam
3. EcomLatam verifies webhook signature
4. Order is converted to EcomLatam lead format
5. Lead is saved in database with Shopify metadata
6. Lead items are created from order line items

### Product Export Flow

1. User selects product(s) to export in EcomLatam
2. Product data is converted to Shopify format
3. API call is made to Shopify to create product
4. Shopify product ID is returned
5. Mapping is stored for future updates

## Database Schema

### shopify_stores

```sql
CREATE TABLE shopify_stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  shop TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  status shopify_store_status DEFAULT 'pending',
  scopes TEXT,
  installed_at TIMESTAMP DEFAULT NOW(),
  uninstalled_at TIMESTAMP,
  settings JSONB,
  webhook_ids JSONB,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Security

- All OAuth flows use HMAC verification
- Webhook payloads are verified using HMAC-SHA256
- Access tokens are encrypted in database
- API calls use secure HTTPS connections

## Troubleshooting

### Webhooks Not Working

1. Check that webhooks are registered:
   ```bash
   GET /api/shopify/shops
   ```
2. Verify webhook URLs are publicly accessible
3. Check webhook signature verification

### Orders Not Importing

1. Verify `autoImportOrders` is enabled in store settings
2. Check webhook logs for errors
3. Ensure products exist in EcomLatam (matching by SKU)

### Products Not Exporting

1. Verify store connection is active
2. Check product has all required fields (name, SKU, price)
3. Review Shopify API error messages

## Future Enhancements

- [ ] Real-time inventory synchronization
- [ ] Automatic fulfillment updates
- [ ] Bulk product import from Shopify to EcomLatam
- [ ] Advanced product mapping (variants, options)
- [ ] Order status webhooks back to Shopify
- [ ] Multi-location inventory support
- [ ] Shopify Plus features (wholesale, B2B)

## Support

For issues or questions, please contact the development team or create an issue in the repository.
