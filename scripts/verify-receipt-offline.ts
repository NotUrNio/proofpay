import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  canonicalJsonStringify,
  legacy6ac5a18CanonicalJsonStringify,
  legacyB36cfbfJsonStringify,
} from "../src/db/ledger";

export interface ReceiptEventObject {
  id: string;
  eventType: string;
  previousState?: string | null;
  newState: string;
  actor: string;
  isMock?: boolean;
  payload: Record<string, unknown>;
  prevHash?: string;
  hash?: string;
  signatureOrHash?: string;
  sequenceNumber?: number;
}

export interface VerifyReceiptResult {
  valid: boolean;
  totalEventsChecked: number;
  totalEventsVerified: number;
  brokenRowIndex?: number;
  brokenRowId?: string;
  reason?: string;
  eventsSummary: Array<{
    index: number;
    id: string;
    eventType: string;
    passed: boolean;
    expectedHash: string;
    actualHash: string;
  }>;
}

/**
 * Pure offline receipt verifier that works from the receipt file alone with NO database.
 * Recomputes each SHA-256 hash from stored payloads and compares the chain.
 */
export function verifyReceiptEventsOffline(events: ReceiptEventObject[]): VerifyReceiptResult {
  const eventsSummary: VerifyReceiptResult["eventsSummary"] = [];
  let currentHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    const recordedHash = evt.signatureOrHash || evt.hash || "";

    // Candidate 1: Current canonical serializer
    const canonicalPayload = canonicalJsonStringify(evt.payload);
    const hashContent = `${currentHash}|${evt.id ? evt.id : ""}|${evt.eventType}|${evt.newState}|${evt.actor}|${Boolean(evt.isMock)}|${canonicalPayload}`;
    // Also try with jobId if present
    const hashContentWithJob = (evt as any).jobId
      ? `${currentHash}|${(evt as any).jobId}|${evt.eventType}|${evt.newState}|${evt.actor}|${Boolean(evt.isMock)}|${canonicalPayload}`
      : hashContent;

    const candidate1 = crypto.createHash("sha256").update(hashContentWithJob).digest("hex");

    // Candidate 2: Legacy 6ac5a18 serializer
    const legacy6acPayload = legacy6ac5a18CanonicalJsonStringify(evt.payload);
    const candidate2 = crypto
      .createHash("sha256")
      .update(
        (evt as any).jobId
          ? `${currentHash}|${(evt as any).jobId}|${evt.eventType}|${evt.newState}|${evt.actor}|${Boolean(evt.isMock)}|${legacy6acPayload}`
          : `${currentHash}|${evt.id}|${evt.eventType}|${evt.newState}|${evt.actor}|${Boolean(evt.isMock)}|${legacy6acPayload}`
      )
      .digest("hex");

    // Candidate 3: Legacy b36cfbf serializer (JSON.stringify)
    const legacyB36Payload = legacyB36cfbfJsonStringify(evt.payload);
    const candidate3 = crypto
      .createHash("sha256")
      .update(
        (evt as any).jobId
          ? `${currentHash}|${(evt as any).jobId}|${evt.eventType}|${evt.newState}|${evt.actor}|${Boolean(evt.isMock)}|${legacyB36Payload}`
          : `${currentHash}|${evt.id}|${evt.eventType}|${evt.newState}|${evt.actor}|${Boolean(evt.isMock)}|${legacyB36Payload}`
      )
      .digest("hex");

    const matched =
      recordedHash === candidate1 ||
      recordedHash === candidate2 ||
      recordedHash === candidate3;

    const expectedHash = matched ? recordedHash : candidate1;

    eventsSummary.push({
      index: i,
      id: evt.id,
      eventType: evt.eventType,
      passed: matched,
      expectedHash,
      actualHash: recordedHash,
    });

    if (!matched) {
      return {
        valid: false,
        totalEventsChecked: events.length,
        totalEventsVerified: i,
        brokenRowIndex: i,
        brokenRowId: evt.id,
        reason: `Cryptographic hash chain broken at event #${i + 1} (${evt.eventType}, ID: ${evt.id}). Recorded hash does not match computed payload hash.`,
        eventsSummary,
      };
    }

    currentHash = recordedHash;
  }

  return {
    valid: true,
    totalEventsChecked: events.length,
    totalEventsVerified: events.length,
    eventsSummary,
  };
}

export function verifyReceiptOffline(receiptPath: string): VerifyReceiptResult {
  const resolvedPath = path.resolve(process.cwd(), receiptPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[Error] Receipt file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const receipt = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  console.log("================================================================================");
  console.log(`ProofPay Offline Receipt Verification: ${path.basename(resolvedPath)}`);
  console.log("================================================================================");
  console.log(`Job ID:              ${receipt.jobId || "N/A"}`);
  console.log(`Recorded Valid Flag: ${receipt.ledgerChainValid}`);
  console.log(`Recorded Timestamp:  ${receipt.timestamp || "N/A"}`);

  // Check if receipt contains embedded event payload objects
  const rawEvents = receipt.events || receipt.ledgerEventObjects || receipt.ledgerEvents;

  if (!rawEvents || !Array.isArray(rawEvents) || rawEvents.length === 0) {
    console.error("\n[FAIL] No events found in receipt file.");
    process.exit(1);
  }

  const isStringArray = typeof rawEvents[0] === "string";
  if (isStringArray) {
    console.log(`Recorded Event IDs:  ${rawEvents.length} UUID references`);
    console.error("\n================================================================================");
    console.error("VERIFICATION FAILED: RECEIPT CONTAINS ONLY UUID STRINGS, NO EMBEDDED EVENT OBJECTS");
    console.error("================================================================================");
    console.error(
      `Receipt "${path.basename(resolvedPath)}" stores an array of ${rawEvents.length} event UUIDs without embedded event payloads/hashes.`
    );
    console.error(
      "Offline cryptographic hash verification cannot be performed from this file alone because event payloads are not stored inside it."
    );
    console.error("To verify an offline receipt file, the receipt must contain full event objects with payloads and recorded hashes.");
    console.error("================================================================================");
    process.exit(1);
  }

  // We have full event objects
  console.log(`Verifying ${rawEvents.length} embedded event objects from file alone (NO DB)...`);
  const result = verifyReceiptEventsOffline(rawEvents);

  console.log("\nPer-Event Verification Breakdown:");
  for (const item of result.eventsSummary) {
    const status = item.passed ? "✅ PASS" : "❌ FAIL";
    console.log(
      `  [${status}] Event #${item.index + 1} | ${item.eventType.padEnd(24)} | ID: ${item.id} | Hash: ${item.actualHash.slice(0, 16)}...`
    );
    if (!item.passed) {
      console.log(`         Expected Hash: ${item.expectedHash}`);
      console.log(`         Actual Hash:   ${item.actualHash}`);
    }
  }

  console.log("\n================================================================================");
  if (result.valid) {
    console.log(`FINAL RESULT: CHAIN VERIFIED (${result.totalEventsVerified}/${result.totalEventsChecked} events intact)`);
    console.log("================================================================================");
    return result;
  } else {
    console.error(`FINAL RESULT: CHAIN BROKEN at event #${(result.brokenRowIndex ?? 0) + 1} (ID: ${result.brokenRowId})`);
    console.error(`Reason: ${result.reason}`);
    console.log("================================================================================");
    process.exit(1);
  }
}

// Allow CLI execution
if (process.argv[1]?.endsWith("verify-receipt-offline.ts") || process.argv[1]?.endsWith("verify-receipt.ts")) {
  const target = process.argv[2] || "eval/results/single-real-run.json";
  try {
    const res = verifyReceiptOffline(target);
    if (!res.valid) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err: any) {
    console.error("Verification error:", err.message);
    process.exit(1);
  }
}
