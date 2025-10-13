/**
 * Test script for duplicate lead validation
 *
 * This script tests the duplicate lead detection functionality
 * by checking if a lead with the same formatted phone number
 * already exists today.
 */

import { checkDuplicateLeadToday } from './server/leadDuplicateValidation.ts';
import 'dotenv/config';

console.log('🧪 Testing Duplicate Lead Validation\n');
console.log('='.repeat(70));

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Check for non-existent phone (should return not duplicate)
  console.log('\n📱 Test 1: Non-existent phone number');
  console.log('   Phone: 1199999999');

  try {
    const result = await checkDuplicateLeadToday('1199999999');

    if (!result.isDuplicate) {
      console.log('   ✅ PASSED - No duplicate found (as expected)');
      passed++;
    } else {
      console.log('   ❌ FAILED - Unexpected duplicate found');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }

  console.log('-'.repeat(70));

  // Test 2: Check with null/undefined phone
  console.log('\n📱 Test 2: Null phone number');
  console.log('   Phone: null');

  try {
    const result = await checkDuplicateLeadToday(null);

    if (!result.isDuplicate) {
      console.log('   ✅ PASSED - No duplicate found for null phone');
      passed++;
    } else {
      console.log('   ❌ FAILED - Unexpected duplicate for null phone');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }

  console.log('-'.repeat(70));

  // Test 3: Check with empty string
  console.log('\n📱 Test 3: Empty string phone number');
  console.log('   Phone: ""');

  try {
    const result = await checkDuplicateLeadToday('');

    if (!result.isDuplicate) {
      console.log('   ✅ PASSED - No duplicate found for empty string');
      passed++;
    } else {
      console.log('   ❌ FAILED - Unexpected duplicate for empty string');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }

  console.log('-'.repeat(70));

  // Test 4: Check with actual formatted phone (if any exist in DB)
  console.log('\n📱 Test 4: Check existing lead (if any)');
  console.log('   Query: First lead with formatted phone from today');

  try {
    // Import db and leads to query
    const { db } = await import('./server/db.ts');
    const { leads } = await import('./shared/schema.ts');
    const { desc, and, gte, lt } = await import('drizzle-orm');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [firstLead] = await db
      .select({
        phone: leads.customerPhoneFormatted,
        leadNumber: leads.leadNumber
      })
      .from(leads)
      .where(
        and(
          gte(leads.createdAt, startOfDay),
          lt(leads.createdAt, endOfDay)
        )
      )
      .orderBy(desc(leads.createdAt))
      .limit(1);

    if (firstLead && firstLead.phone) {
      console.log(`   Found lead: ${firstLead.leadNumber} with phone: ${firstLead.phone}`);

      const result = await checkDuplicateLeadToday(firstLead.phone, firstLead.leadNumber);

      if (!result.isDuplicate) {
        console.log('   ✅ PASSED - No duplicate found (excluded current lead)');
        passed++;
      } else {
        console.log('   ❌ FAILED - Should not find itself as duplicate');
        failed++;
      }
    } else {
      console.log('   ⚠️  SKIPPED - No leads found today to test with');
      console.log('   This is expected if database is empty or no leads created today');
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }

  console.log('-'.repeat(70));

  // Print summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${passed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : 0}%\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Duplicate validation is working correctly.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
