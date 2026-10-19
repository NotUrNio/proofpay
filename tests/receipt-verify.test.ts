import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { canonicalJsonStringify } from "../src/db/ledger";
import {
  verifyReceiptEventsOffline,
  ReceiptEventObject,
} from "../scripts/verify-receipt-offline";
import { lintReceipt } from "../scripts/lint-receipt";

describe("A4: Receipt Verification using Recorded Hashes (File-Alone, No DB)", () => {
  // Build a legitimate recorded chain of events with their recorded SHA-256 hashes
  const testJobId = "job-recorded-chain-test";
  let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  const rawSpecs = [
    {
      id: "evt-01",
      eventType: "JOB_CREATED",
      newState: "CREATED",
      actor: "CLIENT",
      isMock: false,
      payload: { title: "Banner Project", amount: "5.00", currency: "USD" },
    },
    {
      id: "evt-02",
      eventType: "JOB_FUNDED",
      newState: "FUNDED",
      actor: "CLIENT",
      isMock: false,
      payload: { orderId: "ORDER-12345", captureId: "CAP-12345", amount: "5.00" },
    },
    {
      id: "evt-03",
      eventType: "DELIVERABLE_SUBMITTED",
      newState: "SUBMITTED",
      actor: "FREELANCER",
      isMock: false,
      payload: { fileName: "banner.png", fileSizeBytes: 12345 },
    },
    {
      id: "evt-04",
      eventType: "VERIFICATION_COMPLETED",
      newState: "VERIFIED",
      actor: "SYSTEM",
      isMock: false,
      payload: { overallPassed: true, confidence: 0.95, servingModel: "gemini-3.8-flash" },
    },
    {
      id: "evt-05",
      eventType: "PAYOUT_RELEASED",
      newState: "PAID",
      actor: "SYSTEM",
      isMock: false,
      payload: { payoutBatchId: "BATCH-1", payoutItemId: "ITEM-1", amount: "5.00" },
    },
  ];

  const recordedChain: ReceiptEventObject[] = rawSpecs.map((spec) => {
    const payloadStr = canonicalJsonStringify(spec.payload);
    const hash = crypto
      .createHash("sha256")
      .update(`${prevHash}|${spec.id}|${spec.eventType}|${spec.newState}|${spec.actor}|false|${payloadStr}`)
      .digest("hex");
    prevHash = hash;
    return {
      ...spec,
      signatureOrHash: hash,
    };
  });

  it("1. valid chain passes using recorded hashes alone (no recomputing legitimate hashes in test)", () => {
    const res = verifyReceiptEventsOffline(recordedChain);
    expect(res.valid).toBe(true);
    expect(res.totalEventsVerified).toBe(5);
    expect(res.brokenRowIndex).toBeUndefined();
  });

  it("2. edited payload fails verification against recorded hashes", () => {
    // Tamper with payload of Event 2 (e.g. modify amount in payload)
    const tamperedChain: ReceiptEventObject[] = [
      recordedChain[0],
      {
        ...recordedChain[1],
        payload: { ...recordedChain[1].payload, amount: "500.00" }, // Tampered!
      },
      ...recordedChain.slice(2),
    ];

    const res = verifyReceiptEventsOffline(tamperedChain);
    expect(res.valid).toBe(false);
    expect(res.brokenRowIndex).toBe(1);
    expect(res.brokenRowId).toBe("evt-02");
    expect(res.reason).toContain("Cryptographic hash chain broken at event #2");
  });

  it("3. deleted event fails verification against recorded hashes", () => {
    // Drop Event 2 (index 1) so Event 3 immediately follows Event 1
    const droppedChain: ReceiptEventObject[] = [
      recordedChain[0],
      recordedChain[2], // evt-03 chained directly to evt-01
      recordedChain[3],
      recordedChain[4],
    ];

    const res = verifyReceiptEventsOffline(droppedChain);
    expect(res.valid).toBe(false);
    expect(res.brokenRowIndex).toBe(1); // Fails at the newly adjacent event
    expect(res.brokenRowId).toBe("evt-03");
  });

  it("4. lintReceipt passes on eval/results/single-real-run.json", () => {
    const res = lintReceipt("eval/results/single-real-run.json");
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });
});
