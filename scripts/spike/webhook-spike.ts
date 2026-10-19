import * as dotenv from "dotenv";
dotenv.config();

import http from "http";
import { spawn } from "child_process";
import { verifyWebhookSignature, isPayPalMock, createPayout, getPayPalAccessToken, getPayPalBaseUrl, resolveConfiguredSandboxPayeeEmail } from "../../src/lib/paypal";


const PORT = 3000;

async function main() {
  console.log("=== ProofPay Spike 3: Real PayPal Sandbox Webhook Receiver & Verification ===");

  if (isPayPalMock()) {
    console.error("\n[FAIL] PAYPAL_MOCK is set to true. Spike scripts must NEVER run in mock mode.");
    console.error("Set PAYPAL_MOCK=false and provide real PayPal Sandbox credentials in .env.");
    process.exit(1);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes("your_sandbox_") || clientSecret.includes("your_sandbox_")) {
    console.error("\n[FAIL] Missing real PayPal Sandbox credentials in .env.");
    process.exit(1);
  }

  let webhookId = process.env.PAYPAL_WEBHOOK_ID;
  let tunnelProcess: ReturnType<typeof spawn> | null = null;
  let tunnelUrl: string | null = null;
  let temporaryWebhookCreated = false;

  console.log(`1. Starting local HTTP webhook receiver on port ${PORT}...`);

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
        console.log("   - [HTTP] Incoming PayPal webhook delivery received!");
        requestResolver({ rawBody, headers: req.headers });
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`   - HTTP listener active on http://localhost:${PORT}/api/webhooks/paypal`);

  // 2. Set up Cloudflared Tunnel & Webhook Registration if not configured
  if (!webhookId || webhookId.includes("your_sandbox_")) {
    console.log("\n2. Launching Cloudflared tunnel for public HTTPS endpoint...");
    tunnelUrl = await new Promise<string>((resolve, reject) => {
      const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`]);
      tunnelProcess = proc;

      const timeout = setTimeout(() => {
        reject(new Error("Cloudflared tunnel startup timed out after 20 seconds."));
      }, 20000);

      proc.stderr.on("data", (data: Buffer) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log(`   - Cloudflared tunnel established at: ${tunnelUrl}`);
    const webhookEndpoint = `${tunnelUrl}/api/webhooks/paypal`;
    console.log(`   - Webhook Target URL: ${webhookEndpoint}`);

    // Register Webhook via PayPal REST API
    console.log("\n3. Registering webhook endpoint with PayPal Sandbox...");
    const token = await getPayPalAccessToken();
    const registerRes = await fetch(`${getPayPalBaseUrl()}/v1/notifications/webhooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookEndpoint,
        event_types: [{ name: "*" }],
      }),
    });

    if (!registerRes.ok) {
      const errText = await registerRes.text();
      throw new Error(`Failed to register webhook with PayPal: ${registerRes.status} ${errText}`);
    }

    const webhookData = (await registerRes.json()) as { id: string };
    webhookId = webhookData.id;
    temporaryWebhookCreated = true;
    console.log(`   - Successfully registered with PayPal! Webhook ID: ${webhookId}`);
  } else {
    console.log(`\n2. Using configured Webhook ID from .env: ${webhookId}`);
  }

  // 3. Trigger Real Payout to produce a live PayPal Webhook
  console.log("\n4. Triggering real $0.01 payout to produce live webhook delivery from PayPal...");
  const recipientEmail = resolveConfiguredSandboxPayeeEmail();

  const senderBatchId = `spike_webhook_batch_${Date.now()}`;

  try {
    const payoutResult = await createPayout({
      recipientEmail,
      amount: "0.01",
      currency: "USD",
      note: "ProofPay Real Webhook Delivery Spike Trigger",
      senderBatchId,
      senderItemId: `webhook_item_${Date.now()}`,
      emailSubject: "ProofPay Webhook Test Delivery",
    });

    console.log(`   - Payout created! Payout Batch ID: ${payoutResult.batch_header.payout_batch_id}`);
    console.log("   - Awaiting delivery from PayPal Sandbox servers (timeout: 90s)...");

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out after 90s waiting for PayPal Sandbox delivery.")), 90000)
    );

    const { rawBody, headers } = await Promise.race([receivedPromise, timeout]);

    console.log("\n5. Real PayPal Sandbox Webhook HTTP POST received!");
    console.log(`   - Transmission ID:   ${headers["paypal-transmission-id"]}`);
    console.log(`   - Transmission Time: ${headers["paypal-transmission-time"]}`);
    console.log(`   - Cert URL:          ${headers["paypal-cert-url"]}`);
    console.log(`   - Auth Algo:         ${headers["paypal-auth-algo"]}`);

    const parsedEvent = JSON.parse(rawBody);
    console.log(`   - Event Type:        ${parsedEvent.event_type}`);
    console.log(`   - Event ID:          ${parsedEvent.id}`);

    // 6. Cryptographic signature verification using raw, unparsed request body
    console.log("\n6. Verifying cryptographic signature with PayPal Sandbox API using raw body...");
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
      console.log(`Webhook ID:             ${webhookId}`);
    } else {
      console.error("\n[FAIL] PayPal reported verification_status !== SUCCESS for real webhook payload.");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n[FAIL] Webhook Spike Error:", err);
    process.exit(1);
  } finally {
    if (temporaryWebhookCreated && webhookId) {
      try {
        const token = await getPayPalAccessToken();
        await fetch(`${getPayPalBaseUrl()}/v1/notifications/webhooks/${webhookId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`\n(Cleaned up temporary sandbox webhook ID ${webhookId})`);
      } catch {
        // Ignore cleanup error
      }
    }
    server.close();
    if (tunnelProcess) {
      (tunnelProcess as any).kill();
    }
  }
}

main();
