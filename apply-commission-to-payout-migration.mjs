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

    // Read the SQL migration file
    const migrationSQL = fs.readFileSync(
      join(__dirname, 'migrations', 'commission-to-payout.sql'),
      'utf-8'
    );

    console.log('📄 Executing migration SQL...');

    // Start transaction
    await client.query('BEGIN');

    // Execute the migration
    await client.query(migrationSQL);

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  ✓ leads.commission → leads.payout');
    console.log('  ✓ performance_reports.commission → performance_reports.payout');
    console.log('  ✓ users.commission_rate → users.payout_rate');
    console.log('  ✓ advertisers.commission_settings → advertisers.payout_settings');
    console.log('  ✓ transactions.type: "commission" → "payout"');
    console.log('  ✓ Created payout_type enum');

    console.log('\n🎉 Database schema updated successfully!');
    console.log('\n⚠️  IMPORTANT: After this migration, redeploy your application');
    console.log('   to use the new payout terminology.');

  } catch (error) {
    await client.query('ROLLBACK');
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
