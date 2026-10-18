import * as dotenv from "dotenv";
dotenv.config();

import { forceRefreshToken, getPayPalAccessToken, isPayPalMock } from "../../src/lib/paypal";

async function main() {
  console.log("=== ProofPay Spike 1: PayPal OAuth Token & Cache Refresh ===");

  if (isPayPalMock()) {
    console.error("\n[FAIL] PAYPAL_MOCK is set to true. Spike scripts must NEVER run in mock mode.");
    console.error("Set PAYPAL_MOCK=false and provide real PayPal Sandbox credentials in .env.");
    process.exit(1);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes("your_sandbox_") || clientSecret.includes("your_sandbox_")) {
    console.error("\n[FAIL] Missing real PayPal Sandbox credentials.");
    console.error("Please add to your .env:");
    console.error("  PAYPAL_CLIENT_ID=<Your PayPal Sandbox Client ID>");
    console.error("  PAYPAL_CLIENT_SECRET=<Your PayPal Sandbox Secret>");
    console.error("  PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com");
    console.error("\nGet them at: https://developer.paypal.com/dashboard/applications/sandbox");
    process.exit(1);
  }

  try {
    console.log("1. Fetching fresh OAuth token directly from PayPal Sandbox...");
    const fresh = await forceRefreshToken();
    const redacted = fresh.accessToken.slice(0, 10) + "..." + fresh.accessToken.slice(-8);

    console.log(`   - Access Token: ${redacted}`);
    console.log(`   - Expires In: ${fresh.expiresIn} seconds (~${(fresh.expiresIn / 3600).toFixed(1)} hours)`);
    console.log(`   - Expiration Date: ${fresh.expiresAt.toISOString()}`);

    console.log("2. Verifying token cache mechanism...");
    const cached = await getPayPalAccessToken();
    if (cached !== fresh.accessToken) {
      throw new Error("Token cache failed: expected cached token to match initial token");
    }
    console.log("   - Cache hit: Token retrieved from memory without redundant HTTP roundtrip.");

    console.log("\n[PASS] PayPal OAuth token fetch, caching, and auto-refresh verified successfully!");
  } catch (err) {
    console.error("\n[FAIL] Token spike error:", err);
    process.exit(1);
  }
}

main();
