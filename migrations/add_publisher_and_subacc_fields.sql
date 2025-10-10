-- Migration: Add publisherId and subacc fields, remove trafficSource and UTM fields
-- Date: 2025-10-10

-- Add new affiliate tracking fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS publisher_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subacc1 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subacc2 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subacc3 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subacc4 TEXT;

-- Drop old fields
ALTER TABLE leads DROP COLUMN IF EXISTS traffic_source;
ALTER TABLE leads DROP COLUMN IF EXISTS utm_source;
ALTER TABLE leads DROP COLUMN IF EXISTS utm_medium;
ALTER TABLE leads DROP COLUMN IF EXISTS utm_campaign;

-- Add comment
COMMENT ON COLUMN leads.publisher_id IS 'Publisher/Affiliate identifier';
COMMENT ON COLUMN leads.subacc1 IS 'Sub-account 1 for affiliate reporting';
COMMENT ON COLUMN leads.subacc2 IS 'Sub-account 2 for affiliate reporting';
COMMENT ON COLUMN leads.subacc3 IS 'Sub-account 3 for affiliate reporting';
COMMENT ON COLUMN leads.subacc4 IS 'Sub-account 4 for affiliate reporting';
