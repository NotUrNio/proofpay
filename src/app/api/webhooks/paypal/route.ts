import { NextRequest, NextResponse } from "next/server";
import { db, payments, jobs } from "@/db";
import { appendLedgerEvent } from "@/db/ledger";
import { verifyWebhookSignature, isPayPalMock } from "@/lib/paypal";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    // 1. Read unparsed raw body string directly from the HTTP stream
    const rawBody = await req.text();

    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || "MOCK_WEBHOOK_ID";

    const isMock = isPayPalMock();

    // 2. Cryptographic signature verification with PayPal Sandbox
    const isValid = await verifyWebhookSignature({
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
      webhookId,
      rawBody,
    });

    if (!isValid && !isMock) {
      console.warn("[Webhook] Rejected invalid PayPal webhook signature:", {
        transmissionId,
        authAlgo,
      });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    // 3. Parse JSON event after signature check
    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const resource = event.resource || {};

    console.log(`[Webhook] Received PayPal Event: ${eventType} (ID: ${event.id})`);

    // 4. Handle Payout Item Events
    if (eventType.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
      const payoutItemId = resource.payout_item_id;
      const transactionStatus = resource.transaction_status || "COMPLETED";

      // Match payment row by paypalId or sender_item_id
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paypalId, payoutItemId))
        .limit(1);

      if (payment) {
        await db
          .update(payments)
          .set({ status: transactionStatus })
          .where(eq(payments.id, payment.id));

        // Append to immutable ledger
        await appendLedgerEvent({
          jobId: payment.jobId,
          eventType: "PAYOUT_CONFIRMED",
          previousState: payment.status,
          newState: transactionStatus,
          actor: "PAYPAL_WEBHOOK",
          isMock,
          payload: {
            eventId: event.id,
            eventType,
            payoutItemId,
            transactionId: resource.transaction_id,
            transactionStatus,
          },
        });
      }
    }

    // 5. Handle Capture Events
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const captureId = resource.id;
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paypalId, captureId))
        .limit(1);

      if (payment) {
        await db
          .update(payments)
          .set({ status: "COMPLETED" })
          .where(eq(payments.id, payment.id));

        await appendLedgerEvent({
          jobId: payment.jobId,
          eventType: "CAPTURE_CONFIRMED",
          previousState: payment.status,
          newState: "COMPLETED",
          actor: "PAYPAL_WEBHOOK",
          isMock,
          payload: {
            eventId: event.id,
            captureId,
            status: "COMPLETED",
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Error processing PayPal webhook:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
