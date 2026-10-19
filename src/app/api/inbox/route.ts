import { NextRequest, NextResponse } from "next/server";
import { db, jobs, verdicts, submissions, mandates, policies, payments } from "@/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { evaluatePolicyGuard } from "@/lib/guard";
import { createPayout } from "@/lib/paypal/payouts";
import { refundCapturedPayment } from "@/lib/paypal/orders";
import { appendLedgerEvent } from "@/db/ledger";
import { assertAuthorizedRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Role check: Only reviewers can inspect the human review queue
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  try {
    const candidateJobs = await db
      .select()
      .from(jobs)
      .where(inArray(jobs.status, ["VERIFIED", "MANUAL_REVIEW"]))
      .orderBy(desc(jobs.createdAt));

    const inboxItems = [];

    for (const job of candidateJobs) {
      const jobSubmissions = await db
        .select()
        .from(submissions)
        .where(eq(submissions.jobId, job.id))
        .orderBy(desc(submissions.createdAt))
        .limit(1);

      const latestSub = jobSubmissions[0];
      if (!latestSub) continue;

      const [verdict] = await db
        .select()
        .from(verdicts)
        .where(eq(verdicts.submissionId, latestSub.id))
        .limit(1);

      if (!verdict) continue;

      const conf = parseFloat(verdict.confidence);
      const isReviewRequired =
        job.status === "MANUAL_REVIEW" ||
        verdict.overallPassed === false ||
        conf < 0.85 ||
        verdict.reasoning.includes("review") ||
        verdict.reasoning.includes("Borderline");

      if (isReviewRequired) {
        const [mandate] = await db
          .select()
          .from(mandates)
          .where(eq(mandates.jobId, job.id))
          .limit(1);

        inboxItems.push({
          job,
          submission: latestSub,
          verdict,
          mandate,
        });
      }
    }

    return NextResponse.json({
      success: true,
      items: inboxItems,
    });
  } catch (error) {
    console.error("[Inbox API] Failed to fetch review queue:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch review items" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Server-side role check: Only reviewer role can approve/reject deliverables
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }
  const sessionUser = auth.user;

  try {
    const body = await req.json();
    const { jobId, action, reviewerEmail = sessionUser.email } = body;

    if (!jobId || !action) {
      return NextResponse.json({ error: "Missing jobId or action" }, { status: 400 });
    }

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const [mandate] = await db.select().from(mandates).where(eq(mandates.jobId, jobId)).limit(1);
    if (!mandate) {
      return NextResponse.json({ error: "No mandate found for job" }, { status: 400 });
    }

    const [latestSub] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.jobId, jobId))
      .orderBy(desc(submissions.createdAt))
      .limit(1);

    const [verdict] = latestSub
      ? await db.select().from(verdicts).where(eq(verdicts.submissionId, latestSub.id)).limit(1)
      : [null];

    if (action === "approve") {
      // Security Check: evaluate pure TypeScript Policy Guard (ZERO LLM imports)
      const guardResult = evaluatePolicyGuard({
        job: {
          id: job.id,
          amount: job.amount,
          currency: job.currency,
          status: "VERIFIED",
          freelancerEmail: job.freelancerEmail,
        },
        mandate: {
          jobId: mandate.jobId,
          maxAmount: mandate.maxAmount,
          currency: mandate.currency,
          payeeEmail: mandate.payeeEmail,
          scope: mandate.scope,
          expiresAt: mandate.expiresAt.toISOString(),
          signature: mandate.signature,
        },
        verdict: {
          overallPassed: true,
          confidence: 1.0,
          reasoning: `Approved via human review by ${reviewerEmail}`,
          perCriteriaResults: [],
          allHardChecksPassed: true,
          injectionSuspected: false,
        },
        policy: {
          maxDailyPayoutAmount: "1000.00",
          maxJobPayoutAmount: "500.00",
          minConfidenceThreshold: 0.85,
          requireHumanReviewIfAmbiguous: true,
        },
        context: {
          dailyPayoutTotalSoFar: 0,
          isIdempotencyKeyUsed: false,
          signingSecret: process.env.MANDATE_SIGNING_SECRET || "default_test_signing_secret_min_32_chars_ok!",
        },
      });

      if (guardResult.decision !== "AUTO_PAY") {
        return NextResponse.json(
          {
            error: `Policy Guard rejected manual approval: ${guardResult.decision} - ${guardResult.summary}`,
          },
          { status: 403 }
        );
      }

      // Execute instant PayPal payout
      const isMock = process.env.PAYPAL_MOCK === "true";
      const senderBatchId = `batch_rev_${job.id.slice(0, 8)}_${Date.now()}`;
      const senderItemId = `item_rev_${job.id.slice(0, 8)}`;

      let payoutRes;
      try {
        payoutRes = await createPayout({
          recipientEmail: job.freelancerEmail,
          amount: job.amount,
          currency: job.currency,
          note: `ProofPay Milestone Settled (Approved via Human Review): ${job.title}`,
          senderBatchId,
          senderItemId,
        });
      } catch (payoutErr: any) {
        console.error("[Inbox Approval Payout] Error:", payoutErr);
        const errDetails = payoutErr.details || payoutErr.message || "";
        const isInsufficientFunds =
          typeof errDetails === "string"
            ? errDetails.includes("INSUFFICIENT_FUNDS") || errDetails.includes("ERRPYO004")
            : JSON.stringify(errDetails).includes("INSUFFICIENT_FUNDS");

        if (isInsufficientFunds) {
          await appendLedgerEvent({
            jobId: job.id,
            eventType: "PAYOUT_FAILED_INSUFFICIENT_FUNDS",
            previousState: job.status,
            newState: "FUNDS_DEPLETED",
            actor: "ADMIN",
            isMock,
            payload: {
              error: "INSUFFICIENT_FUNDS",
              reviewerEmail,
              reason: "Platform Sandbox balance depleted over unbacked demo runs",
              details: errDetails,
            },
          });

          return NextResponse.json(
            {
              error: "Platform Sandbox Escrow Balance Depleted",
              message:
                "PayPal rejected payout with INSUFFICIENT_FUNDS. The platform sandbox balance is empty after multiple unbacked demo runs. Please top up your sandbox account or enable PAYPAL_MOCK=true.",
            },
            { status: 402 }
          );
        }
        throw payoutErr;
      }

      const payoutBatchId = payoutRes.batch_header.payout_batch_id;
      const payoutItemId = senderItemId;

      // Update job status to PAID
      await db
        .update(jobs)
        .set({ status: "PAID", updatedAt: new Date() })
        .where(eq(jobs.id, job.id));

      // Record in payments table
      await db.insert(payments).values({
        jobId: job.id,
        type: "PAYOUT",
        paypalId: payoutBatchId,
        senderBatchId,
        amount: job.amount,
        currency: job.currency,
        status: "SUCCESS",
        isMock,
        rawResponse: payoutRes as unknown as Record<string, unknown>,
      });

      // Append immutable ledger event
      await appendLedgerEvent({
        jobId: job.id,
        eventType: isMock ? "PAYOUT_RELEASED [SIMULATED]" : "PAYOUT_RELEASED",
        previousState: job.status,
        newState: "PAID",
        actor: "ADMIN",
        isMock,
        payload: {
          payoutBatchId,
          payoutItemId,
          amount: job.amount,
          currency: job.currency,
          reviewerEmail,
          note: "Approved via human review queue",
          mode: isMock ? "SIMULATED_TEST_MODE" : "REAL_PAYPAL_SANDBOX",
        },
      });

      return NextResponse.json({
        success: true,
        decision: "APPROVED",
        payoutBatchId,
      });
    } else if (action === "reject" || action === "reject_and_refund") {
      // Find captured payment for this job to refund escrow
      const [fundingPayment] = await db
        .select()
        .from(payments)
        .where(and(eq(payments.jobId, job.id), eq(payments.type, "FUNDING")))
        .limit(1);

      let refundId: string | null = null;
      let refundStatus: string = "COMPLETED";

      if (fundingPayment && fundingPayment.paypalId) {
        try {
          const refundRes = await refundCapturedPayment({
            captureId: fundingPayment.paypalId,
            amount: job.amount,
            currency: job.currency,
            noteToPayer: `ProofPay Escrow Refund: Deliverable rejected during review for ${job.title}`,
            requestId: `ref_${job.id.slice(0, 8)}_${Date.now()}`,
          });
          refundId = refundRes.id;
          refundStatus = refundRes.status;

          // Record refund in payments table
          await db.insert(payments).values({
            jobId: job.id,
            type: "REFUND",
            paypalId: refundRes.id,
            amount: job.amount,
            currency: job.currency,
            status: refundRes.status,
            isMock: process.env.PAYPAL_MOCK === "true",
            rawResponse: refundRes as unknown as Record<string, unknown>,
          });
        } catch (refundErr) {
          console.error("[Inbox API] Refund execution error:", refundErr);
          // Still proceed with job rejection if refund fails or in mock
          refundId = "REFUND_ERROR_LOGGED";
        }
      }

      await db
        .update(jobs)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(eq(jobs.id, job.id));

      await appendLedgerEvent({
        jobId: job.id,
        eventType: refundId ? "ESCROW_REFUNDED" : "JOB_REJECTED",
        previousState: job.status,
        newState: "REJECTED",
        actor: "ADMIN",
        payload: {
          reviewerEmail,
          reason: "Rejected in human review queue: Escrow refunded to client",
          refundId,
          refundStatus,
          captureId: fundingPayment?.paypalId || null,
          amount: job.amount,
          currency: job.currency,
        },
      });

      return NextResponse.json({
        success: true,
        decision: "REJECTED",
        refundId,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Inbox API] Action failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 }
    );
  }
}
