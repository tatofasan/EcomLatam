// In production (Railway, etc), environment variables are provided by the platform
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  const { config } = await import("dotenv");
  const { fileURLToPath } = await import("url");
  const { dirname, join } = await import("path");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, "..", ".env") });
}

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
// pg is a CommonJS module, import it differently for ESM compatibility
import pg from 'pg';
const { Pool: PgPool } = pg;
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use different driver based on database URL
// Neon databases use wss://, local PostgreSQL uses postgresql://
// Railway and most PostgreSQL instances use the standard pg driver
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') ||
                       process.env.DATABASE_URL.startsWith('wss://');

let pool: any;
let db: any;

if (isNeonDatabase) {
  // Use Neon serverless driver for Neon databases only
  console.log('[db] Using Neon serverless driver');
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({
    connectionString: process.env.DATABASE_URL,
    // Ensure UTF-8 encoding for proper character handling
    connectionTimeoutMillis: 5000
  });
  db = neonDrizzle({ client: pool, schema });
} else {
  // Use standard PostgreSQL driver for Railway, local, and most other PostgreSQL
  console.log('[db] Using standard PostgreSQL driver');
  // CHARSET FIX: Explicitly set client_encoding to UTF8 to prevent character corruption
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    // Force UTF-8 encoding at the database connection level
    options: '-c client_encoding=UTF8'
  });
  db = pgDrizzle({ client: pool, schema });
}

export { pool, db };