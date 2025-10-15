/**
 * UTF-8 Encoding Test Script
 *
 * This script tests that character encoding is working correctly
 * by creating a test lead with special characters.
 *
 * Run with: node test-utf8-encoding.mjs
 */

import { config } from "dotenv";
config();

const API_KEY = process.env.TEST_API_KEY || "your-api-key-here";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// Test data with Spanish special characters
const testLead = {
  customerName: "José María Rodríguez Fernández",
  customerEmail: "jose.rodriguez@example.com",
  customerPhone: "+54 11 2345-6789",
  customerAddress: "Calle Ñandú 123, Piso 4°",
  customerCity: "Córdoba",
  customerPostalCode: "5000",
  productSku: "TEST-UTF8",
  quantity: 1
};

console.log("🧪 Testing UTF-8 encoding...\n");
console.log("Test data:", JSON.stringify(testLead, null, 2));

async function testEncoding() {
  try {
    console.log(`\n📤 Sending POST request to: ${BASE_URL}/api/external/orders`);

    const response = await fetch(`${BASE_URL}/api/external/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify(testLead)
    });

    const data = await response.json();

    console.log("\n📥 Response status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log("\n✅ SUCCESS: Lead created successfully!");
      console.log("Lead ID:", data.lead?.id);
      console.log("Lead Number:", data.lead?.leadNumber);

      // Verify the name was stored correctly
      const storedName = data.lead?.customerName;
      if (storedName === testLead.customerName) {
        console.log("\n✅ UTF-8 ENCODING TEST PASSED!");
        console.log("Stored name matches expected:", storedName);
      } else {
        console.log("\n❌ UTF-8 ENCODING TEST FAILED!");
        console.log("Expected:", testLead.customerName);
        console.log("Got:", storedName);
      }
    } else {
      console.log("\n❌ FAILED: Could not create lead");
      console.log("Error:", data.error || data.message);
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
  }
}

testEncoding();
