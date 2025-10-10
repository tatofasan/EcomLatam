import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_publisher_and_subacc_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    console.log('SQL:', migrationSQL);

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration applied successfully!');

    // Verify the changes
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'leads'
      AND column_name IN ('publisher_id', 'subacc1', 'subacc2', 'subacc3', 'subacc4', 'traffic_source', 'utm_source', 'utm_medium', 'utm_campaign')
      ORDER BY column_name;
    `);

    console.log('\nCurrent columns:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
