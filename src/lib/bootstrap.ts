import { db } from "@/db";
import { jobs, criteria, mandates, submissions, verdicts, payments, policies, approvals, ledgerEvents } from "@/db/schema";
import { ensureDatabaseSchema } from "@/db/init";
import { appendLedgerEvent, verifyLedgerChain } from "@/db/ledger";
import { signMandate } from "@/lib/guard/mandate";
import { eq, and, inArray } from "drizzle-orm";

export const BUNDLED_JOB_IDS = {
  PAID: "bf3884d6-3fdf-496d-87db-5dbbe4461443",
  NEEDS_HUMAN: "10c2bab9-02a6-45ab-b652-9552b584769b",
  FUNDED: "20f829e2-8aff-4bab-8e4b-710c004ffc6d",
};

/**
 * Idempotently bootstraps default policies and bundled demo jobs on hosted or fresh databases.
 * Does not overwrite existing rows.
 */
export async function ensureHostedBootstrap(): Promise<void> {
  await ensureDatabaseSchema();

  // 1. Ensure default policy exists
  const existingPolicies = await db.select().from(policies).limit(1);
  if (existingPolicies.length === 0) {
    await db.insert(policies).values({
      name: "Default ProofPay Safety & Risk Policy",
      maxDailyPayoutAmount: "1000.00",
      maxJobPayoutAmount: "500.00",
      minConfidenceThreshold: "0.8500",
      requireHumanReviewIfAmbiguous: true,
      isActive: true,
    });
  }

  // 2. Ensure bundled demo jobs exist
  const existingJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(inArray(jobs.id, Object.values(BUNDLED_JOB_IDS)));

  const existingIds = new Set(existingJobs.map((j) => j.id));

  const clientEmail = "alice@proofpay.io";
  const freelancerEmail = "priya@proofpay.io";

  // Demo Job 1: PAID (bf3884d6-3fdf-496d-87db-5dbbe4461443)
  if (!existingIds.has(BUNDLED_JOB_IDS.PAID)) {
    const id = BUNDLED_JOB_IDS.PAID;
    await db.insert(jobs).values({
      id,
      title: "Social Media Banner (Summer Sale)",
      description: "1080x1080 PNG promotional banner for summer sale campaign.",
      clientEmail,
      freelancerEmail,
      amount: "5.00",
      currency: "USD",
      status: "PAID",
    });

    const sig = signMandate({
      jobId: id,
      maxAmount: "10.00",
      currency: "USD",
      payeeEmail: freelancerEmail,
      scope: "social_media_banner",
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    });

    await db.insert(mandates).values({
      jobId: id,
      signature: sig.signature,
      maxAmount: "10.00",
      currency: "USD",
      payeeEmail: freelancerEmail,
      scope: "social_media_banner",
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    await db.insert(payments).values({
      jobId: id,
      type: "PAYOUT",
      paypalId: "PAYOUT-SEED-PAID-01",
      amount: "5.00",
      currency: "USD",
      status: "COMPLETED",
      isMock: true,
    });

    await appendLedgerEvent({
      jobId: id,
      eventType: "JOB_CREATED",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: { title: "Social Media Banner (Summer Sale)", amount: "5.00", currency: "USD" },
    });
    await appendLedgerEvent({
      jobId: id,
      eventType: "PAYOUT_RELEASED [SIMULATED]",
      previousState: "VERIFIED",
      newState: "PAID",
      actor: "SYSTEM",
      payload: { payoutBatchId: "SIMULATED-PAID-01", amount: "5.00", currency: "USD" },
    });
  }

  // Demo Job 2: NEEDS_HUMAN (10c2bab9-02a6-45ab-b652-9552b584769b)
  if (!existingIds.has(BUNDLED_JOB_IDS.NEEDS_HUMAN)) {
    const id = BUNDLED_JOB_IDS.NEEDS_HUMAN;
    await db.insert(jobs).values({
      id,
      title: "Instagram Story Banner (Near-Miss Crimson)",
      description: "Near-miss color deliverable triggering automated policy guard human review.",
      clientEmail,
      freelancerEmail,
      amount: "7.50",
      currency: "USD",
      status: "VERIFIED",
    });

    const sig = signMandate({
      jobId: id,
      maxAmount: "15.00",
      currency: "USD",
      payeeEmail: freelancerEmail,
      scope: "story_banner",
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    });

    await db.insert(mandates).values({
      jobId: id,
      signature: sig.signature,
      maxAmount: "15.00",
      currency: "USD",
      payeeEmail: freelancerEmail,
      scope: "story_banner",
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    const [sub] = await db
      .insert(submissions)
      .values({
        jobId: id,
        fileUrl: "https://proofpay.io/fixtures/near_miss.png",
        mimeType: "image/png",
        fileSizeBytes: "184000",
        textContent: "Near-miss banner submitted for verification",
      })
      .returning();

    await db.insert(verdicts).values({
      submissionId: sub.id,
      overallPassed: false,
      confidence: "0.7800",
      reasoning: "Borderline chromatic tolerance near boundary threshold.",
      perCriteriaResults: [{ criterionId: "c1", passed: false, reason: "Borderline color" }],
    });

    await db.insert(approvals).values({
      jobId: id,
      submissionId: sub.id,
      status: "PENDING",
      reason: "Confidence score 0.7800 is below policy threshold 0.8500",
    });

    await appendLedgerEvent({
      jobId: id,
      eventType: "JOB_CREATED",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: { title: "Instagram Story Banner (Near-Miss Crimson)", amount: "7.50", currency: "USD" },
    });
    await appendLedgerEvent({
      jobId: id,
      eventType: "GUARD_EVALUATED",
      previousState: "SUBMITTED",
      newState: "VERIFIED",
      actor: "GUARD",
      payload: { decision: "NEEDS_HUMAN", reasoning: "Confidence score 0.7800 is below policy threshold" },
    });
  }

  // Demo Job 3: FUNDED (20f829e2-8aff-4bab-8e4b-710c004ffc6d)
  if (!existingIds.has(BUNDLED_JOB_IDS.FUNDED)) {
    const id = BUNDLED_JOB_IDS.FUNDED;
    await db.insert(jobs).values({
      id,
      title: "Hero Brand Illustration (Awaiting Submission)",
      description: "Custom SVG/PNG hero illustration awaiting freelancer submission.",
      clientEmail,
      freelancerEmail,
      amount: "12.00",
      currency: "USD",
      status: "FUNDED",
    });

    const sig = signMandate({
      jobId: id,
      maxAmount: "20.00",
      currency: "USD",
      payeeEmail: freelancerEmail,
      scope: "hero_illustration",
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    });

    await db.insert(mandates).values({
      jobId: id,
      signature: sig.signature,
      maxAmount: "20.00",
      currency: "USD",
      payeeEmail: freelancerEmail,
      scope: "hero_illustration",
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    await db.insert(payments).values({
      jobId: id,
      type: "FUNDING",
      paypalId: "ORDER-SEED-FUNDED-01",
      amount: "12.00",
      currency: "USD",
      status: "COMPLETED",
      isMock: true,
    });

    await appendLedgerEvent({
      jobId: id,
      eventType: "JOB_CREATED",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: { title: "Hero Brand Illustration (Awaiting Submission)", amount: "12.00", currency: "USD" },
    });
    await appendLedgerEvent({
      jobId: id,
      eventType: "JOB_FUNDED",
      previousState: "CREATED",
      newState: "FUNDED",
      actor: "CLIENT",
      payload: { orderId: "ORDER-SEED-FUNDED-01", amount: "12.00", currency: "USD" },
    });
  }
}

/**
 * Idempotently restores the 3 bundled demo jobs to their canonical presentation states
 * (PAID, NEEDS_HUMAN, FUNDED) WITHOUT deleting any ledger rows (preserving append-only provenance).
 */
export async function resetBundledDemoState(): Promise<{ changedRows: string[]; ledgerEventId: string }> {
  await ensureHostedBootstrap();

  const changedRows: string[] = [];

  // 1. Reset NEEDS_HUMAN (10c2bab9-02a6-45ab-b652-9552b584769b)
  const nhId = BUNDLED_JOB_IDS.NEEDS_HUMAN;
  const [nhJob] = await db.select().from(jobs).where(eq(jobs.id, nhId));
  if (nhJob && nhJob.status !== "VERIFIED") {
    await db.update(jobs).set({ status: "VERIFIED", updatedAt: new Date() }).where(eq(jobs.id, nhId));
    // Remove any simulated payout added during demo triage
    await db.delete(payments).where(and(eq(payments.jobId, nhId), eq(payments.type, "PAYOUT")));
    await db.update(approvals).set({ status: "PENDING", reviewerEmail: null }).where(eq(approvals.jobId, nhId));
    changedRows.push(`jobs[${nhId}]: status '${nhJob.status}' -> 'VERIFIED', approvals -> PENDING, removed simulated payout`);
  }

  // 2. Reset FUNDED (20f829e2-8aff-4bab-8e4b-710c004ffc6d)
  const fId = BUNDLED_JOB_IDS.FUNDED;
  const [fJob] = await db.select().from(jobs).where(eq(jobs.id, fId));
  if (fJob && fJob.status !== "FUNDED") {
    await db.update(jobs).set({ status: "FUNDED", updatedAt: new Date() }).where(eq(jobs.id, fId));
    changedRows.push(`jobs[${fId}]: status '${fJob.status}' -> 'FUNDED'`);
  }

  // 3. Reset PAID (bf3884d6-3fdf-496d-87db-5dbbe4461443)
  const pId = BUNDLED_JOB_IDS.PAID;
  const [pJob] = await db.select().from(jobs).where(eq(jobs.id, pId));
  if (pJob && pJob.status !== "PAID") {
    await db.update(jobs).set({ status: "PAID", updatedAt: new Date() }).where(eq(jobs.id, pId));
    changedRows.push(`jobs[${pId}]: status '${pJob.status}' -> 'PAID'`);
  }

  // Record an append-only audit event marking the reset on every invocation
  const [nhCurrent] = await db.select().from(jobs).where(eq(jobs.id, nhId));
  const ledgerEvent = await appendLedgerEvent({
    jobId: nhId,
    eventType: "DEMO_STATE_RESET",
    previousState: nhCurrent?.status || "VERIFIED",
    newState: "VERIFIED",
    actor: "ADMIN",
    payload: {
      reason: "Idempotent bundled demo state reset",
      changedRows,
      resetAt: new Date().toISOString(),
    },
  });

  return { changedRows, ledgerEventId: ledgerEvent.id };
}
