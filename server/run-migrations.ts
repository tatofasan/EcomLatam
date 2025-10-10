import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  console.log('[migrations] Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('[migrations] Running migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('[migrations] ✓ Migrations completed successfully');
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
