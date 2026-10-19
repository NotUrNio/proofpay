import { NextRequest, NextResponse } from "next/server";
import { db, jobs, payments } from "@/db";
import { appendLedgerEvent } from "@/db/ledger";
import { createOrder, captureOrder, isPayPalMock } from "@/lib/paypal";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { checkDemoRateLimits, getClientIp } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";
import crypto from "crypto";

import { isBundledDemoJob } from "@/lib/demo-templates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = assertAuthorizedRole(req, ["client", "reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  // Rate limiting to protect PayPal and system quota
  const clientIp = getClientIp(req);
  const rateLimit = checkDemoRateLimits(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: rateLimit.reason || "Rate limit exceeded. Please wait.",
        limits: {
          ipRemaining: rateLimit.ipLimit.remaining,
          globalDailyRemaining: rateLimit.globalDailyLimit.remaining,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-IP-Remaining": rateLimit.ipLimit.remaining.toString(),
          "X-RateLimit-Global-Remaining": rateLimit.globalDailyLimit.remaining.toString(),
        },
      }
    );
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

    // 2. Simulated funding: STRICTLY restricted to bundled demo templates only
    if (action === "mock_fund") {
      // Enforce: simulated funding can NEVER be applied to custom user-supplied amounts or payees
      if (!isBundledDemoJob(job.title, job.freelancerEmail)) {
        return NextResponse.json(
          {
            error:
              "Simulated funding can only be created from bundled demo templates, never with a user-supplied amount or payee. Custom milestones require authentic PayPal Orders approval.",
          },
          { status: 400 }
        );
      }

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
        eventType: "JOB_FUNDED [SIMULATED]",
        previousState: job.status,
        newState: "FUNDED",
        actor: "CLIENT",
        isMock: true,
        payload: {
          mockOrderId,
          mockCaptureId,
          amount: job.amount,
          currency: job.currency,
          mode: "SIMULATED_DEMO_ESCROW",
          isSimulated: true,
        },
      });

      return NextResponse.json({
        success: true,
        status: "FUNDED",
        orderId: mockOrderId,
        captureId: mockCaptureId,
        isSimulated: true,
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
