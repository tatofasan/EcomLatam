-- Migration: Add Shopify Stores Table
-- Created: 2025-10-09
-- Description: Creates the shopify_stores table for Shopify integration

-- Create enum for shopify store status
DO $$ BEGIN
    CREATE TYPE shopify_store_status AS ENUM ('active', 'inactive', 'error', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create shopify_stores table
CREATE TABLE IF NOT EXISTS shopify_stores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shopify_stores_user_id ON shopify_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_shop ON shopify_stores(shop);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_status ON shopify_stores(status);

-- Add comment to table
COMMENT ON TABLE shopify_stores IS 'Stores Shopify credentials and connection status for each user';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Shopify stores table created successfully';
END $$;
