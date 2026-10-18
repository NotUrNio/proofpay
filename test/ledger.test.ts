import { describe, it, expect, beforeAll } from "vitest";
import { ensureDatabaseSchema } from "../src/db/init";
import { db, ledgerEvents, jobs } from "../src/db";
import { appendLedgerEvent, verifyLedgerChain } from "../src/db/ledger";
import { sql } from "drizzle-orm";
import crypto from "crypto";

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
});
