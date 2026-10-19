import { describe, it, expect, beforeAll } from "vitest";
import { ensureDatabaseSchema } from "../src/db/init";
import { db, ledgerEvents, jobs } from "../src/db";
import {
  appendLedgerEvent,
  canonicalJsonStringify,
  verifyLedgerChain,
  verifyLedgerEventsOffline,
} from "../src/db/ledger";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";

describe("Database-Enforced Append-Only Ledger & Hash Chain Verification", () => {
  const testJobId = crypto.randomUUID();

  beforeAll(async () => {
    await ensureDatabaseSchema();
    await db.insert(jobs).values({
      id: testJobId,
      title: "Ledger Test Job",
      description: "Testing append-only triggers",
      clientEmail: "client@test.com",
      freelancerEmail: "freelancer@test.com",
      amount: "10.00",
      currency: "USD",
      status: "CREATED",
    });
  });

  it("should successfully append events and verify cryptographic hash chain", async () => {
    const event1 = await appendLedgerEvent({
      jobId: testJobId,
      eventType: "TEST_INITIAL_EVENT",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: { test: 1 },
    });

    const event2 = await appendLedgerEvent({
      jobId: testJobId,
      eventType: "TEST_SECOND_EVENT",
      previousState: "CREATED",
      newState: "FUNDED",
      actor: "CLIENT",
      payload: { test: 2 },
    });

    expect(event1.signatureOrHash).toBeDefined();
    expect(event2.signatureOrHash).toBeDefined();

    const verification = await verifyLedgerChain(testJobId);
    expect(verification.valid).toBe(true);
    expect(verification.totalEventsVerified).toBe(2);
  });

  it("should REJECT database UPDATE operations via Postgres trigger", async () => {
    const inserted = await appendLedgerEvent({
      jobId: testJobId,
      eventType: "TEST_FOR_MUTATION",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: { safe: true },
    });

    await expect(
      db.execute(sql`UPDATE ledger_events SET new_state = 'TAMPERED' WHERE id = ${inserted.id}`)
    ).rejects.toThrow(/APPEND-ONLY VIOLATION/);
  });

  it("should REJECT database DELETE operations via Postgres trigger", async () => {
    const inserted = await appendLedgerEvent({
      jobId: testJobId,
      eventType: "TEST_FOR_DELETE",
      previousState: null,
      newState: "CREATED",
      actor: "CLIENT",
      payload: { safe: true },
    });

    await expect(
      db.execute(sql`DELETE FROM ledger_events WHERE id = ${inserted.id}`)
    ).rejects.toThrow(/APPEND-ONLY VIOLATION/);
  });

  it("should detect hash chain breakage when a row is tampered with", async () => {
    const mockEvents = [
      {
        id: "evt-1",
        jobId: "job-tamper",
        eventType: "JOB_CREATED",
        newState: "CREATED",
        actor: "CLIENT",
        isMock: false,
        payload: { amount: "50.00" },
        signatureOrHash: "hash1",
      },
      {
        id: "evt-2",
        jobId: "job-tamper",
        eventType: "JOB_FUNDED",
        newState: "FUNDED",
        actor: "CLIENT",
        isMock: false,
        payload: { amount: "50.00" },
        signatureOrHash: "corrupted_or_tampered_hash",
      },
    ];

    // Compute expected first hash
    const payload1 = JSON.stringify(mockEvents[0].payload);
    const genesis = "0000000000000000000000000000000000000000000000000000000000000000";
    const expectedHash1 = crypto
      .createHash("sha256")
      .update(`${genesis}|job-tamper|JOB_CREATED|CREATED|CLIENT|false|${payload1}`)
      .digest("hex");
    mockEvents[0].signatureOrHash = expectedHash1;

    // Simulate verification loop
    let currentHash = genesis;
    let failedAt: number | null = null;
    for (let i = 0; i < mockEvents.length; i++) {
      const e = mockEvents[i];
      const p = JSON.stringify(e.payload);
      const expected = crypto.createHash("sha256").update(`${currentHash}|${e.jobId}|${e.eventType}|${e.newState}|${e.actor}|${e.isMock}|${p}`).digest("hex");
      if (e.signatureOrHash !== expected) {
        failedAt = i;
        break;
      }
      currentHash = e.signatureOrHash;
    }

    expect(failedAt).toBe(1); // Detected tampering at second event
  });

  it("regression: real-run 6-event fixture reproduces pre-canonicalization JSONB breakage and verifies cleanly with canonicalJsonStringify across JSONB round-trip", async () => {
    const receiptPath = path.resolve(process.cwd(), "eval/results/single-real-run.json");
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));
    expect(receipt.ledgerEvents).toHaveLength(6);

    // Postgres JSONB sorts object keys by key length first, then ASCII order
    const simulatePostgresJsonbReorder = (obj: Record<string, unknown>): Record<string, unknown> => {
      const parsed = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
      const keys = Object.keys(parsed).sort((a, b) => a.length - b.length || a.localeCompare(b));
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = parsed[k];
      return out;
    };

    const realRunEventSpecs = [
      {
        id: receipt.ledgerEvents[0],
        eventType: "JOB_CREATED",
        previousState: null,
        newState: "CREATED",
        actor: "CLIENT" as const,
        payload: {
          title: "Social Media Banner (Summer Sale)",
          amount: receipt.amount,
          currency: receipt.currency,
          clientEmail: receipt.clientEmail,
          freelancerEmail: receipt.freelancerEmail,
        },
      },
      {
        id: receipt.ledgerEvents[1],
        eventType: "JOB_FUNDED",
        previousState: "CREATED",
        newState: "FUNDED",
        actor: "CLIENT" as const,
        payload: {
          orderId: receipt.orderId,
          captureId: receipt.captureId,
          amount: receipt.amount,
          currency: receipt.currency,
          buyerEmail: receipt.freelancerEmail,
        },
      },
      {
        id: receipt.ledgerEvents[2],
        eventType: "DELIVERABLE_SUBMITTED",
        previousState: "FUNDED",
        newState: "SUBMITTED",
        actor: "FREELANCER" as const,
        payload: {
          submissionId: "787e4767-f527-4227-af61-c042eea10ca1",
          fileName: "case_01_compliant_warm_grid.png",
          fileSizeBytes: 15883,
          sha256: "e5fa44f2b31c1fb553b6021e7360d07d5d91ff5e3cc7c555",
        },
      },
      {
        id: receipt.ledgerEvents[3],
        eventType: "VERIFICATION_COMPLETED",
        previousState: "SUBMITTED",
        newState: "VERIFIED",
        actor: "SYSTEM" as const,
        payload: {
          verdictId: "00000000-0000-4000-8000-000000000004",
          overallPassed: true,
          confidence: 0.97,
          servingModel: "gemini-3.8-flash",
        },
      },
      {
        id: receipt.ledgerEvents[4],
        eventType: "GUARD_EVALUATED",
        previousState: "VERIFIED",
        newState: "VERIFIED",
        actor: "SYSTEM" as const,
        payload: {
          decision: "AUTO_PAY",
          allowed: undefined, // Exercises undefined property omission across JSONB round-trip
          firedRules: [],
        },
      },
      {
        id: receipt.ledgerEvents[5],
        eventType: "PAYOUT_RELEASED",
        previousState: "VERIFIED",
        newState: "PAID",
        actor: "SYSTEM" as const,
        payload: {
          payoutBatchId: receipt.payoutBatchId,
          payoutItemId: receipt.payoutItemId,
          amount: receipt.amount,
          currency: receipt.currency,
          recipientEmail: receipt.freelancerEmail,
          status: "SUCCESS",
        },
      },
    ];

    // 1. Reproduce historic pre-6ac5a18 breakage:
    // Hashes computed at insert with raw JSON.stringify(params.payload), then read back from JSONB
    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const legacyEventsAfterJsonb = realRunEventSpecs.map((spec) => {
      const insertPayloadStr = JSON.stringify(spec.payload);
      const sig = crypto
        .createHash("sha256")
        .update(`${prevHash}|${receipt.jobId}|${spec.eventType}|${spec.newState}|${spec.actor}|false|${insertPayloadStr}`)
        .digest("hex");
      prevHash = sig;
      return {
        id: spec.id,
        jobId: receipt.jobId,
        eventType: spec.eventType,
        newState: spec.newState,
        actor: spec.actor,
        isMock: false,
        payload: simulatePostgresJsonbReorder(spec.payload),
        signatureOrHash: sig,
      };
    });

    // Under legacy JSON.stringify verifier: Event #1 (index 0) passes because key lengths (5,6,8,11,15)
    // match insertion order, and Event #2 (index 1, JOB_FUNDED) breaks due to JSONB key-length reordering.
    const legacyVerify = verifyLedgerEventsOffline(legacyEventsAfterJsonb, (o) => JSON.stringify(o));
    expect(legacyVerify.valid).toBe(false);
    expect(legacyVerify.totalEventsVerified).toBe(1);
    expect(legacyVerify.brokenRowIndex).toBe(1);
    expect(legacyVerify.brokenRowId).toBe("41cb32ff-341e-46f3-8e52-5227fed91bfe");

    // Under current canonicalJsonStringify verifier on legacy hashes: breaks at Event #1 (index 0)
    const canonicalOnLegacy = verifyLedgerEventsOffline(legacyEventsAfterJsonb, canonicalJsonStringify);
    expect(canonicalOnLegacy.valid).toBe(false);
    expect(canonicalOnLegacy.totalEventsVerified).toBe(0);
    expect(canonicalOnLegacy.brokenRowIndex).toBe(0);
    expect(canonicalOnLegacy.brokenRowId).toBe("3675f0d2-d70b-4e55-9ae1-b7411336dcce");

    // 2. Verify that appending all 6 real-run events through the DB with canonicalJsonStringify
    // (including JSONB key reordering and undefined fields like allowed: undefined) verifies 6/6:
    const fixtureJobId = crypto.randomUUID();
    await db.insert(jobs).values({
      id: fixtureJobId,
      title: "Social Media Banner (Summer Sale)",
      description: "Regression fixture for real-run 6-event ledger chain",
      clientEmail: receipt.clientEmail,
      freelancerEmail: receipt.freelancerEmail,
      amount: receipt.amount,
      currency: receipt.currency,
      status: "CREATED",
    });

    for (const spec of realRunEventSpecs) {
      await appendLedgerEvent({
        jobId: fixtureJobId,
        eventType: spec.eventType,
        previousState: spec.previousState,
        newState: spec.newState,
        actor: spec.actor,
        isMock: false,
        payload: spec.payload,
      });
    }

    const dbAudit = await verifyLedgerChain(fixtureJobId);
    expect(dbAudit.valid).toBe(true);
    expect(dbAudit.totalEventsVerified).toBe(6);
  });
});

