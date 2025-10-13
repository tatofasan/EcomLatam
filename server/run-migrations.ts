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
    // Note: Previously applied migrations have been removed since they only needed to run once
    const migrations: Array<{ file: string; description: string }> = [];

    if (migrations.length === 0) {
      console.log('[migrations] No pending migrations to run');
    } else {
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
    }
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
