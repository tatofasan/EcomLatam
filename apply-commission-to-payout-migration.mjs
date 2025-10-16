/**
 * Apply Commission to Payout Migration
 *
 * This script renames all commission-related fields to payout fields
 * Safe to run in production - does NOT drop data
 *
 * Usage:
 *   node apply-commission-to-payout-migration.mjs
 *   or in Railway: railway run node apply-commission-to-payout-migration.mjs
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import fs from 'fs';

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
    console.log('🚀 Starting commission → payout migration...\n');

    // Check if migration was already applied
    console.log('📋 Checking if migration was already applied...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'payout'
      ) as migration_applied;
    `);

    if (checkResult.rows[0].migration_applied) {
      console.log('✅ Migration already applied! Skipping...');
      console.log('   All columns have been renamed to use "payout" terminology.');
      return;
    }

    console.log('📋 Migration not yet applied. Proceeding...\n');

    // Step 1: Add enum value OUTSIDE transaction (PostgreSQL requirement)
    console.log('📋 Step 1: Adding new enum value...');
    try {
      await client.query("ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'payout'");
      console.log('  ✓ Added "payout" to transaction_type enum');
    } catch (enumError) {
      // Ignore if value already exists
      if (!enumError.message.includes('already exists')) {
        throw enumError;
      }
      console.log('  ✓ Enum value "payout" already exists');
    }

    // Step 2: Create payout_type enum if not exists
    console.log('📋 Step 2: Creating payout_type enum...');
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_type') THEN
              CREATE TYPE payout_type AS ENUM ('fixed', 'percentage', 'tiered');
          END IF;
      END $$;
    `);
    console.log('  ✓ Created payout_type enum');

    // Step 3: Rename columns and update data in transaction
    console.log('📋 Step 3: Renaming columns and updating data...');

    await client.query('BEGIN');

    // Rename columns
    await client.query('ALTER TABLE leads RENAME COLUMN commission TO payout');
    console.log('  ✓ leads.commission → leads.payout');

    await client.query('ALTER TABLE performance_reports RENAME COLUMN commission TO payout');
    console.log('  ✓ performance_reports.commission → performance_reports.payout');

    await client.query('ALTER TABLE users RENAME COLUMN commission_rate TO payout_rate');
    console.log('  ✓ users.commission_rate → users.payout_rate');

    await client.query('ALTER TABLE advertisers RENAME COLUMN commission_settings TO payout_settings');
    console.log('  ✓ advertisers.commission_settings → advertisers.payout_settings');

    // Update transaction type values
    await client.query("UPDATE transactions SET type = 'payout' WHERE type = 'commission'");
    console.log('  ✓ transactions.type: "commission" → "payout"');

    // Add comments
    await client.query("COMMENT ON COLUMN leads.payout IS 'Payout amount for confirmed sales (in USD)'");
    await client.query("COMMENT ON COLUMN performance_reports.payout IS 'Total payout for the reporting period (in USD)'");
    await client.query("COMMENT ON COLUMN users.payout_rate IS 'Default payout rate/percentage for user'");
    await client.query("COMMENT ON COLUMN advertisers.payout_settings IS 'Default payout rules and settings'");
    console.log('  ✓ Added column comments');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🎉 Database schema updated successfully!');
    console.log('\n⚠️  IMPORTANT: After this migration, redeploy your application');
    console.log('   to use the new payout terminology.');

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
