import * as dotenv from "dotenv";
dotenv.config();

import { createPayout, isPayPalMock } from "../../src/lib/paypal";
import crypto from "crypto";

async function main() {
  console.log("=== ProofPay Spike 2: Sandbox Business -> Sandbox Personal Payout ===");

  if (isPayPalMock()) {
    console.error("\n[FAIL] PAYPAL_MOCK is set to true. Spike scripts must NEVER run in mock mode.");
    console.error("Set PAYPAL_MOCK=false and provide real PayPal Sandbox credentials in .env.");
    process.exit(1);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const recipientEmail =
    process.env.PAYPAL_SANDBOX_PERSONAL_EMAIL ||
    process.argv[2] ||
    "freelancer@example.test"; // User can pass as argument or env

  if (!clientId || !clientSecret || clientId.includes("your_sandbox_") || clientSecret.includes("your_sandbox_")) {
    console.error("\n[FAIL] Missing real PayPal Sandbox credentials.");
    console.error("Add valid credentials to .env:");
    console.error("  PAYPAL_CLIENT_ID=<Your Sandbox Client ID>");
    console.error("  PAYPAL_CLIENT_SECRET=<Your Sandbox Secret>");
    console.error("  PAYPAL_SANDBOX_PERSONAL_EMAIL=<A sandbox personal/buyer account email>");
    console.error("\nYou can find sandbox test accounts under:");
    console.error("  https://developer.paypal.com/dashboard/accounts");
    process.exit(1);
  }

  const senderBatchId = `spike_batch_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const senderItemId = `spike_item_${Date.now()}`;

  console.log(`1. Target Sandbox Personal Recipient: ${recipientEmail}`);
  console.log(`2. Payout Amount: $0.01 USD`);
  console.log(`3. Generated Sender Batch ID (Idempotency Key): ${senderBatchId}`);

  try {
    console.log("4. Executing PayPal Payouts REST call (/v1/payments/payouts)...");
    const result = await createPayout({
      recipientEmail,
      amount: "0.01",
      currency: "USD",
      note: "ProofPay Payout Spike Verification Test",
      senderBatchId,
      senderItemId,
      emailSubject: "ProofPay Hackathon Spike Test Payout",
    });

    console.log("\n--- Real PayPal Sandbox Response ---");
    console.log(`Payout Batch ID: ${result.batch_header.payout_batch_id}`);
    console.log(`Batch Status:    ${result.batch_header.batch_status}`);
    console.log(`Sender Batch ID: ${result.batch_header.sender_batch_header?.sender_batch_id || senderBatchId}`);
    if (result.batch_header.time_created) {
      console.log(`Time Created:    ${result.batch_header.time_created}`);
    }
    const amt = result.batch_header.amount?.value || "0.01";
    const curr = result.batch_header.amount?.currency || "USD";
    console.log(`Amount:          $${amt} ${curr}`);

    console.log("\n[PASS] Real PayPal Sandbox Payout successfully initiated!");
    console.log(`Reference Batch ID: ${result.batch_header.payout_batch_id}`);
  } catch (err) {
    console.error("\n[FAIL] PayPal Payout Spike failed:", err);
    process.exit(1);
  }
}

main();
