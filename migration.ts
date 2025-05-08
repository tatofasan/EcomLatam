import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from "./shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

async function main() {
  console.log('Creating database connection...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  console.log('Running migration to add apiKey to users...');
  try {
    // Altering the users table to add the api_key column
    await pool.query(`
      ALTER TABLE IF EXISTS users 
      ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE DEFAULT NULL;
    `);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }

  await pool.end();
}

main().catch(console.error);