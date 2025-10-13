-- Migration: Add phone validation fields to leads table
-- Created: 2025-01-10
-- Description: Adds customer_phone_original and customer_phone_formatted fields to store both original and validated phone numbers

-- Add customer_phone_original column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_phone_original TEXT;

-- Add customer_phone_formatted column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_phone_formatted TEXT;

-- Update existing records to copy current customerPhone to customerPhoneOriginal
UPDATE leads SET customer_phone_original = customer_phone WHERE customer_phone_original IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.customer_phone_original IS 'Original phone number as received from external sources';
COMMENT ON COLUMN leads.customer_phone_formatted IS 'Formatted and validated phone number with area code (e.g., 1155551234 for Argentina)';
