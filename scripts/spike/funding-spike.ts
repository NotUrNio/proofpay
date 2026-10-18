import * as dotenv from "dotenv";
dotenv.config();

import { createOrder, captureOrder, getPayPalAccessToken, getPayPalBaseUrl, isPayPalMock } from "../../src/lib/paypal";
import crypto from "crypto";

async function main() {
  console.log("=== ProofPay Spike 4: Real PayPal Orders v2 Buyer Approval & Capture ===");

  if (isPayPalMock()) {
    console.error("\n[FAIL] PAYPAL_MOCK is set to true. Spike scripts must NEVER run in mock mode.");
    process.exit(1);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes("your_sandbox_") || clientSecret.includes("your_sandbox_")) {
    console.error("\n[FAIL] Missing real PayPal Sandbox credentials in .env.");
    process.exit(1);
  }

  const requestId = `funding_spike_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  console.log(`1. Generating PayPal Order with intent=CAPTURE (RequestId: ${requestId})...`);

  const order = await createOrder({
    amount: "5.00",
    currency: "USD",
    description: "ProofPay Milestone Escrow Funding Spike Test",
    jobId: "spike-funding-job-001",
    requestId,
  });

  const approveLink = order.links.find((l) => l.rel === "approve")?.href;
  if (!approveLink) {
    console.error("[FAIL] No approve link returned by PayPal Orders API:", order);
    process.exit(1);
  }

  console.log("\n================================================================================");
  console.log("👉 REAL PAYPAL SANDBOX BUYER APPROVAL REQUIRED");
  console.log("================================================================================");
  console.log(`Order ID:     ${order.id}`);
  console.log(`Amount:       $5.00 USD`);
  console.log(`Approval URL: \n${approveLink}\n`);
  console.log("EXACT STEPS TO APPROVE:");
  console.log("1. Cmd+Click or copy the Approval URL above into your browser.");
  console.log("2. Log in with your Sandbox Buyer/Personal account.");
  console.log("3. Click 'Complete Purchase' / 'Pay Now' on the PayPal sandbox page.");
  console.log("================================================================================\n");
  console.log("Waiting for buyer approval on PayPal Sandbox (polling status every 3s, timeout 10 mins)...");

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const startTime = Date.now();
  let approved = false;

  while (Date.now() - startTime < 600000) {
    await new Promise((r) => setTimeout(r, 3000));
    const checkRes = await fetch(`${baseUrl}/v2/checkout/orders/${order.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (checkRes.ok) {
      const checkData = (await checkRes.json()) as { status: string };
      if (checkData.status === "APPROVED") {
        console.log("\n✅ Order APPROVED by Sandbox Buyer!");
        approved = true;
        break;
      } else {
        process.stdout.write(`\rCurrent Order Status: [${checkData.status}] ... waiting`);
      }
    }
  }

  if (!approved) {
    console.error("\n\n[FAIL] Timed out waiting for buyer approval after 3 minutes.");
    process.exit(1);
  }

  console.log("\n2. Executing captureOrder against approved PayPal order...");
  const captureRequestId = `capture_${order.id}_${Date.now()}`;
  const captureResult = await captureOrder(order.id, captureRequestId);

  const captureId = captureResult.purchase_units[0]?.payments?.captures[0]?.id;
  const captureStatus = captureResult.purchase_units[0]?.payments?.captures[0]?.status;

  console.log("\n--- Real PayPal Orders v2 Capture Result ---");
  console.log(`Order ID:       ${order.id}`);
  console.log(`Capture ID:     ${captureId}`);
  console.log(`Capture Status: ${captureStatus}`);
  console.log(`Buyer Email:    ${captureResult.payer?.email_address || "N/A"}`);
  console.log(`Payer ID:       ${captureResult.payer?.payer_id || "N/A"}`);

  if (captureStatus === "COMPLETED" || captureStatus === "PENDING") {
    console.log(`\n[PASS] PayPal Orders v2 Buyer Approval & Capture Verified Successfully! (Status: ${captureStatus})`);
  } else {
    console.error("\n[FAIL] Capture failed or unexpected status:", captureResult);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n[FAIL] Funding spike error:", err);
  process.exit(1);
});
