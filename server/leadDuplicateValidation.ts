/**
 * Lead Duplicate Validation Module
 *
 * Detects duplicate leads based on formatted phone number within the same day.
 * This ensures we don't accept multiple orders from the same phone number
 * on the same day, even if they come from different affiliates or sources.
 *
 * IMPORTANT: Only validates against leads in 'hold' or 'sale' status.
 * Leads in 'rejected' or 'trash' are ignored as they likely had errors
 * that a new lead may correct.
 */

import { db } from './db';
import { leads } from '../shared/schema';
import { and, eq, gte, lt, sql, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '../logs_scripts');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Logs duplicate detection events to file
 */
function logDuplicateCheck(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  const logFile = path.join(LOG_DIR, 'duplicate_detection.log');
  fs.appendFileSync(logFile, logMessage);
}

/**
 * Checks if a lead with the same formatted phone number already exists today
 *
 * SECURITY FIX: Enhanced to check both formattedPhone and originalPhone
 * to prevent bypassing duplicate detection with different phone formats
 *
 * IMPORTANT: Only checks against leads in 'hold' or 'sale' status.
 * Leads in 'rejected' or 'trash' status are intentionally ignored to allow
 * corrected versions of previously failed leads.
 *
 * @param formattedPhone - The formatted phone number to check
 * @param originalPhone - The original phone number to check (SECURITY FIX: added)
 * @param currentLeadNumber - Optional: exclude this lead number from the search (for updates)
 * @returns Object with isDuplicate flag and duplicate lead info if found
 */
export async function checkDuplicateLeadToday(
  formattedPhone: string | null | undefined,
  originalPhone?: string | null | undefined,
  currentLeadNumber?: string
): Promise<{
  isDuplicate: boolean;
  duplicateLead?: {
    leadNumber: string;
    customerName: string;
    createdAt: Date;
    userId: number | null;
  };
}> {
  // If no phone provided, can't check for duplicates
  if ((!formattedPhone || formattedPhone.trim() === '') &&
      (!originalPhone || originalPhone.trim() === '')) {
    logDuplicateCheck(`No phone number provided, skipping duplicate check`);
    return { isDuplicate: false };
  }

  try {
    // Get start and end of today (in UTC or server timezone)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    logDuplicateCheck(
      `Checking for duplicates (only 'hold' or 'sale' status) - Formatted: ${formattedPhone || 'N/A'}, ` +
      `Original: ${originalPhone || 'N/A'} on ${startOfDay.toISOString().split('T')[0]}`
    );

    // Build query conditions - check BOTH formatted and original phone
    // SECURITY FIX: This prevents bypassing duplicate detection by sending
    // the same phone number in different formats
    const phoneConditions = [];

    if (formattedPhone && formattedPhone.trim() !== '') {
      phoneConditions.push(eq(leads.customerPhoneFormatted, formattedPhone));
    }

    if (originalPhone && originalPhone.trim() !== '') {
      phoneConditions.push(eq(leads.customerPhoneOriginal, originalPhone));
      // Also check if originalPhone matches any formattedPhone
      phoneConditions.push(eq(leads.customerPhoneFormatted, originalPhone));
    }

    if (phoneConditions.length === 0) {
      return { isDuplicate: false };
    }

    const conditions = [
      sql`(${sql.join(phoneConditions, sql` OR `)})`,
      gte(leads.createdAt, startOfDay),
      lt(leads.createdAt, endOfDay),
      // Only check duplicates against leads in 'hold' or 'sale' status
      // Leads in 'rejected' or 'trash' are ignored as they may have errors that the new lead corrects
      inArray(leads.status, ['hold', 'sale'])
    ];

    // Exclude current lead if updating
    if (currentLeadNumber) {
      conditions.push(sql`${leads.leadNumber} != ${currentLeadNumber}`);
    }

    // Search for existing lead with same phone today (only in 'hold' or 'sale' status)
    const existingLeads = await db
      .select({
        leadNumber: leads.leadNumber,
        customerName: leads.customerName,
        createdAt: leads.createdAt,
        userId: leads.userId,
        status: leads.status,
        customerPhoneFormatted: leads.customerPhoneFormatted,
        customerPhoneOriginal: leads.customerPhoneOriginal
      })
      .from(leads)
      .where(and(...conditions))
      .limit(1);

    if (existingLeads.length > 0) {
      const duplicate = existingLeads[0];
      logDuplicateCheck(
        `DUPLICATE FOUND! ` +
        `Searched - Formatted: ${formattedPhone || 'N/A'}, Original: ${originalPhone || 'N/A'} | ` +
        `Found - Formatted: ${duplicate.customerPhoneFormatted}, Original: ${duplicate.customerPhoneOriginal} | ` +
        `Original Lead: ${duplicate.leadNumber} | ` +
        `Customer: ${duplicate.customerName} | ` +
        `Created: ${duplicate.createdAt.toISOString()} | ` +
        `Status: ${duplicate.status}`
      );

      return {
        isDuplicate: true,
        duplicateLead: {
          leadNumber: duplicate.leadNumber,
          customerName: duplicate.customerName,
          createdAt: duplicate.createdAt,
          userId: duplicate.userId
        }
      };
    }

    logDuplicateCheck(`No duplicate found in 'hold'/'sale' leads for phones - Formatted: ${formattedPhone || 'N/A'}, Original: ${originalPhone || 'N/A'}`);
    return { isDuplicate: false };

  } catch (error) {
    console.error('Error checking for duplicate leads:', error);
    logDuplicateCheck(`ERROR checking duplicates: ${error instanceof Error ? error.message : String(error)}`);

    // In case of error, don't block lead creation - return false
    return { isDuplicate: false };
  }
}

/**
 * Gets statistics about duplicate leads detected today
 */
export async function getDuplicateStatsToday(): Promise<{
  totalDuplicatesTrash: number;
  uniquePhones: number;
}> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Count leads marked as trash due to duplicates today
    const trashLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.status, 'trash'),
          gte(leads.createdAt, startOfDay),
          sql`${leads.notes} LIKE '%duplicado%'`
        )
      );

    // Count unique phones in all leads today
    const uniquePhones = await db
      .select({ count: sql<number>`count(distinct ${leads.customerPhoneFormatted})` })
      .from(leads)
      .where(gte(leads.createdAt, startOfDay));

    return {
      totalDuplicatesTrash: Number(trashLeads[0]?.count || 0),
      uniquePhones: Number(uniquePhones[0]?.count || 0)
    };
  } catch (error) {
    console.error('Error getting duplicate stats:', error);
    return {
      totalDuplicatesTrash: 0,
      uniquePhones: 0
    };
  }
}
