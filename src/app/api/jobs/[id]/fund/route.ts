import { NextRequest, NextResponse } from "next/server";
import { db, jobs, payments } from "@/db";
import { appendLedgerEvent } from "@/db/ledger";
import { createOrder, captureOrder, isPayPalMock } from "@/lib/paypal";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = assertAuthorizedRole(req, ["client", "reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action = "auto", orderId } = body;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const isMock = isPayPalMock();
    const requestId = `fund_${id}_${Date.now()}`;

    // 1. Capture an existing order approved by the sandbox buyer
    if (action === "capture" && orderId) {
      const captureResult = await captureOrder(orderId, requestId);
      const captureId = captureResult.purchase_units[0]?.payments?.captures[0]?.id || `cap_${orderId}`;

      await db.update(jobs).set({ status: "FUNDED", updatedAt: new Date() }).where(eq(jobs.id, id));

      await db.insert(payments).values({
        jobId: id,
        type: "FUNDING",
        paypalId: captureId,
        amount: job.amount,
        currency: job.currency,
        status: "COMPLETED",
        isMock,
        rawResponse: captureResult,
      });

      await appendLedgerEvent({
        jobId: id,
        eventType: "JOB_FUNDED",
        previousState: job.status,
        newState: "FUNDED",
        actor: "CLIENT",
        isMock,
        payload: {
          orderId,
          captureId,
          amount: job.amount,
          currency: job.currency,
          status: "COMPLETED",
          buyerEmail: captureResult.payer?.email_address || "sandbox-buyer@paypal.com",
        },
      });

      return NextResponse.json({
        success: true,
        status: "FUNDED",
        captureId,
      });
    }

    // 2. Simulated funding is ONLY allowed when PAYPAL_MOCK=true is explicitly configured
    if (action === "mock_fund") {
      if (!isMock) {
        return NextResponse.json(
          {
            error:
              "Simulated funding is strictly forbidden when PAYPAL_MOCK is not true. In normal mode, funding requires real sandbox buyer approval.",
          },
          { status: 400 }
        );
      }

      const mockOrderId = `MOCK_ORDER_${crypto.randomUUID().slice(0, 8)}`;
      const mockCaptureId = `MOCK_CAPTURE_${crypto.randomUUID().slice(0, 8)}`;

      await db.update(jobs).set({ status: "FUNDED", updatedAt: new Date() }).where(eq(jobs.id, id));

      await db.insert(payments).values({
        jobId: id,
        type: "FUNDING",
        paypalId: mockCaptureId,
        amount: job.amount,
        currency: job.currency,
        status: "COMPLETED",
        isMock: true,
        rawResponse: { orderId: mockOrderId, captureId: mockCaptureId },
      });

      await appendLedgerEvent({
        jobId: id,
        eventType: "JOB_FUNDED",
        previousState: job.status,
        newState: "FUNDED",
        actor: "CLIENT",
        isMock: true,
        payload: {
          mockOrderId,
          mockCaptureId,
          amount: job.amount,
          currency: job.currency,
          mode: "MOCK_MODE",
        },
      });

      return NextResponse.json({
        success: true,
        status: "FUNDED",
        orderId: mockOrderId,
        captureId: mockCaptureId,
      });
    }

    // 3. Real PayPal Sandbox Orders v2 Creation
    const order = await createOrder({
      jobId: id,
      amount: job.amount,
      currency: job.currency,
      description: `Funding escrow for job: ${job.title}`,
      requestId,
    });

    const approveLink = order.links.find((l) => l.rel === "approve")?.href;

    return NextResponse.json({
      success: true,
      orderId: order.id,
      approveUrl: approveLink,
    });
  } catch (err) {
    console.error("[API] Failed to fund job:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
