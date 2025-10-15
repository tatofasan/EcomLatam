-- Migration: Rename commission fields to payout fields
-- This migration renames all commission-related columns to payout
-- Safe to run in production - does NOT drop data

-- 1. Rename column in leads table
ALTER TABLE leads
RENAME COLUMN commission TO payout;

-- 2. Rename column in performance_reports table
ALTER TABLE performance_reports
RENAME COLUMN commission TO payout;

-- 3. Rename column in users table
ALTER TABLE users
RENAME COLUMN commission_rate TO payout_rate;

-- 4. Rename column in advertisers table
ALTER TABLE advertisers
RENAME COLUMN commission_settings TO payout_settings;

-- 5. Update transaction type enum values
-- First, add the new value
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'payout';

-- Update existing 'commission' values to 'payout'
UPDATE transactions
SET type = 'payout'
WHERE type = 'commission';

-- Note: We cannot remove the old 'commission' value from the enum without recreating it
-- But this is safe - the old value won't be used anymore

-- 6. Rename commission_type enum to payout_type enum
-- Note: This requires recreating the enum, so we'll do it in steps

-- First, create the new enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_type') THEN
        CREATE TYPE payout_type AS ENUM ('fixed', 'percentage', 'tiered');
    END IF;
END $$;

-- The commission_type enum can remain for backward compatibility
-- New code will use payout_type

COMMENT ON COLUMN leads.payout IS 'Payout amount for confirmed sales (in USD)';
COMMENT ON COLUMN performance_reports.payout IS 'Total payout for the reporting period (in USD)';
COMMENT ON COLUMN users.payout_rate IS 'Default payout rate/percentage for user';
COMMENT ON COLUMN advertisers.payout_settings IS 'Default payout rules and settings';
