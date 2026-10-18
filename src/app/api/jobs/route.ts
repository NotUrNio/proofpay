import { NextRequest, NextResponse } from "next/server";
import { db, jobs, criteria, mandates, policies } from "@/db";
import { appendLedgerEvent } from "@/db/ledger";
import { signMandate } from "@/lib/guard";
import { ensureDatabaseSchema } from "@/db/init";
import { desc } from "drizzle-orm";

export async function GET() {
  await ensureDatabaseSchema();
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  return NextResponse.json({ jobs: allJobs });
}

export async function POST(req: NextRequest) {
  await ensureDatabaseSchema();
  try {
    const body = await req.json();
    const {
      title = "Social Media Banner Design",
      description = "Summer sale campaign banner 1080x1080 PNG featuring SUMMER SALE text and brand warm colors.",
      clientEmail = "sandbox-buyer@business.example.com",
      freelancerEmail = "priya-designer@sandbox.paypal.com",
      amount = "50.00",
      currency = "USD",
      scope = "social_media_banner_milestone_1",
    } = body;

    // 1. Create Job
    const [newJob] = await db
      .insert(jobs)
      .values({
        title,
        description,
        clientEmail,
        freelancerEmail,
        amount,
        currency,
        status: "CREATED",
      })
      .returning();

    // 2. Create Default Acceptance Criteria (Deterministic & LLM Rubrics)
    const seedCriteria = [
      {
        jobId: newJob.id,
        type: "deterministic" as const,
        name: "Exact Resolution 1080x1080px",
        ruleSpec: { width: 1080, height: 1080 },
        isHardCheck: true,
      },
      {
        jobId: newJob.id,
        type: "deterministic" as const,
        name: "PNG Image Format",
        ruleSpec: { mimeType: "image/png" },
        isHardCheck: true,
      },
      {
        jobId: newJob.id,
        type: "deterministic" as const,
        name: "File Size <= 2 MB",
        ruleSpec: { maxSizeBytes: 2 * 1024 * 1024 },
        isHardCheck: true,
      },
      {
        jobId: newJob.id,
        type: "deterministic" as const,
        name: "Contains Required Text: SUMMER SALE",
        ruleSpec: { requiredKeywords: ["SUMMER SALE"] },
        isHardCheck: true,
      },
      {
        jobId: newJob.id,
        type: "llm_rubric" as const,
        name: "Brand Aesthetics & Warm Color Palette",
        ruleSpec: { rubricPrompt: "Deliverable uses a warm summer palette (orange, yellow, coral tones) and clean typography." },
        isHardCheck: false,
      },
    ];

    for (const c of seedCriteria) {
      await db.insert(criteria).values(c);
    }

    // 3. Create & Cryptographically Sign Intent Mandate
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days validity
    const signed = signMandate({
      jobId: newJob.id,
      maxAmount: amount,
      currency,
      payeeEmail: freelancerEmail,
      scope,
      expiresAt,
    });

    await db.insert(mandates).values({
      jobId: newJob.id,
      maxAmount: signed.maxAmount,
      currency: signed.currency,
      payeeEmail: signed.payeeEmail,
      scope: signed.scope,
      expiresAt: new Date(signed.expiresAt),
      signature: signed.signature,
    });

    // 4. Ensure Default System Policy exists
    const existingPolicy = await db.select().from(policies).limit(1);
    if (existingPolicy.length === 0) {
      await db.insert(policies).values({
        name: "Default Standard Policy",
        maxDailyPayoutAmount: "1000.00",
        maxJobPayoutAmount: "500.00",
        minConfidenceThreshold: "0.8500",
        requireHumanReviewIfAmbiguous: true,
        isActive: true,
      });
    }

    // 5. Append immutable event to Audit Ledger
    await appendLedgerEvent({
      jobId: newJob.id,
      eventType: "JOB_CREATED",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: {
        jobId: newJob.id,
        title: newJob.title,
        amount: newJob.amount,
        currency: newJob.currency,
        mandateSignature: signed.signature.slice(0, 16) + "...",
      },
    });

    return NextResponse.json({
      success: true,
      job: newJob,
      mandate: signed,
    });
  } catch (err) {
    console.error("[API] Failed to create job:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
