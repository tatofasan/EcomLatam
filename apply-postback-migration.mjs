/**
 * Apply Postback Tables Migration
 *
 * This script creates postback_configurations and postback_notifications tables
 * Safe to run in production - idempotent (can run multiple times)
 *
 * Usage:
 *   node apply-postback-migration.mjs
 *   or in Railway: railway run node apply-postback-migration.mjs
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
    console.log('🚀 Starting postback tables migration...\n');

    // Check if migration was already applied
    console.log('📋 Checking if migration was already applied...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'postback_configurations'
      ) as migration_applied;
    `);

    if (checkResult.rows[0].migration_applied) {
      console.log('✅ Migration already applied! Skipping...');
      console.log('   Postback tables already exist.');
      return;
    }

    console.log('📋 Migration not yet applied. Proceeding...\n');

    // Apply migration in transaction
    console.log('📋 Creating postback tables...');

    await client.query('BEGIN');

    // Create postback_configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS postback_configurations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        is_enabled BOOLEAN DEFAULT false,
        sale_url TEXT,
        hold_url TEXT,
        rejected_url TEXT,
        trash_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✓ Created postback_configurations table');

    // Create postback_notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS postback_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        http_status INTEGER,
        response_body TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✓ Created postback_notifications table');

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_postback_config_user
      ON postback_configurations(user_id)
    `);
    console.log('  ✓ Created index on postback_configurations.user_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_postback_notif_user
      ON postback_notifications(user_id)
    `);
    console.log('  ✓ Created index on postback_notifications.user_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_postback_notif_lead
      ON postback_notifications(lead_id)
    `);
    console.log('  ✓ Created index on postback_notifications.lead_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_postback_notif_created
      ON postback_notifications(created_at DESC)
    `);
    console.log('  ✓ Created index on postback_notifications.created_at');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_postback_notif_status
      ON postback_notifications(status)
    `);
    console.log('  ✓ Created index on postback_notifications.status');

    // Add comments for documentation
    await client.query(`
      COMMENT ON TABLE postback_configurations IS
      'User-specific postback URL configurations for lead status notifications'
    `);

    await client.query(`
      COMMENT ON TABLE postback_notifications IS
      'Log of all postback HTTP requests sent to external systems'
    `);
    console.log('  ✓ Added table comments');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🎉 Postback tables created successfully!');
    console.log('\n📊 Created:');
    console.log('   - postback_configurations (user postback URL settings)');
    console.log('   - postback_notifications (notification history log)');
    console.log('   - 5 indexes for optimized queries');

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
