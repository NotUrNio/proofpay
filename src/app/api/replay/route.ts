import { NextRequest, NextResponse } from "next/server";
import { db, jobs, mandates, submissions, verdicts } from "@/db";
import { eq, desc } from "drizzle-orm";
import { evaluatePolicyGuard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, policy } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const [mandate] = await db.select().from(mandates).where(eq(mandates.jobId, jobId)).limit(1);
    if (!mandate) {
      return NextResponse.json({ error: "Mandate not found for job" }, { status: 404 });
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

    if (!verdict) {
      return NextResponse.json({ error: "No verification verdict found for job" }, { status: 400 });
    }

    // Historical decision deduced from job status & verdict
    const historicalDecision =
      job.status === "PAID" || job.status === "SETTLED"
        ? "AUTO_PAY"
        : job.status === "MANUAL_REVIEW" || !verdict.overallPassed
        ? "NEEDS_HUMAN"
        : "REJECT";

    // Run Pure TypeScript Policy Guard in DRY_RUN mode with changed policy parameters
    const guardPolicy = {
      maxDailyPayoutAmount: String(policy?.maxDailyPayoutAmount || "1000.00"),
      maxJobPayoutAmount: String(policy?.maxJobPayoutAmount || "500.00"),
      minConfidenceThreshold: parseFloat(policy?.minConfidenceThreshold ?? 0.85),
      requireHumanReviewIfAmbiguous: policy?.requireHumanReviewIfAmbiguous ?? true,
    };

    const replayedGuard = evaluatePolicyGuard({
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
        overallPassed: verdict.overallPassed,
        confidence: parseFloat(verdict.confidence),
        reasoning: verdict.reasoning,
        perCriteriaResults: (verdict.perCriteriaResults as unknown[])?.map((r: any) => ({
          name: r.name || "Criterion",
          passed: Boolean(r.passed),
          isHardCheck: Boolean(r.isHardCheck),
          reason: r.reason,
        })) || [],
        allHardChecksPassed: true,
        injectionSuspected: false,
      },
      policy: guardPolicy,
      context: {
        dailyPayoutTotalSoFar: 0,
        isIdempotencyKeyUsed: false,
        signingSecret: process.env.MANDATE_SIGNING_SECRET || "default_test_signing_secret_min_32_chars_ok!",
      },
    });

    const isChanged = historicalDecision !== replayedGuard.decision;

    return NextResponse.json({
      success: true,
      dryRun: true,
      job: {
        id: job.id,
        title: job.title,
        amount: job.amount,
        currency: job.currency,
        status: job.status,
      },
      historicalDecision,
      replayedDecision: replayedGuard.decision,
      isChanged,
      summary: replayedGuard.summary,
      firedRuleIds: replayedGuard.firedRuleIds,
      ruleResults: replayedGuard.ruleResults,
      appliedPolicy: guardPolicy,
    });
  } catch (error) {
    console.error("[Replay API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Replay simulation failed",
      },
      { status: 500 }
    );
  }
}
