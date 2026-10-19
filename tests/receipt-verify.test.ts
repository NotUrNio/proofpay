import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../src/db";
import { jobs, ledgerEvents } from "../src/db/schema";
import { verifyReceiptOffline } from "../scripts/verify-receipt-offline";
import { canonicalJsonStringify, verifyLedgerEventsOffline } from "../src/db/ledger";

describe("A4: Receipt Verification Logic on Committed vs Tampered Receipt", () => {
  const receiptPath = path.resolve(process.cwd(), "eval/results/single-real-run.json");
  const tamperedReceiptPath = path.resolve(process.cwd(), "eval/results/single-real-run.tampered-test.json");
  let receiptData: any;

  beforeAll(async () => {
    receiptData = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));

    // Seed the parent job and the 6 ledger events for the committed receipt into the test DB
    await db.insert(jobs).values({
      id: receiptData.jobId,
      title: "Social Media Banner (Summer Sale)",
      description: "Real-run receipt verification fixture",
      clientEmail: receiptData.clientEmail,
      freelancerEmail: receiptData.freelancerEmail,
      amount: receiptData.amount,
      currency: receiptData.currency,
      status: "PAID",
    }).onConflictDoNothing();

    // Reconstruct the 6 canonical events with intact SHA-256 chain
    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const specs = [
      {
        id: receiptData.ledgerEvents[0],
        eventType: "JOB_CREATED",
        newState: "CREATED",
        actor: "CLIENT",
        payload: {
          title: "Social Media Banner (Summer Sale)",
          amount: receiptData.amount,
          currency: receiptData.currency,
          clientEmail: receiptData.clientEmail,
          freelancerEmail: receiptData.freelancerEmail,
        },
      },
      {
        id: receiptData.ledgerEvents[1],
        eventType: "JOB_FUNDED",
        newState: "FUNDED",
        actor: "CLIENT",
        payload: {
          orderId: receiptData.orderId,
          captureId: receiptData.captureId,
          amount: receiptData.amount,
          currency: receiptData.currency,
          buyerEmail: receiptData.freelancerEmail,
        },
      },
      {
        id: receiptData.ledgerEvents[2],
        eventType: "DELIVERABLE_SUBMITTED",
        newState: "SUBMITTED",
        actor: "FREELANCER",
        payload: {
          submissionId: "787e4767-f527-4227-af61-c042eea10ca1",
          fileName: "case_01_compliant_warm_grid.png",
          fileSizeBytes: 15883,
          sha256: "e5fa44f2b31c1fb553b6021e7360d07d5d91ff5e3cc7c555",
        },
      },
      {
        id: receiptData.ledgerEvents[3],
        eventType: "VERIFICATION_COMPLETED",
        newState: "VERIFIED",
        actor: "SYSTEM",
        payload: {
          overallPassed: true,
          confidence: 0.95,
          servingModel: "gemini-3.8-flash",
        },
      },
      {
        id: receiptData.ledgerEvents[4],
        eventType: "GUARD_EVALUATED",
        newState: "VERIFIED",
        actor: "SYSTEM",
        payload: {
          decision: "AUTO_PAY",
          allowed: true,
          firedRules: ["MANDATE_SIGNATURE_VALID", "PAYEE_MATCH", "DAILY_VELOCITY_CAP_OK"],
        },
      },
      {
        id: receiptData.ledgerEvents[5],
        eventType: "PAYOUT_RELEASED",
        newState: "PAID",
        actor: "SYSTEM",
        payload: {
          payoutBatchId: receiptData.payoutBatchId,
          payoutItemId: receiptData.payoutItemId,
          amount: receiptData.amount,
          currency: receiptData.currency,
          recipientEmail: receiptData.freelancerEmail,
          status: "SUCCESS",
        },
      },
    ];

    for (let seq = 0; seq < specs.length; seq++) {
      const s = specs[seq];
      const payloadStr = canonicalJsonStringify(s.payload);
      const hash = crypto
        .createHash("sha256")
        .update(`${prevHash}|${receiptData.jobId}|${s.eventType}|${s.newState}|${s.actor}|false|${payloadStr}`)
        .digest("hex");

      await db.insert(ledgerEvents).values({
        id: s.id,
        jobId: receiptData.jobId,
        eventType: s.eventType,
        previousState: seq === 0 ? null : specs[seq - 1].newState,
        newState: s.newState,
        actor: s.actor,
        isMock: false,
        payload: s.payload,
        signatureOrHash: hash,
        sequenceNumber: seq + 1,
      }).onConflictDoNothing();

      prevHash = hash;
    }
  });

  afterAll(() => {
    if (fs.existsSync(tamperedReceiptPath)) {
      fs.unlinkSync(tamperedReceiptPath);
    }
  });

  it("must PASS when verifying the committed receipt against valid seeded events", async () => {
    const res = await verifyReceiptOffline(receiptPath);
    expect(res.valid).toBe(true);
    expect(res.result).toBeDefined();
    expect(res.result!.totalEventsVerified).toBe(6);
    expect(res.result!.brokenRowId).toBeUndefined();
  });

  it("must FAIL when verifying a tampered copy of the receipt (tampered event ID or unrecorded event)", async () => {
    const tamperedReceipt = {
      ...receiptData,
      ledgerEvents: [
        receiptData.ledgerEvents[0],
        "00000000-0000-0000-0000-000000000000", // tampered missing ID
        ...receiptData.ledgerEvents.slice(2),
      ],
    };
    fs.writeFileSync(tamperedReceiptPath, JSON.stringify(tamperedReceipt, null, 2), "utf8");

    const res = await verifyReceiptOffline(tamperedReceiptPath);
    // Should fail because 1 event is missing from DB or chain cannot verify 6 events
    expect(res.result?.totalEventsVerified ?? 0).toBeLessThan(6);
  });

  it("must FAIL when an event payload in the chain is tampered with (amount changed from 5.00 to 500.00)", () => {
    const events = [
      {
        id: "evt-1",
        jobId: "test-job",
        eventType: "JOB_CREATED",
        newState: "CREATED",
        actor: "CLIENT",
        isMock: false,
        payload: { amount: "5.00", currency: "USD" },
        signatureOrHash: "",
      },
      {
        id: "evt-2",
        jobId: "test-job",
        eventType: "PAYOUT_RELEASED",
        newState: "PAID",
        actor: "SYSTEM",
        isMock: false,
        payload: { amount: "5.00", currency: "USD" },
        signatureOrHash: "",
      },
    ];

    // Compute legitimate hashes
    let prev = "0000000000000000000000000000000000000000000000000000000000000000";
    for (const e of events) {
      const pStr = canonicalJsonStringify(e.payload);
      e.signatureOrHash = crypto.createHash("sha256").update(`${prev}|${e.jobId}|${e.eventType}|${e.newState}|${e.actor}|false|${pStr}`).digest("hex");
      prev = e.signatureOrHash;
    }

    // Tamper with payload of evt-2 without updating signatureOrHash
    const tamperedEvents = [
      events[0],
      {
        ...events[1],
        payload: { amount: "500.00", currency: "USD" }, // TAMPERED!
      },
    ];

    const result = verifyLedgerEventsOffline(tamperedEvents);
    expect(result.valid).toBe(false);
    expect(result.brokenRowId).toBe("evt-2");
    expect(result.totalEventsVerified).toBe(1);
    expect(result.reason).toContain("Cryptographic hash chain broken at event #2");
  });
});

