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
    // List of migrations to run in order
    const migrations = [
      {
        file: '0001_add_missing_columns.sql',
        description: 'publisher_id, subacc1-4, customer_postal_code columns + terms_and_conditions table'
      },
      {
        file: '0009_add_phone_fields.sql',
        description: 'customer_phone_original and customer_phone_formatted columns'
      }
    ];

    for (const migration of migrations) {
      const migrationFile = path.join(__dirname, '../migrations', migration.file);

      if (!fs.existsSync(migrationFile)) {
        console.log(`[migrations] ${migration.file} not found, skipping...`);
        continue;
      }

      const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

      console.log(`[migrations] Running ${migration.file}...`);
      await pool.query(migrationSQL);
      console.log(`[migrations] ✓ ${migration.file} completed successfully`);
      console.log(`[migrations]   Added: ${migration.description}`);
    }

    console.log('[migrations] ✓ All migrations completed successfully');
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
