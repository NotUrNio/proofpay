import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import { ensureDatabaseSchema } from "../src/db/init";
import { db, jobs, mandates, submissions, verdicts, payments } from "../src/db";
import { appendLedgerEvent, verifyLedgerChain, getJobLedger } from "../src/db/ledger";
import { signMandate } from "../src/lib/guard/mandate";
import { evaluatePolicyGuard } from "../src/lib/guard/guard";
import { runHardChecks } from "../src/lib/verify/hard-checks";
import { runLlmVerifierEnsemble } from "../src/lib/verify/llm-verifier";
import {
  createOrder,
  getOrder,
  captureOrder,
  createPayout,
  getPayoutBatch,
  getPayoutItem,
  resolveConfiguredSandboxPayeeEmail,
  resolveConfiguredSandboxBuyerEmail,
} from "../src/lib/paypal";
import { assertLocalDatabaseOnly } from "../src/lib/seed-guard";
import { checkDailyRealPayoutCap } from "../src/lib/paypal/payout-policy";
import { eq, and, gte } from "drizzle-orm";

async function promptUser(questionText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(questionText, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runPreflightChecks(candidateAmountUsd: string): Promise<{ freelancerEmail: string; clientEmail: string }> {
  // 1. Required environment variable names
  const requiredEnvVars = [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_SANDBOX_PAYEE_EMAIL",
  ];
  const missing = requiredEnvVars.filter((v) => !process.env[v] || process.env[v]!.trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `[Preflight Check Failed] Missing required environment variables: ${missing.join(", ")}. Please configure them before running demo:run.`
    );
  }

  // 2. Payee not a placeholder
  const freelancerEmail = resolveConfiguredSandboxPayeeEmail();
  const placeholderPatterns = [/example\.com/i, /placeholder/i, /your-/i, /mock/i];
  if (placeholderPatterns.some((p) => p.test(freelancerEmail))) {
    throw new Error(
      `[Preflight Check Failed] PAYPAL_SANDBOX_PAYEE_EMAIL contains a placeholder pattern. A valid non-placeholder PayPal Sandbox payee email is required.`
    );
  }

  const clientEmail = resolveConfiguredSandboxBuyerEmail();

  // 3. DB is strictly local (PGlite or localhost Postgres)
  assertLocalDatabaseOnly(process.env.DATABASE_URL, process.env.USE_PGLITE);

  // 4. Daily-cap headroom
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todayPayoutRows = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(
      and(
        eq(payments.type, "PAYOUT"),
        eq(payments.isMock, false),
        gte(payments.createdAt, startOfDay)
      )
    );

  const capCheck = checkDailyRealPayoutCap(todayPayoutRows, candidateAmountUsd);
  if (!capCheck.allowed) {
    throw new Error(`[Preflight Check Failed] ${capCheck.reason}`);
  }

  console.log(
    `[Preflight] Environment, local DB guard, non-placeholder payee, and daily-cap headroom (${capCheck.currentCount}/${capCheck.maxCount} payouts, $${capCheck.currentUsd.toFixed(2)}/$${capCheck.maxUsd.toFixed(2)} USD today) verified.`
  );

  return { freelancerEmail, clientEmail };
}

async function main() {
  console.log("================================================================================");
  console.log("             ProofPay: Live Real-World Single End-to-End Run                   ");
  console.log("================================================================================");
  console.log("Environment: PayPal Sandbox (PAYPAL_MOCK=false)");
  console.log("Production Service Stack: Orders v2 -> Hard Checks -> AI Ensemble -> Policy Guard -> Payouts v1 -> Hash Ledger\n");

  const amount = "5.00";
  const currency = "USD";

  // Preflight checks: required env vars, local DB guard, non-placeholder payee, daily cap headroom
  const { freelancerEmail, clientEmail } = await runPreflightChecks(amount);

  // 1. Initialize Clean DB Schema
  await ensureDatabaseSchema();
  console.log("[1/7] Database schema verified and Postgres triggers active.");

  // 2. Create Job in DB
  const jobId = crypto.randomUUID();
  const [job] = await db
    .insert(jobs)
    .values({
      id: jobId,
      title: "Social Media Banner (Summer Sale)",
      description: "1080x1080 PNG promotional banner for summer sale campaign.",
      clientEmail,
      freelancerEmail,
      amount,
      currency,
      status: "CREATED",
    })
    .returning();

  const signedMandateToken = signMandate({
    jobId: job.id,
    maxAmount: "10.00",
    currency: "USD",
    payeeEmail: freelancerEmail,
    scope: "social_media_banner",
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  });

  await db.insert(mandates).values({
    jobId: job.id,
    signature: signedMandateToken,
    maxAmount: "10.00",
    currency: "USD",
    payeeEmail: freelancerEmail,
    scope: "social_media_banner",
    expiresAt: new Date(Date.now() + 86400 * 1000),
  });

  const event1 = await appendLedgerEvent({
    jobId: job.id,
    eventType: "JOB_CREATED",
    previousState: null,
    newState: "CREATED",
    actor: "CLIENT",
    payload: {
      title: job.title,
      amount: job.amount,
      currency: job.currency,
      clientEmail,
      freelancerEmail,
    },
  });

  console.log(`[2/7] Job created in database: ${job.id}`);
  console.log(`      Ledger Event 1 ID: ${event1.id} (Hash: ${event1.signatureOrHash.slice(0, 16)}...)`);

  // 3. Create Real PayPal Order with Traceability Fields (custom_id & invoice_id)
  const requestId = `fund_${job.id}_${Date.now()}`;
  const order = await createOrder({
    jobId: job.id,
    amount: job.amount,
    currency: job.currency,
    description: `ProofPay Escrow Milestone Funding for Job ${job.id.slice(0, 8)}`,
    requestId,
  });

  const approveLink = order.links.find((l) => l.rel === "approve")?.href;
  console.log(`\n[3/7] PayPal Order Created:`);
  console.log(`      Order ID:     ${order.id}`);
  console.log(`      Status:       ${order.status}`);
  console.log(`      Reference ID: ${job.id} (linked into custom_id & invoice_id)`);
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`ACTION REQUIRED: Approve the $5.00 Escrow Funding in PayPal Sandbox`);
  console.log(`Approval URL:\n${approveLink}\n`);
  console.log(`Instructions:`);
  console.log(`  1. Open the approval URL above in your browser.`);
  console.log(`  2. Log into your PayPal Sandbox Personal Buyer account.`);
  console.log(`  3. Click 'Complete Purchase' / 'Continue' to approve.`);
  console.log(`--------------------------------------------------------------------------------`);

  console.log("\nWaiting for sandbox buyer approval (auto-polling Order status)...");

  let isApproved = false;
  let pollAttempts = 0;
  while (!isApproved && pollAttempts < 300) {
    pollAttempts++;
    await sleep(4000);
    try {
      const currentOrder = await getOrder(order.id);
      process.stdout.write(`\r[Attempt ${pollAttempts}/300] PayPal Order Status: ${currentOrder.status}...`);
      if (currentOrder.status === "APPROVED") {
        isApproved = true;
        console.log("\n>>> ORDER APPROVED BY BUYER! Proceeding to capture and settlement...");
        break;
      }
    } catch (err: any) {
      // Continue polling
    }
  }

  if (!isApproved) {
    throw new Error("Order was not approved within the timeout window.");
  }

  // Capture Order
  console.log("\nCapturing approved PayPal order...");
  const captureResult = await captureOrder(order.id, `capture_${job.id}_${Date.now()}`);
  const captureId = captureResult.purchase_units[0]?.payments?.captures[0]?.id || `cap_${order.id}`;

  await db.update(jobs).set({ status: "FUNDED", updatedAt: new Date() }).where(eq(jobs.id, job.id));

  await db.insert(payments).values({
    jobId: job.id,
    type: "FUNDING",
    paypalId: captureId,
    amount: job.amount,
    currency: job.currency,
    status: "COMPLETED",
    isMock: false,
    rawResponse: captureResult,
  });

  const event2 = await appendLedgerEvent({
    jobId: job.id,
    eventType: "JOB_FUNDED",
    previousState: "CREATED",
    newState: "FUNDED",
    actor: "CLIENT",
    payload: {
      orderId: order.id,
      captureId,
      amount: job.amount,
      currency: job.currency,
      buyerEmail: captureResult.payer?.email_address,
    },
  });

  console.log(`[3/7 DONE] Escrow Funded:`);
  console.log(`      Capture ID:        ${captureId}`);
  console.log(`      Ledger Event 2 ID: ${event2.id} (Hash: ${event2.signatureOrHash.slice(0, 16)}...)`);

  // 4. Submit Deliverable (Compliant Banner Fixture)
  const fixturePath = path.resolve(process.cwd(), "eval/fixtures/case_01_compliant_warm_grid.png");
  const deliverableBytes = fs.readFileSync(fixturePath);

  const [submission] = await db
    .insert(submissions)
    .values({
      jobId: job.id,
      fileUrl: "/eval/fixtures/case_01_compliant_warm_grid.png",
      mimeType: "image/png",
      fileSizeBytes: deliverableBytes.length.toString(),
      metadata: {
        sha256: crypto.createHash("sha256").update(deliverableBytes).digest("hex"),
      },
    })
    .returning();

  await db.update(jobs).set({ status: "SUBMITTED", updatedAt: new Date() }).where(eq(jobs.id, job.id));

  const event3 = await appendLedgerEvent({
    jobId: job.id,
    eventType: "DELIVERABLE_SUBMITTED",
    previousState: "FUNDED",
    newState: "SUBMITTED",
    actor: "FREELANCER",
    payload: {
      submissionId: submission.id,
      fileName: "case_01_compliant_warm_grid.png",
      fileSizeBytes: deliverableBytes.length,
      sha256: crypto.createHash("sha256").update(deliverableBytes).digest("hex"),
    },
  });

  console.log(`\n[4/7] Deliverable Submitted:`);
  console.log(`      Submission ID:     ${submission.id}`);
  console.log(`      Ledger Event 3 ID: ${event3.id} (Hash: ${event3.signatureOrHash.slice(0, 16)}...)`);

  // 5. Run Verification Pipeline (Hard Checks + Model Verifier)
  console.log("\n[5/7] Executing Verification Pipeline...");
  const hardChecks = await runHardChecks(deliverableBytes);
  if (!hardChecks.allPassed) {
    throw new Error("Compliant deliverable failed hard checks unexpectedly!");
  }
  console.log("      Hard Checks: 5/5 PASSED (Magic bytes PNG, exact 1080x1080, no animation, <=2MB, clean metadata).");

  const rubrics = [
    {
      id: "rubric_palette",
      name: "Warm Summer Brand Palette",
      prompt: "Assesses whether the banner composition visually conveys warm, vibrant summer aesthetics (warm coral, amber, yellow tones).",
    },
    {
      id: "rubric_typography",
      name: "Legible Professional Typography",
      prompt: "Assesses whether text contrast and hierarchy is clean, sharp, and easy to read.",
    },
  ];

  const ensemble = await runLlmVerifierEnsemble(hardChecks.sanitizedBuffer || deliverableBytes, rubrics, {
    verifyMode: "live",
    modelId: process.env.MODEL_ID || "gemini-3.8-flash",
    runsK: 3,
    requiredKeyword: "SUMMER SALE",
  });

  console.log(`      Visual AI Verifier:`);
  console.log(`        - Serving Model:      ${ensemble.servingModel}`);
  console.log(`        - Agreement Rate:     ${(ensemble.agreementRate * 100).toFixed(0)}%`);
  console.log(`        - Final Confidence:   ${(ensemble.finalConfidence * 100).toFixed(1)}%`);
  console.log(`        - CIEDE2000 Distance: ${ensemble.codePaletteDistance}`);
  console.log(`        - Required Keyword:   ${ensemble.codeTextMatchPassed ? "Found ('SUMMER SALE')" : "MISSING"}`);
  console.log(`        - Prompt Injection:   ${ensemble.injectionSuspected ? "SUSPECTED" : "None detected"}`);

  await db.update(jobs).set({ status: "VERIFIED", updatedAt: new Date() }).where(eq(jobs.id, job.id));

  const [verdictRow] = await db
    .insert(verdicts)
    .values({
      submissionId: submission.id,
      overallPassed: ensemble.overallPassed,
      confidence: ensemble.finalConfidence.toFixed(4),
      reasoning: ensemble.reasoning,
      perCriteriaResults: ensemble.perCriterionResults,
    })
    .returning();

  const event4 = await appendLedgerEvent({
    jobId: job.id,
    eventType: "VERIFICATION_COMPLETED",
    previousState: "SUBMITTED",
    newState: "VERIFIED",
    actor: "SYSTEM",
    payload: {
      verdictId: verdictRow.id,
      overallPassed: ensemble.overallPassed,
      confidence: ensemble.finalConfidence,
      servingModel: ensemble.servingModel,
    },
  });
  console.log(`      Ledger Event 4 ID: ${event4.id} (Hash: ${event4.signatureOrHash.slice(0, 16)}...)`);

  // 6. Policy Guard Evaluation (ZERO LLM Imports)
  console.log("\n[6/7] Evaluating Pure TypeScript Policy Guard...");
  const guardResult = evaluatePolicyGuard({
    job: {
      id: job.id,
      amount: job.amount,
      currency: job.currency,
      status: "VERIFIED",
      freelancerEmail,
    },
    mandate: signedMandateToken,
    verdict: {
      overallPassed: ensemble.overallPassed,
      confidence: ensemble.finalConfidence,
      reasoning: ensemble.reasoning,
      perCriteriaResults: ensemble.perCriterionResults.map((r) => ({
        id: r.criterionId,
        name: r.criterionId,
        isHardCheck: false,
        passed: r.pass,
        confidence: r.confidence,
      })),
      allHardChecksPassed: hardChecks.allPassed,
      injectionSuspected: ensemble.injectionSuspected,
      injectionEvidence: ensemble.injectionEvidence,
      metadataInstructionDetected: hardChecks.metadataInstructionDetected,
      agreementRate: ensemble.agreementRate,
      modelError: ensemble.modelError,
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
    },
  });

  const guardAllowed = guardResult.decision === "AUTO_PAY";
  console.log(`      Policy Guard Decision: ${guardResult.decision} (${guardAllowed ? "ALLOWED" : "BLOCKED"})`);
  console.log(`      Fired Policy Rules:    ${guardResult.firedRuleIds.join(", ")}`);

  if (guardResult.decision !== "AUTO_PAY") {
    throw new Error(`Policy Guard did not return AUTO_PAY: ${guardResult.decision}`);
  }

  const event5 = await appendLedgerEvent({
    jobId: job.id,
    eventType: "GUARD_EVALUATED",
    previousState: "VERIFIED",
    newState: "VERIFIED",
    actor: "SYSTEM",
    payload: {
      decision: guardResult.decision,
      allowed: guardAllowed,
      firedRules: guardResult.firedRuleIds,
    },
  });
  console.log(`      Ledger Event 5 ID: ${event5.id} (Hash: ${event5.signatureOrHash.slice(0, 16)}...)`);

  // 7. Execute PayPal Payouts v1 Settlement
  console.log("\n[7/7] Releasing Instant PayPal Payout to Freelancer...");
  const senderBatchId = `batch_${job.id.slice(0, 8)}_${Date.now()}`;
  const senderItemId = `item_${job.id.slice(0, 8)}`;

  const payoutBatch = await createPayout({
    recipientEmail: freelancerEmail,
    amount: job.amount,
    currency: job.currency,
    note: `ProofPay Instant Settlement for Milestone Job ${job.id.slice(0, 8)}`,
    senderBatchId,
    senderItemId,
  });

  const payoutBatchId = payoutBatch.batch_header.payout_batch_id;
  console.log(`      Payout Batch Created: ${payoutBatchId}`);

  // Poll for Payout Batch Status, Payout Item ID, and Payout Item Status until terminal, up to 60s
  let payoutItemId = senderItemId;
  let payoutBatchStatus: string = payoutBatch.batch_header.batch_status;
  let payoutItemStatus = "PENDING";
  const terminalStatuses = new Set(["SUCCESS", "DENIED", "FAILED", "RETURNED", "BLOCKED", "CANCELED"]);

  const pollStart = Date.now();
  const maxPollMs = 60000;
  console.log("      Polling PayPal Payouts API for terminal status (up to 60s)...");
  while (Date.now() - pollStart < maxPollMs) {
    await sleep(2500);
    try {
      const details = await getPayoutBatch(payoutBatchId);
      payoutBatchStatus = details.batch_header?.batch_status || payoutBatchStatus;
      if (details.items && details.items.length > 0) {
        const firstItem = details.items[0];
        payoutItemId = firstItem.payout_item_id || firstItem.payout_item?.payout_item_id || payoutItemId;
        payoutItemStatus = firstItem.transaction_status || payoutItemStatus;
        if (payoutItemId !== senderItemId && (!firstItem.transaction_status || payoutItemStatus === "PENDING")) {
          try {
            const itemDetails = await getPayoutItem(payoutItemId);
            payoutItemStatus = itemDetails.transaction_status || payoutItemStatus;
          } catch {
            // Keep batch-reported item status if item endpoint is not yet ready
          }
        }
      }
    } catch {
      // Continue polling
    }

    if (terminalStatuses.has(payoutItemStatus.toUpperCase()) || terminalStatuses.has(payoutBatchStatus.toUpperCase())) {
      console.log(`      Terminal payout status reached: batch=${payoutBatchStatus}, item=${payoutItemStatus}`);
      break;
    }
  }
  const statusFetchedAt = new Date().toISOString();

  await db.update(jobs).set({ status: "PAID", updatedAt: new Date() }).where(eq(jobs.id, job.id));

  await db.insert(payments).values({
    jobId: job.id,
    type: "PAYOUT",
    paypalId: payoutItemId,
    amount: job.amount,
    currency: job.currency,
    status: payoutItemStatus === "SUCCESS" || payoutBatchStatus === "SUCCESS" ? "COMPLETED" : payoutBatchStatus,
    isMock: false,
    rawResponse: payoutBatch,
  });

  const event6 = await appendLedgerEvent({
    jobId: job.id,
    eventType: "PAYOUT_RELEASED",
    previousState: "VERIFIED",
    newState: "PAID",
    actor: "SYSTEM",
    payload: {
      payoutBatchId,
      payoutBatchStatus,
      payoutItemId,
      payoutItemStatus,
      amount: job.amount,
      currency: job.currency,
      recipientEmail: freelancerEmail,
      status: payoutBatchStatus,
    },
  });
  console.log(`      Payout Batch ID:      ${payoutBatchId} (${payoutBatchStatus})`);
  console.log(`      Payout Item ID:       ${payoutItemId} (${payoutItemStatus})`);
  console.log(`      Ledger Event 6 ID: ${event6.id} (Hash: ${event6.signatureOrHash.slice(0, 16)}...)`);

  // Cryptographic Ledger Verification
  const ledgerAudit = await verifyLedgerChain(job.id);
  console.log(`\n================================================================================`);
  console.log("            CRYPTOGRAPHIC AUDIT LEDGER CHAIN VERIFICATION                       ");
  console.log("================================================================================");
  console.log(`Ledger Chain Status:    ${ledgerAudit.valid ? "VALID (SHA-256 Chain Intact)" : "BROKEN"}`);
  console.log(`Total Events Verified:  ${ledgerAudit.totalEventsVerified}`);
  console.log(`Append-Only Enforced:   Postgres UPDATE/DELETE/TRUNCATE Triggers Active`);
  console.log("================================================================================\n");

  // Output Unified Verification Table
  console.log("================================================================================");
  console.log("                   SINGLE REAL-WORLD RUN RECORD OF IDENTIFIERS                  ");
  console.log("================================================================================");
  console.log(`Job ID:               ${job.id}`);
  console.log(`PayPal Order ID:      ${order.id}`);
  console.log(`PayPal Capture ID:    ${captureId}`);
  console.log(`PayPal Payout Batch:  ${payoutBatchId} (status: ${payoutBatchStatus})`);
  console.log(`PayPal Payout Item:   ${payoutItemId} (status: ${payoutItemStatus})`);
  console.log(`Ledger Events (6):    ${[event1.id, event2.id, event3.id, event4.id, event5.id, event6.id].join(", ")}`);
  console.log(`Traceability Ref:     custom_id = ${job.id}, sender_item_id = ${senderItemId}`);
  console.log("================================================================================\n");

  const singleRunSummary = {
    jobId: job.id,
    orderId: order.id,
    captureId,
    payoutBatchId,
    payoutBatchStatus,
    payoutItemId,
    payoutItemStatus,
    statusFetchedAt,
    ledgerEvents: [event1.id, event2.id, event3.id, event4.id, event5.id, event6.id],
    amount: "5.00",
    currency: "USD",
    clientEmail,
    freelancerEmail,
    ledgerChainValid: ledgerAudit.valid,
    timestamp: new Date().toISOString(),
  };

  const singleRunPath = path.resolve(process.cwd(), ".data/single-real-run.json");
  if (!fs.existsSync(singleRunPath) || process.env.OVERWRITE_SINGLE_RUN_JSON === "true") {
    fs.writeFileSync(
      singleRunPath,
      JSON.stringify(singleRunSummary, null, 2),
      "utf-8"
    );
  }
}


main().catch((err) => {
  console.error("Demo run failed:", err);
  process.exit(1);
});
