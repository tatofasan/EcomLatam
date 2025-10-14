-- Migration: Add UTM tracking fields to leads table
-- Created: 2025-10-14
-- Description: Adds utm_source, utm_medium, and utm_campaign columns to leads table for proper tracking

-- Add utm_source column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'utm_source'
    ) THEN
        ALTER TABLE leads ADD COLUMN utm_source TEXT;
        RAISE NOTICE 'Column utm_source added to leads table';
    ELSE
        RAISE NOTICE 'Column utm_source already exists in leads table';
    END IF;
END $$;

-- Add utm_medium column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'utm_medium'
    ) THEN
        ALTER TABLE leads ADD COLUMN utm_medium TEXT;
        RAISE NOTICE 'Column utm_medium added to leads table';
    ELSE
        RAISE NOTICE 'Column utm_medium already exists in leads table';
    END IF;
END $$;

-- Add utm_campaign column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'utm_campaign'
    ) THEN
        ALTER TABLE leads ADD COLUMN utm_campaign TEXT;
        RAISE NOTICE 'Column utm_campaign added to leads table';
    ELSE
        RAISE NOTICE 'Column utm_campaign already exists in leads table';
    END IF;
END $$;

-- Create indexes for faster UTM queries
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_utm_medium ON leads(utm_medium) WHERE utm_medium IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(utm_campaign) WHERE utm_campaign IS NOT NULL;

-- Optionally, you can populate existing Shopify leads with 'shopify' utm_source
-- Uncomment the line below if you want to update existing Shopify orders
-- UPDATE leads SET utm_source = 'shopify' WHERE lead_number LIKE 'SHOPIFY-%' AND utm_source IS NULL;
