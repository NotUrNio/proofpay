import * as dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { signMandate } from "../src/lib/guard/mandate";
import {
  assertLocalDatabaseOnly,
  acquireSeedLock,
  withTimeoutAndSlowNotice,
  installBoundedFetchTimeout,
  type SeedLockHandle,
} from "../src/lib/seed-guard";

async function seed() {
  console.log("================================================================================");
  console.log("            ProofPay: Demo Seed & Instant Re-hydration Script                   ");
  console.log("================================================================================");

  // 1. Refuse to seed against any hosted / remote DATABASE_URL
  const dbTarget = assertLocalDatabaseOnly(process.env.DATABASE_URL, process.env.USE_PGLITE);

  // 2. Acquire single-instance seed lock & verify no active server holds .data/pglite
  const lock: SeedLockHandle = acquireSeedLock({
    checkPgliteHolder: dbTarget.mode === "pglite",
  });

  // 3. Enforce explicit timeout and >10s progress warning on any network call
  const restoreFetch = installBoundedFetchTimeout(10_000, 10_000);

  let closeDb: (() => Promise<void>) | null = null;

  try {
    const dbMod = await withTimeoutAndSlowNotice(
      "Opening local database client",
      async () => import("../src/db")
    );
    const { db, jobs, mandates, submissions, verdicts, payments, policies, closeDbClient } = dbMod;
    closeDb = closeDbClient;

    const { ensureDatabaseSchema } = await import("../src/db/init");
    const { appendLedgerEvent, verifyLedgerChain } = await import("../src/db/ledger");

    await withTimeoutAndSlowNotice(
      "Database schema verification and trigger initialization",
      async () => {
        await ensureDatabaseSchema();
      }
    );
    console.log(`Database schema verified (${dbTarget.mode}) and Postgres triggers initialized.`);

    const clientEmail = "alice@proofpay.io";
    const freelancerEmail = "priya@proofpay.io";

    // Demo Job 1: PAID (Full autonomous happy path)
    const job1 = await withTimeoutAndSlowNotice(
      "Seeding Demo Job 1 (PAID happy path)",
      async () => {
        const job1Id = crypto.randomUUID();
        const [insertedJob1] = await db
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
          jobId: insertedJob1.id,
          maxAmount: "10.00",
          currency: "USD",
          payeeEmail: freelancerEmail,
          scope: "social_media_banner",
          expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        });

        await db.insert(mandates).values({
          jobId: insertedJob1.id,
          signature: mandate1,
          maxAmount: "10.00",
          currency: "USD",
          payeeEmail: freelancerEmail,
          scope: "social_media_banner",
          expiresAt: new Date(Date.now() + 86400 * 1000),
        });

        await appendLedgerEvent({
          jobId: insertedJob1.id,
          eventType: "JOB_CREATED",
          previousState: null,
          newState: "CREATED",
          actor: "CLIENT",
          payload: { title: insertedJob1.title, amount: insertedJob1.amount, currency: insertedJob1.currency },
        });

        await appendLedgerEvent({
          jobId: insertedJob1.id,
          eventType: "JOB_FUNDED [SIMULATED]",
          previousState: "CREATED",
          newState: "FUNDED",
          actor: "CLIENT",
          isMock: true,
          payload: { orderId: "SIMULATED_ORD_DEMO_1", captureId: "SIMULATED_CAP_DEMO_1", amount: "5.00", currency: "USD" },
        });

        const [sub1] = await db
          .insert(submissions)
          .values({
            jobId: insertedJob1.id,
            fileUrl: "/eval/fixtures/case_01_compliant_warm_grid.png",
            mimeType: "image/png",
            fileSizeBytes: "145820",
            metadata: { width: 1080, height: 1080 },
          })
          .returning();

        await appendLedgerEvent({
          jobId: insertedJob1.id,
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
          jobId: insertedJob1.id,
          eventType: "VERIFICATION_COMPLETED",
          previousState: "SUBMITTED",
          newState: "VERIFIED",
          actor: "SYSTEM",
          payload: { confidence: 0.985, decision: "AUTO_PAY" },
        });

        await appendLedgerEvent({
          jobId: insertedJob1.id,
          eventType: "PAYOUT_RELEASED [SIMULATED]",
          previousState: "VERIFIED",
          newState: "PAID",
          actor: "SYSTEM",
          isMock: true,
          payload: { payoutBatchId: "SIMULATED_BATCH_DEMO_1", payoutItemId: "SIMULATED_ITEM_DEMO_1", amount: "5.00", currency: "USD" },
        });

        return insertedJob1;
      }
    );

    // Demo Job 2: NEEDS_HUMAN (Borderline Palette in Review Queue)
    const job2 = await withTimeoutAndSlowNotice(
      "Seeding Demo Job 2 (NEEDS_HUMAN review queue)",
      async () => {
        const job2Id = crypto.randomUUID();
        const [insertedJob2] = await db
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
          jobId: insertedJob2.id,
          maxAmount: "15.00",
          currency: "USD",
          payeeEmail: freelancerEmail,
          scope: "social_media_banner",
          expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        });

        await db.insert(mandates).values({
          jobId: insertedJob2.id,
          signature: mandate2,
          maxAmount: "15.00",
          currency: "USD",
          payeeEmail: freelancerEmail,
          scope: "social_media_banner",
          expiresAt: new Date(Date.now() + 86400 * 1000),
        });

        await appendLedgerEvent({
          jobId: insertedJob2.id,
          eventType: "JOB_CREATED",
          previousState: null,
          newState: "CREATED",
          actor: "CLIENT",
          payload: { title: insertedJob2.title, amount: insertedJob2.amount },
        });

        await appendLedgerEvent({
          jobId: insertedJob2.id,
          eventType: "JOB_FUNDED [SIMULATED]",
          previousState: "CREATED",
          newState: "FUNDED",
          actor: "CLIENT",
          isMock: true,
          payload: { amount: "7.50" },
        });

        const [sub2] = await db
          .insert(submissions)
          .values({
            jobId: insertedJob2.id,
            fileUrl: "/eval/fixtures/case_21_nearmiss_crimson_red.png",
            mimeType: "image/png",
            fileSizeBytes: "151240",
            metadata: { width: 1080, height: 1080 },
          })
          .returning();

        await appendLedgerEvent({
          jobId: insertedJob2.id,
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
          jobId: insertedJob2.id,
          eventType: "VERIFICATION_COMPLETED",
          previousState: "SUBMITTED",
          newState: "VERIFIED",
          actor: "SYSTEM",
          payload: { confidence: 0.8116, decision: "NEEDS_HUMAN", reason: "Borderline CIEDE2000 palette penalty" },
        });

        return insertedJob2;
      }
    );

    // Demo Job 3: FUNDED (Escrow locked, awaiting Priya submission)
    const job3 = await withTimeoutAndSlowNotice(
      "Seeding Demo Job 3 (FUNDED awaiting submission)",
      async () => {
        const job3Id = crypto.randomUUID();
        const [insertedJob3] = await db
          .insert(jobs)
          .values({
            id: job3Id,
            title: "Hero Brand Illustration (Awaiting Submission)",
            description: "1080x1080 PNG vector illustration with brand primary blue (#0070BA). Escrow securely funded via PayPal.",
            clientEmail,
            freelancerEmail,
            amount: "15.00",
            currency: "USD",
            status: "FUNDED",
          })
          .returning();

        const mandate3 = signMandate({
          jobId: insertedJob3.id,
          maxAmount: "25.00",
          currency: "USD",
          payeeEmail: freelancerEmail,
          scope: "brand_illustration",
          expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        });

        await db.insert(mandates).values({
          jobId: insertedJob3.id,
          signature: mandate3,
          maxAmount: "25.00",
          currency: "USD",
          payeeEmail: freelancerEmail,
          scope: "brand_illustration",
          expiresAt: new Date(Date.now() + 86400 * 1000),
        });

        await appendLedgerEvent({
          jobId: insertedJob3.id,
          eventType: "JOB_CREATED",
          previousState: null,
          newState: "CREATED",
          actor: "CLIENT",
          payload: { title: insertedJob3.title, amount: insertedJob3.amount },
        });

        await appendLedgerEvent({
          jobId: insertedJob3.id,
          eventType: "JOB_FUNDED [SIMULATED]",
          previousState: "CREATED",
          newState: "FUNDED",
          actor: "CLIENT",
          isMock: true,
          payload: { amount: "15.00", captureId: "SIMULATED_CAP_DEMO_ESCROW", mode: "SIMULATED_DEMO_ESCROW" },
        });

        await db.insert(payments).values({
          jobId: insertedJob3.id,
          type: "FUNDING",
          paypalId: "SIMULATED_CAP_DEMO_ESCROW",
          amount: "15.00",
          currency: "USD",
          status: "COMPLETED",
          isMock: true,
        });

        return insertedJob3;
      }
    );

    // Seed real policy records in DB if fewer than 3 exist
    await withTimeoutAndSlowNotice("Seeding default policy versions", async () => {
      const existingPolicies = await db.select().from(policies);
      if (existingPolicies.length < 3) {
        await db.insert(policies).values([
          {
            name: "Policy v1.0.0 (Genesis Strict)",
            maxDailyPayoutAmount: "500.00",
            maxJobPayoutAmount: "250.00",
            minConfidenceThreshold: "0.9000",
            requireHumanReviewIfAmbiguous: true,
            isActive: false,
            createdAt: new Date(Date.now() - 3 * 86400 * 1000),
          },
          {
            name: "Policy v1.1.0 (High Volume Pilot)",
            maxDailyPayoutAmount: "2500.00",
            maxJobPayoutAmount: "1000.00",
            minConfidenceThreshold: "0.8000",
            requireHumanReviewIfAmbiguous: true,
            isActive: false,
            createdAt: new Date(Date.now() - 1 * 86400 * 1000),
          },
          {
            name: "Policy v1.2.0 (Balanced Active)",
            maxDailyPayoutAmount: "1000.00",
            maxJobPayoutAmount: "500.00",
            minConfidenceThreshold: "0.8500",
            requireHumanReviewIfAmbiguous: true,
            isActive: true,
            createdAt: new Date(),
          },
        ]);
      }
    });

    // Verify ledgers
    const [audit1, audit2, audit3] = await withTimeoutAndSlowNotice(
      "Verifying SHA-256 ledger hash chains",
      async () =>
        Promise.all([
          verifyLedgerChain(job1.id),
          verifyLedgerChain(job2.id),
          verifyLedgerChain(job3.id),
        ])
    );

    console.log(`\nSeed completed:`);
    console.log(`- Job 1 (${job1.title}): Status=${job1.status}, ID=${job1.id}, Ledger Verified=${audit1.valid}`);
    console.log(`- Job 2 (${job2.title}): Status=${job2.status}, ID=${job2.id}, Ledger Verified=${audit2.valid}`);
    console.log(`- Job 3 (${job3.title}): Status=${job3.status}, ID=${job3.id}, Ledger Verified=${audit3.valid}`);
    console.log("\nReady for presentation or judge evaluation.");
  } finally {
    restoreFetch();
    if (closeDb) {
      await closeDb();
    }
    lock.release();
  }
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
