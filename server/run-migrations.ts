import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  console.log('[migrations] Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Only run the incremental migration that adds missing columns
    // Skip 0000_first_firebird.sql as it assumes empty DB (causes "type already exists" errors)
    const migrationFile = path.join(__dirname, '../migrations/0001_add_missing_columns.sql');

    if (!fs.existsSync(migrationFile)) {
      console.log('[migrations] No incremental migration found, skipping...');
      return;
    }

    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

    console.log('[migrations] Running incremental migration (0001_add_missing_columns.sql)...');
    await pool.query(migrationSQL);
    console.log('[migrations] ✓ Migration completed successfully');
    console.log('[migrations] Added: publisher_id, subacc1-4, customer_postal_code columns + terms_and_conditions table');
  } catch (error) {
    console.error('[migrations] ✗ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('[migrations] Fatal error:', err);
  process.exit(1);
});
