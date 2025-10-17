-- ============================================================================
-- PAYOUT EXCEPTIONS MIGRATION
-- ============================================================================
--
-- This migration creates the payout_exceptions table for hierarchical
-- payout configuration in the affiliate marketing platform.
--
-- Hierarchical Priority System:
--   1. Publisher-specific exception (product_id + user_id + publisher_id)
--   2. Affiliate-level exception (product_id + user_id + publisher_id=NULL)
--   3. Default product payout (product.payout_po)
--
-- IMPORTANT: Use apply-payout-exceptions-migration.mjs to apply this migration
-- in Railway, as it includes idempotency checks and transaction handling.
--
-- Date: 2025-10-17
-- ============================================================================

-- Create payout_exceptions table
CREATE TABLE IF NOT EXISTS payout_exceptions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  publisher_id TEXT,
  payout_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique constraint for preventing duplicates
-- A user can only have ONE payout exception per product+publisherId combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_exceptions_unique
ON payout_exceptions(product_id, user_id, COALESCE(publisher_id, ''));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payout_exceptions_product
ON payout_exceptions(product_id);

CREATE INDEX IF NOT EXISTS idx_payout_exceptions_user
ON payout_exceptions(user_id);

CREATE INDEX IF NOT EXISTS idx_payout_exceptions_publisher
ON payout_exceptions(publisher_id)
WHERE publisher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_exceptions_created
ON payout_exceptions(created_at DESC);

-- Add table comment for documentation
COMMENT ON TABLE payout_exceptions IS
'Hierarchical payout configuration with 3 priority levels: Publisher-specific > Affiliate-level > Default product payout';

-- Add column comments for documentation
COMMENT ON COLUMN payout_exceptions.publisher_id IS
'NULL = applies to entire affiliate (level 2), NOT NULL = publisher-specific (level 1)';

COMMENT ON COLUMN payout_exceptions.payout_amount IS
'Custom payout amount that overrides product.payout_po';

-- ============================================================================
-- EXAMPLE QUERIES
-- ============================================================================

-- Example 1: Create affiliate-level exception (applies to all publishers for user)
-- INSERT INTO payout_exceptions (product_id, user_id, publisher_id, payout_amount)
-- VALUES (5, 123, NULL, 35.00);

-- Example 2: Create publisher-specific exception (overrides affiliate-level)
-- INSERT INTO payout_exceptions (product_id, user_id, publisher_id, payout_amount)
-- VALUES (5, 123, 'PUB456', 45.00);

-- Example 3: Query to calculate payout with hierarchical logic
-- SELECT COALESCE(
--   -- Priority 1: Publisher-specific exception
--   (SELECT payout_amount FROM payout_exceptions
--    WHERE product_id = 5 AND user_id = 123 AND publisher_id = 'PUB456' LIMIT 1),
--   -- Priority 2: Affiliate-level exception
--   (SELECT payout_amount FROM payout_exceptions
--    WHERE product_id = 5 AND user_id = 123 AND publisher_id IS NULL LIMIT 1),
--   -- Priority 3: Default product payout
--   (SELECT payout_po FROM products WHERE id = 5 LIMIT 1),
--   0
-- ) AS calculated_payout;

-- ============================================================================
