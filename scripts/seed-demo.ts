import * as dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { ensureDatabaseSchema } from "../src/db/init";
import { db, jobs, mandates, submissions, verdicts, payments } from "../src/db";
import { appendLedgerEvent, verifyLedgerChain } from "../src/db/ledger";
import { signMandate } from "../src/lib/guard/mandate";

async function seed() {
  console.log("================================================================================");
  console.log("            ProofPay: Demo Seed & Instant Re-hydration Script                   ");
  console.log("================================================================================");

  await ensureDatabaseSchema();
  console.log("Database schema verified and Postgres triggers initialized.");

  const clientEmail = "alice@proofpay.io";
  const freelancerEmail = "priya@proofpay.io";

  // Demo Job 1: PAID (Full autonomous happy path)
  const job1Id = crypto.randomUUID();
  const [job1] = await db
    .insert(jobs)
    .values({
      id: job1Id,
      title: "Social Media Banner (Summer Sale)",
      description: "1080x1080 PNG promotional banner for summer sale campaign.",
      clientEmail,
      freelancerEmail,
      amount: "5.00",
      currency: "USD",
      status: "PAID",
    })
    .returning();

  const mandate1 = signMandate({
    jobId: job1.id,
    maxAmount: "10.00",
    currency: "USD",
    payeeEmail: freelancerEmail,
    scope: "social_media_banner",
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  });

  await db.insert(mandates).values({
    jobId: job1.id,
    signature: mandate1,
    maxAmount: "10.00",
    currency: "USD",
    payeeEmail: freelancerEmail,
    scope: "social_media_banner",
    expiresAt: new Date(Date.now() + 86400 * 1000),
  });

  await appendLedgerEvent({
    jobId: job1.id,
    eventType: "JOB_CREATED",
    previousState: null,
    newState: "CREATED",
    actor: "CLIENT",
    payload: { title: job1.title, amount: job1.amount, currency: job1.currency },
  });

  await appendLedgerEvent({
    jobId: job1.id,
    eventType: "JOB_FUNDED",
    previousState: "CREATED",
    newState: "FUNDED",
    actor: "CLIENT",
    payload: { orderId: "4LF11783H4649862W", captureId: "4GP221272V958470N", amount: "5.00", currency: "USD" },
  });

  const [sub1] = await db
    .insert(submissions)
    .values({
      jobId: job1.id,
      fileUrl: "/eval/fixtures/case_01_compliant_warm_grid.png",
      mimeType: "image/png",
      fileSizeBytes: "145820",
      metadata: { width: 1080, height: 1080 },
    })
    .returning();

  await appendLedgerEvent({
    jobId: job1.id,
    eventType: "DELIVERABLE_SUBMITTED",
    previousState: "FUNDED",
    newState: "SUBMITTED",
    actor: "FREELANCER",
    payload: { submissionId: sub1.id, fileName: "case_01_compliant_warm_grid.png" },
  });

  await db.insert(verdicts).values({
    submissionId: sub1.id,
    overallPassed: true,
    confidence: "0.9850",
    reasoning: "All mandatory hard checks and warm summer aesthetic rubrics passed with 100% ensemble agreement.",
    perCriteriaResults: [
      { id: "HC_PNG", name: "PNG Container", passed: true, confidence: 1.0 },
      { id: "HC_DIM", name: "1080x1080 Resolution", passed: true, confidence: 1.0 },
      { id: "rubric_palette", name: "Warm Palette (CIEDE2000 = 10.25)", passed: true, confidence: 0.98 },
      { id: "rubric_text", name: "Contains SUMMER SALE", passed: true, confidence: 1.0 },
    ],
  });

  await appendLedgerEvent({
    jobId: job1.id,
    eventType: "VERIFICATION_COMPLETED",
    previousState: "SUBMITTED",
    newState: "VERIFIED",
    actor: "SYSTEM",
    payload: { confidence: 0.985, decision: "AUTO_PAY" },
  });

  await appendLedgerEvent({
    jobId: job1.id,
    eventType: "PAYOUT_RELEASED",
    previousState: "VERIFIED",
    newState: "PAID",
    actor: "SYSTEM",
    payload: { payoutBatchId: "CPMFG3U4LAXS2", payoutItemId: "A7PB6RVHLGY2U", amount: "5.00", currency: "USD" },
  });

  // Demo Job 2: NEEDS_HUMAN (Borderline Palette in Review Queue)
  const job2Id = crypto.randomUUID();
  const [job2] = await db
    .insert(jobs)
    .values({
      id: job2Id,
      title: "Instagram Story Banner (Near-Miss Crimson)",
      description: "1080x1080 PNG promotional banner with near-miss warm red palette.",
      clientEmail,
      freelancerEmail,
      amount: "7.50",
      currency: "USD",
      status: "VERIFIED",
    })
    .returning();

  const mandate2 = signMandate({
    jobId: job2.id,
    maxAmount: "15.00",
    currency: "USD",
    payeeEmail: freelancerEmail,
    scope: "social_media_banner",
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  });

  await db.insert(mandates).values({
    jobId: job2.id,
    signature: mandate2,
    maxAmount: "15.00",
    currency: "USD",
    payeeEmail: freelancerEmail,
    scope: "social_media_banner",
    expiresAt: new Date(Date.now() + 86400 * 1000),
  });

  await appendLedgerEvent({
    jobId: job2.id,
    eventType: "JOB_CREATED",
    previousState: null,
    newState: "CREATED",
    actor: "CLIENT",
    payload: { title: job2.title, amount: job2.amount },
  });

  await appendLedgerEvent({
    jobId: job2.id,
    eventType: "JOB_FUNDED",
    previousState: "CREATED",
    newState: "FUNDED",
    actor: "CLIENT",
    payload: { amount: "7.50" },
  });

  const [sub2] = await db
    .insert(submissions)
    .values({
      jobId: job2.id,
      fileUrl: "/eval/fixtures/case_21_nearmiss_crimson_red.png",
      mimeType: "image/png",
      fileSizeBytes: "151240",
      metadata: { width: 1080, height: 1080 },
    })
    .returning();

  await appendLedgerEvent({
    jobId: job2.id,
    eventType: "DELIVERABLE_SUBMITTED",
    previousState: "FUNDED",
    newState: "SUBMITTED",
    actor: "FREELANCER",
    payload: { submissionId: sub2.id },
  });

  await db.insert(verdicts).values({
    submissionId: sub2.id,
    overallPassed: false,
    confidence: "0.8116",
    reasoning: "Palette CIEDE2000 distance (11.69) is within borderline review zone. Routing to human reviewer.",
    perCriteriaResults: [
      { id: "HC_PNG", name: "PNG Container", passed: true, confidence: 1.0 },
      { id: "HC_DIM", name: "1080x1080 Resolution", passed: true, confidence: 1.0 },
      { id: "rubric_palette", name: "Brand Palette (CIEDE2000 = 11.69)", passed: true, confidence: 0.8116 },
      { id: "rubric_text", name: "Contains SUMMER SALE", passed: true, confidence: 1.0 },
    ],
  });

  await appendLedgerEvent({
    jobId: job2.id,
    eventType: "VERIFICATION_COMPLETED",
    previousState: "SUBMITTED",
    newState: "VERIFIED",
    actor: "SYSTEM",
    payload: { confidence: 0.8116, decision: "NEEDS_HUMAN", reason: "Borderline CIEDE2000 palette penalty" },
  });

  // Verify ledgers
  const audit1 = await verifyLedgerChain(job1.id);
  const audit2 = await verifyLedgerChain(job2.id);

  console.log(`\nSeed completed:`);
  console.log(`- Job 1 (${job1.title}): Status=${job1.status}, Ledger Verified=${audit1.valid} (${audit1.totalEventsVerified} events)`);
  console.log(`- Job 2 (${job2.title}): Status=${job2.status}, Ledger Verified=${audit2.valid} (${audit2.totalEventsVerified} events)`);
  console.log("\nReady for presentation or judge evaluation.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

