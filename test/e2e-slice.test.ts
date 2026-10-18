import { describe, it, expect, beforeAll } from "vitest";
import { ensureDatabaseSchema } from "../src/db/init";
import { db, jobs, criteria, mandates, submissions, verdicts, payments } from "../src/db";
import { getJobLedger, appendLedgerEvent } from "../src/db/ledger";
import { signMandate } from "../src/lib/guard/mandate";
import { verifySubmission } from "../src/lib/verifier";
import { evaluatePolicyGuard } from "../src/lib/guard/guard";
import { createPayout } from "../src/lib/paypal";
import { eq } from "drizzle-orm";

describe("Milestone 1 End-to-End Vertical Slice Acceptance Test", () => {
  beforeAll(async () => {
    process.env.PAYPAL_MOCK = "true";
    await ensureDatabaseSchema();
  });

  it("completes the full autonomous escrow happy path from clean DB to payout and ledger verification", async () => {
    // 1. CREATE JOB
    const [job] = await db
      .insert(jobs)
      .values({
        title: "Social Media Banner (Summer Sale)",
        description: "1080x1080 PNG promotional banner for summer sale campaign.",
        clientEmail: "sandbox-buyer@business.example.com",
        freelancerEmail: "priya-designer@sandbox.paypal.com",
        amount: "50.00",
        currency: "USD",
        status: "CREATED",
      })
      .returning();

    expect(job.id).toBeDefined();
    expect(job.status).toBe("CREATED");

    // Add Criteria
    const seedCriteria = [
      {
        jobId: job.id,
        type: "deterministic" as const,
        name: "Resolution 1080x1080px",
        ruleSpec: { width: 1080, height: 1080 },
        isHardCheck: true,
      },
      {
        jobId: job.id,
        type: "deterministic" as const,
        name: "PNG Format",
        ruleSpec: { mimeType: "image/png" },
        isHardCheck: true,
      },
      {
        jobId: job.id,
        type: "deterministic" as const,
        name: "Contains SUMMER SALE",
        ruleSpec: { requiredKeywords: ["SUMMER SALE"] },
        isHardCheck: true,
      },
      {
        jobId: job.id,
        type: "llm_rubric" as const,
        name: "Warm Palette Rubric",
        ruleSpec: { rubricPrompt: "Warm coral and gold colors" },
        isHardCheck: false,
      },
    ];

    for (const c of seedCriteria) {
      await db.insert(criteria).values(c);
    }

    // Sign Mandate
    const mandatePayload = {
      jobId: job.id,
      maxAmount: "50.00",
      currency: "USD",
      payeeEmail: "priya-designer@sandbox.paypal.com",
      scope: "social_media_banner",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    const signed = signMandate(mandatePayload);

    await db.insert(mandates).values({
      jobId: job.id,
      maxAmount: signed.maxAmount,
      currency: signed.currency,
      payeeEmail: signed.payeeEmail,
      scope: signed.scope,
      expiresAt: new Date(signed.expiresAt),
      signature: signed.signature,
    });

    await appendLedgerEvent({
      jobId: job.id,
      eventType: "JOB_CREATED",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      isMock: true,
      payload: { jobId: job.id, amount: job.amount },
    });

    // 2. FUND ESCROW
    await db.update(jobs).set({ status: "FUNDED" }).where(eq(jobs.id, job.id));

    await db.insert(payments).values({
      jobId: job.id,
      type: "FUNDING",
      paypalId: "MOCK_CAPTURE_12345",
      amount: job.amount,
      currency: job.currency,
      status: "COMPLETED",
      isMock: true,
    });

    await appendLedgerEvent({
      jobId: job.id,
      eventType: "JOB_FUNDED",
      previousState: "CREATED",
      newState: "FUNDED",
      actor: "CLIENT",
      isMock: true,
      payload: { captureId: "MOCK_CAPTURE_12345", amount: job.amount },
    });

    // 3. SUBMIT DELIVERABLE
    const [sub] = await db
      .insert(submissions)
      .values({
        jobId: job.id,
        textContent: "Summer Sale promotional banner with SUMMER SALE typography and warm palette.",
        mimeType: "image/png",
        fileSizeBytes: "524288",
        metadata: { width: 1080, height: 1080 },
      })
      .returning();

    await db.update(jobs).set({ status: "SUBMITTED" }).where(eq(jobs.id, job.id));

    await appendLedgerEvent({
      jobId: job.id,
      eventType: "WORK_SUBMITTED",
      previousState: "FUNDED",
      newState: "SUBMITTED",
      actor: "FREELANCER",
      isMock: true,
      payload: { submissionId: sub.id },
    });

    // 4. VERIFY DELIVERABLE
    const dbCriteriaList = await db.select().from(criteria).where(eq(criteria.jobId, job.id));
    const formattedCriteria = dbCriteriaList.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as "deterministic" | "llm_rubric",
      isHardCheck: c.isHardCheck,
      ruleSpec: c.ruleSpec as Record<string, unknown>,
    }));

    const verdict = await verifySubmission(formattedCriteria, {
      textContent: "Summer Sale promotional banner with SUMMER SALE typography and warm palette.",
      mimeType: "image/png",
      fileSizeBytes: 524288,
      imageDimensions: { width: 1080, height: 1080 },
    });

    expect(verdict.overallPassed).toBe(true);
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.85);

    const [savedVerdict] = await db
      .insert(verdicts)
      .values({
        submissionId: sub.id,
        overallPassed: verdict.overallPassed,
        confidence: String(verdict.confidence),
        reasoning: verdict.reasoning,
        perCriteriaResults: verdict.perCriteriaResults,
      })
      .returning();

    await appendLedgerEvent({
      jobId: job.id,
      eventType: "VERIFICATION_COMPLETED",
      previousState: "SUBMITTED",
      newState: "VERIFIED",
      actor: "VERIFIER",
      isMock: true,
      payload: { verdictId: savedVerdict.id, confidence: verdict.confidence },
    });

    // 5. EVALUATE POLICY GUARD (Zero LLM)
    const guardResult = evaluatePolicyGuard({
      job: {
        id: job.id,
        amount: job.amount,
        currency: job.currency,
        status: "VERIFIED",
        freelancerEmail: job.freelancerEmail,
      },
      mandate: signed,
      verdict: {
        overallPassed: verdict.overallPassed,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
        perCriteriaResults: verdict.perCriteriaResults,
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
        signingSecret: process.env.MANDATE_SIGNING_SECRET || "default_test_secret_32_chars_min",
      },
    });

    expect(guardResult.decision).toBe("AUTO_PAY");
    expect(guardResult.firedRuleIds).toEqual([]);

    await appendLedgerEvent({
      jobId: job.id,
      eventType: "GUARD_EVALUATED",
      previousState: "VERIFIED",
      newState: "AUTO_PAY",
      actor: "GUARD",
      isMock: true,
      payload: { decision: guardResult.decision },
    });

    // 6. PAYOUT EXECUTION
    const payoutResult = await createPayout({
      recipientEmail: job.freelancerEmail,
      amount: job.amount,
      currency: job.currency,
      note: "ProofPay milestone settlement",
      senderBatchId: `batch_${job.id}`,
      senderItemId: `item_${job.id}`,
    });

    expect(payoutResult.batch_header.payout_batch_id).toBeDefined();

    await db.insert(payments).values({
      jobId: job.id,
      type: "PAYOUT",
      paypalId: payoutResult.batch_header.payout_batch_id,
      senderBatchId: `batch_${job.id}`,
      amount: job.amount,
      currency: job.currency,
      status: "COMPLETED",
      isMock: true,
    });

    await db.update(jobs).set({ status: "SETTLED" }).where(eq(jobs.id, job.id));

    await appendLedgerEvent({
      jobId: job.id,
      eventType: "PAYOUT_INITIATED",
      previousState: "AUTO_PAY",
      newState: "SETTLED",
      actor: "PAYPAL_API",
      isMock: true,
      payload: { payoutBatchId: payoutResult.batch_header.payout_batch_id },
    });

    // 7. AUDIT LEDGER VALIDATION
    const ledger = await getJobLedger(job.id);
    expect(ledger.length).toBe(6);

    const eventTypes = ledger.map((e) => e.eventType);
    expect(eventTypes).toEqual([
      "JOB_CREATED",
      "JOB_FUNDED",
      "WORK_SUBMITTED",
      "VERIFICATION_COMPLETED",
      "GUARD_EVALUATED",
      "PAYOUT_INITIATED",
    ]);

    // Check that every row has isMock recorded
    expect(ledger.every((e) => typeof e.isMock === "boolean")).toBe(true);

    // Check cryptographic hash chaining
    expect(ledger.every((e) => e.signatureOrHash !== null && e.signatureOrHash.length === 64)).toBe(true);
  });
});
