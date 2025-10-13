# Lead Status Migration Guide

## Overview

This document explains the migration from old order status values to new lead status values.

## Background

The application was originally designed with traditional e-commerce order statuses (`pending`, `processing`, `shipped`, `delivered`, `cancelled`), but the database schema was updated to use lead/CPA network statuses (`sale`, `hold`, `rejected`, `trash`). This created a mismatch that caused 500 errors when trying to update order statuses in the admin panel.

## Status Mapping

The migration converts old statuses to new statuses as follows:

| Old Status | New Status | Reasoning |
|------------|------------|-----------|
| `delivered` | `sale` | Completed/successful conversion |
| `pending` | `hold` | Awaiting validation |
| `processing` | `hold` | Being processed/validated |
| `shipped` | `hold` | In transit but not yet completed |
| `cancelled` | `trash` | Discarded/invalid lead |

## How to Run the Migration

### On Production (Railway)

1. Connect to your Railway project:
   ```bash
   railway link
   ```

2. Run the migration script:
   ```bash
   railway run npm run db:migrate-lead-status
   ```

### On Local Development

1. Ensure your `.env` file has the correct `DATABASE_URL`

2. Run the migration:
   ```bash
   npm run db:migrate-lead-status
   ```

## What the Migration Does

1. Scans the `leads` table for any records with old status values
2. Reports the count of each old status found
3. Updates each status to the new corresponding value
4. Provides a summary of migrated records

## After Migration

After running the migration:
- All leads will have valid status values: `sale`, `hold`, `rejected`, or `trash`
- The admin panel will be able to update order statuses without errors
- No data is lost - all leads are preserved with updated status values

## Changes Made in Code

### Backend (`server/routes.ts`)
- Updated status validation in `PATCH /api/orders/:id/status` endpoint
- Now accepts: `sale`, `hold`, `rejected`, `trash`
- Rejects old status values with clear error message

### Frontend (`client/src/pages/orders-page.tsx`)
- Updated `getStatusBadge()` function to display correct badges
- Updated status filter dropdown
- Updated status update select in order details dialog
- Changed "delivered" check to "sale" check

## Verification

After deployment, verify the fix by:

1. Login as admin to https://ecomlatam-production.up.railway.app/orders
2. Click "View" on any order
3. Try changing the status to "Sale"
4. Verify the status updates without error

## Support

If you encounter any issues after migration, check:
- Railway logs for any database errors
- Browser console for frontend errors
- Verify all leads have valid status values by querying the database:
  ```sql
  SELECT status, COUNT(*) as count
  FROM leads
  GROUP BY status;
  ```
