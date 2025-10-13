import { db } from "./db";
import { leads } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Migration script to update old order status values to new lead status values
 *
 * Old statuses -> New statuses:
 * - pending -> hold
 * - processing -> hold
 * - shipped -> hold
 * - delivered -> sale
 * - cancelled -> trash
 */

async function migrateLeadStatus() {
  console.log("Starting lead status migration...");

  try {
    // Check for leads with old status values
    const oldStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    for (const oldStatus of oldStatuses) {
      const count = await db.execute(
        sql`SELECT COUNT(*) as count FROM leads WHERE status = ${oldStatus}`
      );

      console.log(`Found ${count.rows[0]?.count || 0} leads with status '${oldStatus}'`);
    }

    // Migrate statuses
    console.log("\nMigrating statuses...");

    // delivered -> sale
    const deliveredResult = await db.execute(
      sql`UPDATE leads SET status = 'sale' WHERE status = 'delivered' RETURNING id`
    );
    console.log(`✓ Migrated ${deliveredResult.rowCount || 0} leads from 'delivered' to 'sale'`);

    // pending -> hold
    const pendingResult = await db.execute(
      sql`UPDATE leads SET status = 'hold' WHERE status = 'pending' RETURNING id`
    );
    console.log(`✓ Migrated ${pendingResult.rowCount || 0} leads from 'pending' to 'hold'`);

    // processing -> hold
    const processingResult = await db.execute(
      sql`UPDATE leads SET status = 'hold' WHERE status = 'processing' RETURNING id`
    );
    console.log(`✓ Migrated ${processingResult.rowCount || 0} leads from 'processing' to 'hold'`);

    // shipped -> hold
    const shippedResult = await db.execute(
      sql`UPDATE leads SET status = 'hold' WHERE status = 'shipped' RETURNING id`
    );
    console.log(`✓ Migrated ${shippedResult.rowCount || 0} leads from 'shipped' to 'hold'`);

    // cancelled -> trash
    const cancelledResult = await db.execute(
      sql`UPDATE leads SET status = 'trash' WHERE status = 'cancelled' RETURNING id`
    );
    console.log(`✓ Migrated ${cancelledResult.rowCount || 0} leads from 'cancelled' to 'trash'`);

    const totalMigrated =
      (deliveredResult.rowCount || 0) +
      (pendingResult.rowCount || 0) +
      (processingResult.rowCount || 0) +
      (shippedResult.rowCount || 0) +
      (cancelledResult.rowCount || 0);

    console.log(`\n✅ Migration complete! Total leads migrated: ${totalMigrated}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateLeadStatus();
