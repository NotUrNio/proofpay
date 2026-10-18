import * as dotenv from "dotenv";
dotenv.config();

import http from "http";
import { spawn } from "child_process";
import { verifyWebhookSignature, isPayPalMock, createPayout } from "../../src/lib/paypal";

const PORT = 3000;

async function main() {
  console.log("=== ProofPay Spike: Real PayPal Sandbox Webhook Receiver & Verification ===");

  if (isPayPalMock()) {
    console.error("\n[FAIL] PAYPAL_MOCK is set to true. Spike scripts must NEVER run in mock mode.");
    console.error("Set PAYPAL_MOCK=false and provide real PayPal Sandbox credentials in .env.");
    process.exit(1);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!clientId || !clientSecret || clientId.includes("your_sandbox_") || clientSecret.includes("your_sandbox_")) {
    console.error("\n[FAIL] Missing real PayPal Sandbox credentials in .env.");
    console.error("Add valid credentials to .env:");
    console.error("  PAYPAL_CLIENT_ID=<Your Sandbox Client ID>");
    console.error("  PAYPAL_CLIENT_SECRET=<Your Sandbox Secret>");
    console.error("  PAYPAL_WEBHOOK_ID=<Your Sandbox Webhook ID>");
    process.exit(1);
  }

  if (!webhookId || webhookId.includes("your_sandbox_")) {
    console.error("\n[FAIL] Missing PAYPAL_WEBHOOK_ID in .env.");
    console.error("To receive and verify real PayPal deliveries:");
    console.error("1. Start a cloudflared tunnel: npx cloudflared tunnel --url http://localhost:3000");
    console.error("2. Register the webhook URL in PayPal Developer Sandbox Dashboard: https://<your-tunnel>.trycloudflare.com/api/webhooks/paypal");
    console.error("3. Subscribe to event: PAYMENT.PAYOUTS-ITEM.SUCCEEDED (or all events)");
    console.error("4. Copy the Webhook ID and put it in .env as PAYPAL_WEBHOOK_ID");
    process.exit(1);
  }

  console.log(`Using PayPal Webhook ID: ${webhookId}`);
  console.log(`1. Starting HTTP receiver on port ${PORT}...`);

  let requestResolver: (val: { rawBody: string; headers: http.IncomingHttpHeaders }) => void;
  const receivedPromise = new Promise<{ rawBody: string; headers: http.IncomingHttpHeaders }>((resolve) => {
    requestResolver = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && (req.url === "/api/webhooks/paypal" || req.url === "/")) {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));
        requestResolver({ rawBody, headers: req.headers });
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT, () => {
    console.log(`   - HTTP listener active on http://localhost:${PORT}/api/webhooks/paypal`);
  });

  console.log("\n2. Ready to receive real webhook delivery from PayPal Sandbox.");
  console.log("   Triggering a real $0.01 test payout to cause PayPal to deliver a live webhook event...");

  const recipientEmail = process.env.PAYPAL_SANDBOX_PERSONAL_EMAIL || "sb-buyer@business.example.com";
  const senderBatchId = `webhook_spike_batch_${Date.now()}`;

  try {
    const payoutResult = await createPayout({
      recipientEmail,
      amount: "0.01",
      currency: "USD",
      note: "ProofPay Real Webhook Spike Trigger",
      senderBatchId,
      senderItemId: `webhook_spike_item_${Date.now()}`,
      emailSubject: "ProofPay Webhook Test Delivery",
    });

    console.log(`   - Payout created! Batch ID: ${payoutResult.batch_header.payout_batch_id}`);
    console.log("   - Waiting for PayPal sandbox to deliver the real signed webhook event (timeout: 60s)...");

    // Wait for the incoming real webhook delivery
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out after 60s waiting for PayPal webhook delivery through tunnel.")), 60000)
    );

    const { rawBody, headers } = await Promise.race([receivedPromise, timeout]);

    console.log("\n3. Real PayPal HTTP Webhook Event received!");
    console.log(`   - Transmission ID:   ${headers["paypal-transmission-id"]}`);
    console.log(`   - Transmission Time: ${headers["paypal-transmission-time"]}`);
    console.log(`   - Cert URL:          ${headers["paypal-cert-url"]}`);
    console.log(`   - Auth Algo:         ${headers["paypal-auth-algo"]}`);

    const parsedEvent = JSON.parse(rawBody);
    console.log(`   - Event Type:        ${parsedEvent.event_type}`);
    console.log(`   - Event ID:          ${parsedEvent.id}`);

    console.log("\n4. Verifying real cryptographic signature with PayPal Sandbox API...");
    const isVerified = await verifyWebhookSignature({
      authAlgo: String(headers["paypal-auth-algo"]),
      certUrl: String(headers["paypal-cert-url"]),
      transmissionId: String(headers["paypal-transmission-id"]),
      transmissionSig: String(headers["paypal-transmission-sig"]),
      transmissionTime: String(headers["paypal-transmission-time"]),
      webhookId,
      rawBody,
    });

    if (isVerified) {
      console.log("\n[PASS] Real PayPal Sandbox Webhook Signature Verified Successfully!");
      console.log(`Verified Real Event ID: ${parsedEvent.id}`);
    } else {
      console.error("\n[FAIL] PayPal reported verification_status !== SUCCESS for real webhook payload.");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n[FAIL] Webhook Spike Error:", err);
    process.exit(1);
  } finally {
    server?.close();
  }
}

main();
