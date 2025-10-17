/**
 * Apply Payout Exceptions Migration
 *
 * This script creates the payout_exceptions table for hierarchical payout configuration
 * Safe to run in production - idempotent (can run multiple times)
 *
 * Priority system:
 * 1. Publisher-specific exception (productId + userId + publisherId)
 * 2. Affiliate-level exception (productId + userId + publisherId=NULL)
 * 3. Default product payout (product.payoutPo)
 *
 * Usage:
 *   node apply-payout-exceptions-migration.mjs
 *   or in Railway: railway run node apply-payout-exceptions-migration.mjs
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting payout exceptions migration...\n');

    // Check if migration was already applied (for logging purposes only)
    console.log('📋 Checking migration status...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'payout_exceptions'
      ) as table_exists;
    `);

    const alreadyExists = checkResult.rows[0].table_exists;

    if (alreadyExists) {
      console.log('ℹ️  Payout exceptions table already exists.');
      console.log('   Running migration anyway to ensure all indexes and constraints exist...\n');
    } else {
      console.log('📋 Table does not exist yet. Creating...\n');
    }

    // Apply migration in transaction (fully idempotent)
    // All CREATE statements use IF NOT EXISTS, so safe to run multiple times
    console.log('📋 Applying migration...');

    await client.query('BEGIN');

    // Create payout_exceptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payout_exceptions (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        publisher_id TEXT,
        payout_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✓ Created payout_exceptions table');

    // Create unique constraint for preventing duplicates
    // A user can only have ONE payout exception per product+publisherId combination
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_exceptions_unique
      ON payout_exceptions(product_id, user_id, COALESCE(publisher_id, ''))
    `);
    console.log('  ✓ Created unique constraint on (product_id, user_id, publisher_id)');

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payout_exceptions_product
      ON payout_exceptions(product_id)
    `);
    console.log('  ✓ Created index on payout_exceptions.product_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payout_exceptions_user
      ON payout_exceptions(user_id)
    `);
    console.log('  ✓ Created index on payout_exceptions.user_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payout_exceptions_publisher
      ON payout_exceptions(publisher_id)
      WHERE publisher_id IS NOT NULL
    `);
    console.log('  ✓ Created index on payout_exceptions.publisher_id (partial index)');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payout_exceptions_created
      ON payout_exceptions(created_at DESC)
    `);
    console.log('  ✓ Created index on payout_exceptions.created_at');

    // Add table comment for documentation
    await client.query(`
      COMMENT ON TABLE payout_exceptions IS
      'Hierarchical payout configuration with 3 priority levels: Publisher-specific > Affiliate-level > Default product payout'
    `);

    // Add column comments for documentation
    await client.query(`
      COMMENT ON COLUMN payout_exceptions.publisher_id IS
      'NULL = applies to entire affiliate (level 2), NOT NULL = publisher-specific (level 1)'
    `);

    await client.query(`
      COMMENT ON COLUMN payout_exceptions.payout_amount IS
      'Custom payout amount that overrides product.payout_po'
    `);

    console.log('  ✓ Added table and column comments');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');

    if (alreadyExists) {
      console.log('✓ Verified all indexes and constraints exist');
      console.log('✓ Migration is up to date');
    } else {
      console.log('\n🎉 Payout exceptions table created successfully!');
      console.log('\n📊 Created:');
      console.log('   - payout_exceptions table (hierarchical payout configuration)');
      console.log('   - 1 unique constraint (prevents duplicates)');
      console.log('   - 4 indexes for optimized queries');
    }

    console.log('\n💡 Hierarchical payout priority:');
    console.log('   1. Publisher-specific (product_id + user_id + publisher_id)');
    console.log('   2. Affiliate-level (product_id + user_id + publisher_id=NULL)');
    console.log('   3. Default product payout (product.payout_po)');
    console.log('\n🔒 Safe to run multiple times - fully idempotent!');

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nThe migration was rolled back. No changes were made to the database.');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
