import { NextRequest, NextResponse } from "next/server";
import { db, jobs, criteria, mandates, submissions, verdicts, payments, policies, approvals, idempotencyKeys } from "@/db";
import { appendLedgerEvent } from "@/db/ledger";
import { verifySubmission, CriterionDefinition, SubmissionData } from "@/lib/verifier";
import { evaluatePolicyGuard, SignedMandate } from "@/lib/guard";
import { createPayout, isPayPalMock } from "@/lib/paypal";
import { assertAuthorizedRole, checkRateLimit } from "@/lib/auth/roles";
import { eq, sum } from "drizzle-orm";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Server-side role check: Only freelancers or reviewers can submit deliverables
  const auth = assertAuthorizedRole(req, ["freelancer", "reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  // Rate limiting to protect Gemini API quota (5 submissions per minute)
  const clientIp = req.headers.get("x-forwarded-for") || "local_client";
  const rateLimit = checkRateLimit(`submit_${clientIp}`, 5, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Submissions are limited to 5 per minute to protect Gemini API quota.",
      },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      textContent = "Summer Sale Promotional Campaign Banner. Contains SUMMER SALE title in clean typography with a warm coral/gold color palette.",
      width = 1080,
      height = 1080,
      mimeType = "image/png",
      fileSizeBytes = 512000, // ~500 KB
      fileName = "summer_sale_banner_1080x1080.png",
      fileBase64,
    } = body;

    // Hard payload size limit (10 MB upload cap)
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    if (fileSizeBytes > MAX_UPLOAD_BYTES || (fileBase64 && fileBase64.length > (MAX_UPLOAD_BYTES * 4) / 3)) {
      return NextResponse.json(
        {
          error: `Payload too large. File size exceeds the platform upload cap of 10 MB (${fileSizeBytes} bytes provided).`,
        },
        { status: 413 }
      );
    }

    // 1. Fetch Job
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const isMock = isPayPalMock();

    // 2. Insert Submission
    const [submission] = await db
      .insert(submissions)
      .values({
        jobId: id,
        textContent,
        mimeType,
        fileSizeBytes: String(fileSizeBytes),
        fileUrl: fileName,
        metadata: { width, height, fileName },
      })
      .returning();

    // 3. Append to Ledger: WORK_SUBMITTED
    await appendLedgerEvent({
      jobId: id,
      eventType: "WORK_SUBMITTED",
      previousState: job.status,
      newState: "SUBMITTED",
      actor: "FREELANCER",
      isMock,
      payload: {
        submissionId: submission.id,
        textContent: textContent.slice(0, 150),
        dimensions: `${width}x${height}`,
        mimeType,
        fileSizeBytes,
      },
    });

    await db.update(jobs).set({ status: "SUBMITTED", updatedAt: new Date() }).where(eq(jobs.id, id));

    // 4. Fetch Job Criteria & Run Verification Engine
    const dbCriteria = await db.select().from(criteria).where(eq(criteria.jobId, id));
    const criteriaList: CriterionDefinition[] = dbCriteria.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as "deterministic" | "llm_rubric",
      isHardCheck: c.isHardCheck,
      ruleSpec: c.ruleSpec as CriterionDefinition["ruleSpec"],
    }));

    const submissionData: SubmissionData = {
      textContent,
      fileName,
      mimeType,
      fileSizeBytes,
      imageDimensions: { width, height },
      fileBuffer: fileBase64 ? Buffer.from(fileBase64, "base64") : undefined,
    };

    const verdict = await verifySubmission(criteriaList, submissionData);

    // 5. Store Verdict in DB
    const [savedVerdict] = await db
      .insert(verdicts)
      .values({
        submissionId: submission.id,
        overallPassed: verdict.overallPassed,
        confidence: String(verdict.confidence),
        reasoning: verdict.reasoning,
        perCriteriaResults: verdict.perCriteriaResults,
      })
      .returning();

    // 6. Append to Ledger: VERIFICATION_COMPLETED
    await appendLedgerEvent({
      jobId: id,
      eventType: "VERIFICATION_COMPLETED",
      previousState: "SUBMITTED",
      newState: "VERIFIED",
      actor: "VERIFIER",
      isMock,
      payload: {
        submissionId: submission.id,
        verdictId: savedVerdict.id,
        overallPassed: verdict.overallPassed,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
        perCriteria: verdict.perCriteriaResults.map((r) => ({
          name: r.name,
          passed: r.passed,
          confidence: r.confidence,
        })),
      },
    });

    // 7. Fetch Mandate & System Policy for Policy Guard
    const [mandate] = await db.select().from(mandates).where(eq(mandates.jobId, id)).limit(1);
    if (!mandate) {
      throw new Error("No signed payment mandate found for this job");
    }

    const [policy] = await db.select().from(policies).limit(1);
    const activePolicy = policy || {
      maxDailyPayoutAmount: "1000.00",
      maxJobPayoutAmount: "500.00",
      minConfidenceThreshold: "0.8500",
      requireHumanReviewIfAmbiguous: true,
    };

    // Calculate daily payout total so far
    const payoutSum = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.type, "PAYOUT"));
    const dailyTotal = parseFloat(payoutSum[0]?.total || "0");

    // Check Idempotency Key
    const senderBatchId = `proofpay_payout_${id}_${submission.id.slice(0, 8)}`;
    const [existingIdempotency] = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, senderBatchId))
      .limit(1);

    const signedMandate: SignedMandate = {
      jobId: mandate.jobId,
      maxAmount: mandate.maxAmount,
      currency: mandate.currency,
      payeeEmail: mandate.payeeEmail,
      scope: mandate.scope,
      expiresAt: mandate.expiresAt.toISOString(),
      signature: mandate.signature,
    };

    // 8. Execute Pure TypeScript Policy Guard (ZERO LLM Imports)
    const guardResult = evaluatePolicyGuard({
      job: {
        id: job.id,
        amount: job.amount,
        currency: job.currency,
        status: "VERIFIED",
        freelancerEmail: job.freelancerEmail,
      },
      mandate: signedMandate,
      verdict: {
        overallPassed: verdict.overallPassed,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
        perCriteriaResults: verdict.perCriteriaResults,
      },
      policy: {
        maxDailyPayoutAmount: activePolicy.maxDailyPayoutAmount,
        maxJobPayoutAmount: activePolicy.maxJobPayoutAmount,
        minConfidenceThreshold: parseFloat(activePolicy.minConfidenceThreshold),
        requireHumanReviewIfAmbiguous: activePolicy.requireHumanReviewIfAmbiguous,
      },
      context: {
        dailyPayoutTotalSoFar: dailyTotal,
        isIdempotencyKeyUsed: Boolean(existingIdempotency),
      },
    });

    // 9. Append to Ledger: GUARD_EVALUATED
    await appendLedgerEvent({
      jobId: id,
      eventType: "GUARD_EVALUATED",
      previousState: "VERIFIED",
      newState: guardResult.decision,
      actor: "GUARD",
      isMock,
      payload: {
        decision: guardResult.decision,
        firedRuleIds: guardResult.firedRuleIds,
        summary: guardResult.summary,
        ruleResults: guardResult.ruleResults.map((r) => ({
          ruleId: r.ruleId,
          passed: r.passed,
          details: r.details,
        })),
      },
    });

    // 10. Execute Decision Action
    if (guardResult.decision === "AUTO_PAY") {
      // Record idempotency key
      await db.insert(idempotencyKeys).values({
        key: senderBatchId,
        scope: "paypal_payout",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Call PayPal Payouts API
      const payoutResult = await createPayout({
        recipientEmail: job.freelancerEmail,
        amount: job.amount,
        currency: job.currency,
        note: `ProofPay automated settlement for milestone: ${job.title}`,
        senderBatchId,
        senderItemId: `item_${id}_${Date.now()}`,
      });

      const payoutItemId = payoutResult.batch_header.payout_batch_id;

      // Record Payment
      await db.insert(payments).values({
        jobId: id,
        type: "PAYOUT",
        paypalId: payoutItemId,
        senderBatchId,
        amount: job.amount,
        currency: job.currency,
        status: "COMPLETED",
        isMock,
        rawResponse: payoutResult,
      });

      await db.update(jobs).set({ status: "SETTLED", updatedAt: new Date() }).where(eq(jobs.id, id));

      // Append to Ledger: PAYOUT_INITIATED
      await appendLedgerEvent({
        jobId: id,
        eventType: "PAYOUT_INITIATED",
        previousState: "GUARD_EVALUATED",
        newState: "SETTLED",
        actor: "PAYPAL_API",
        isMock,
        payload: {
          recipientEmail: job.freelancerEmail,
          amount: job.amount,
          currency: job.currency,
          payoutBatchId: payoutItemId,
          senderBatchId,
          batchStatus: payoutResult.batch_header.batch_status,
        },
      });

      return NextResponse.json({
        success: true,
        verdict,
        guard: guardResult,
        decision: "AUTO_PAY",
        jobStatus: "SETTLED",
        payout: {
          payoutBatchId: payoutItemId,
          recipientEmail: job.freelancerEmail,
          amount: job.amount,
          currency: job.currency,
        },
      });
    }

    if (guardResult.decision === "NEEDS_HUMAN") {
      await db.insert(approvals).values({
        jobId: id,
        submissionId: submission.id,
        policyId: policy?.id,
        status: "PENDING",
        reason: guardResult.summary,
      });

      await db.update(jobs).set({ status: "MANUAL_REVIEW", updatedAt: new Date() }).where(eq(jobs.id, id));

      await appendLedgerEvent({
        jobId: id,
        eventType: "SENT_TO_APPROVAL_QUEUE",
        previousState: "GUARD_EVALUATED",
        newState: "MANUAL_REVIEW",
        actor: "GUARD",
        isMock,
        payload: {
          reason: guardResult.summary,
          firedRuleIds: guardResult.firedRuleIds,
        },
      });

      return NextResponse.json({
        success: true,
        verdict,
        guard: guardResult,
        decision: "NEEDS_HUMAN",
        jobStatus: "MANUAL_REVIEW",
        message: "Deliverable placed in human approval queue.",
      });
    }

    // Otherwise: REJECT
    await db.update(jobs).set({ status: "REJECTED", updatedAt: new Date() }).where(eq(jobs.id, id));

    await appendLedgerEvent({
      jobId: id,
      eventType: "JOB_REJECTED",
      previousState: "GUARD_EVALUATED",
      newState: "REJECTED",
      actor: "GUARD",
      isMock,
      payload: {
        reason: guardResult.summary,
        firedRuleIds: guardResult.firedRuleIds,
      },
    });

    return NextResponse.json({
      success: true,
      verdict,
      guard: guardResult,
      decision: "REJECT",
      jobStatus: "REJECTED",
      message: "Deliverable rejected by safety guard.",
    });
  } catch (err) {
    console.error("[API] Failed to process submission:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
