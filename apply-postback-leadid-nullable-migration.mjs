/**
 * Make lead_id nullable in postback_notifications
 *
 * This allows test postbacks to be saved without requiring a real lead ID
 * Safe to run in production - idempotent (can run multiple times)
 *
 * Usage:
 *   node apply-postback-leadid-nullable-migration.mjs
 *   or in Railway: railway run node apply-postback-leadid-nullable-migration.mjs
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
    console.log('🚀 Starting postback_notifications.lead_id nullable migration...\n');

    // Check if column is already nullable
    console.log('📋 Checking current column configuration...');
    const checkResult = await client.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'postback_notifications'
      AND column_name = 'lead_id';
    `);

    if (checkResult.rows.length === 0) {
      console.log('❌ Table postback_notifications or column lead_id not found!');
      console.log('   Please run apply-postback-migration.mjs first.');
      process.exit(1);
    }

    const isNullable = checkResult.rows[0].is_nullable === 'YES';

    if (isNullable) {
      console.log('✅ Migration already applied! lead_id is already nullable.');
      console.log('   No changes needed.');
      return;
    }

    console.log('📋 Migration not yet applied. Proceeding...\n');

    // Apply migration - make lead_id nullable
    console.log('📋 Making lead_id column nullable...');

    await client.query(`
      ALTER TABLE postback_notifications
      ALTER COLUMN lead_id DROP NOT NULL;
    `);

    console.log('  ✓ lead_id is now nullable');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🎉 postback_notifications.lead_id can now be NULL for test postbacks!');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nPlease check the error and try again.');
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
