-- Migration: Add missing columns to leads table
-- This migration adds publisher_id and subacc fields that were added in recent schema updates

-- Add publisher_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'publisher_id'
    ) THEN
        ALTER TABLE leads ADD COLUMN publisher_id text;
    END IF;
END $$;

-- Add subacc1 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc1'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc1 text;
    END IF;
END $$;

-- Add subacc2 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc2'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc2 text;
    END IF;
END $$;

-- Add subacc3 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc3'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc3 text;
    END IF;
END $$;

-- Add subacc4 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc4'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc4 text;
    END IF;
END $$;

-- Add customer_postal_code column if it doesn't exist (from recent schema update)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'customer_postal_code'
    ) THEN
        ALTER TABLE leads ADD COLUMN customer_postal_code text;
    END IF;
END $$;
