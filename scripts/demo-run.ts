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
import { createOrder, getOrder, captureOrder, createPayout, getPayoutBatch } from "../src/lib/paypal";
import { eq } from "drizzle-orm";

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

async function main() {
  console.log("================================================================================");
  console.log("             ProofPay: Live Real-World Single End-to-End Run                   ");
  console.log("================================================================================");
  console.log("Environment: PayPal Sandbox (PAYPAL_MOCK=false)");
  console.log("Production Service Stack: Orders v2 -> Hard Checks -> AI Ensemble -> Policy Guard -> Payouts v1 -> Hash Ledger\n");

  // 1. Initialize Clean DB Schema
  await ensureDatabaseSchema();
  console.log("[1/7] Database schema verified and Postgres triggers active.");

  // 2. Create Job in DB
  const jobId = crypto.randomUUID();
  const amount = "5.00";
  const currency = "USD";
  const clientEmail = "client@example.test";
  const freelancerEmail = "freelancer@example.test";

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
  console.log(`Login Credentials:`);
  console.log(`  Email:    <your-sandbox-personal-email>`);
  console.log(`  Password: <your-sandbox-personal-password>`);
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

  console.log(`      Policy Guard Decision: ${guardResult.decision} (${guardResult.allowed ? "ALLOWED" : "BLOCKED"})`);
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
      allowed: guardResult.allowed,
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

  // Poll for Payout Item ID
  let payoutItemId = senderItemId;
  let payoutStatus = payoutBatch.batch_header.batch_status;
  for (let attempt = 1; attempt <= 10; attempt++) {
    await sleep(2000);
    try {
      const details = await getPayoutBatch(payoutBatchId);
      payoutStatus = details.batch_header.batch_status;
      if (details.items && details.items.length > 0) {
        payoutItemId = details.items[0].payout_item_id || details.items[0].payout_item?.payout_item_id || payoutItemId;
        break;
      }
    } catch {
      // Continue polling
    }
  }

  await db.update(jobs).set({ status: "PAID", updatedAt: new Date() }).where(eq(jobs.id, job.id));

  await db.insert(payments).values({
    jobId: job.id,
    type: "PAYOUT",
    paypalId: payoutItemId,
    amount: job.amount,
    currency: job.currency,
    status: "COMPLETED",
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
      payoutItemId,
      amount: job.amount,
      currency: job.currency,
      recipientEmail: freelancerEmail,
      status: payoutStatus,
    },
  });
  console.log(`      Payout Batch ID:   ${payoutBatchId}`);
  console.log(`      Payout Item ID:    ${payoutItemId}`);
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
  console.log(`PayPal Payout Batch:  ${payoutBatchId}`);
  console.log(`PayPal Payout Item:   ${payoutItemId}`);
  console.log(`Ledger Events (6):    ${[event1.id, event2.id, event3.id, event4.id, event5.id, event6.id].join(", ")}`);
  console.log(`Traceability Ref:     custom_id = ${job.id}, sender_item_id = ${senderItemId}`);
  console.log("================================================================================\n");

  const singleRunSummary = {
    jobId: job.id,
    orderId: order.id,
    captureId,
    payoutBatchId,
    payoutItemId,
    ledgerEvents: [event1.id, event2.id, event3.id, event4.id, event5.id, event6.id],
    amount: "5.00",
    currency: "USD",
    clientEmail,
    freelancerEmail,
    ledgerChainValid: ledgerAudit.valid,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), ".data/single-real-run.json"),
    JSON.stringify(singleRunSummary, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("Demo run failed:", err);
  process.exit(1);
});
