import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configurar para usar WebSockets en entorno serverless
neonConfig.webSocketConstructor = ws;

async function main() {
  console.log('Creating database connection...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('Running migration to add email verification columns to users table...');
  try {
    // Alterando la tabla users para agregar las columnas necesarias para verificación de email
    await pool.query(`
      ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS verification_token TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;
    `);
    console.log('Migration for email verification completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);