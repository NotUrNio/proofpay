import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { ledgerEvents } from "../src/db/schema";
import { verifyLedgerEventsOffline } from "../src/db/ledger";
import { inArray, asc } from "drizzle-orm";

export async function verifyReceiptOffline(receiptPath: string) {
  const resolvedPath = path.resolve(process.cwd(), receiptPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Receipt file not found: ${resolvedPath}`);
  }

  const receipt = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  console.log("================================================================================");
  console.log(`ProofPay Offline Receipt Verification: ${path.basename(resolvedPath)}`);
  console.log("================================================================================");
  console.log(`Job ID:              ${receipt.jobId}`);
  console.log(`Receipt Valid Flag:  ${receipt.ledgerChainValid}`);
  console.log(`Recorded Timestamp:  ${receipt.timestamp}`);
  console.log(`Recorded Event IDs:  ${receipt.ledgerEvents?.length ?? 0} events`);

  if (!receipt.ledgerEvents || !Array.isArray(receipt.ledgerEvents) || receipt.ledgerEvents.length === 0) {
    throw new Error("No ledgerEvents array found in receipt.");
  }

  // Query events from local DB by UUIDs
  const dbRows = await db
    .select()
    .from(ledgerEvents)
    .where(inArray(ledgerEvents.id, receipt.ledgerEvents))
    .orderBy(asc(ledgerEvents.sequenceNumber));

  if (dbRows.length === 0) {
    console.warn("\n[Notice] No matching ledger_events rows found in local database for these IDs.");
    console.log("This occurs when running against a fresh database where the real run events were not seeded.");
    return {
      valid: false,
      reason: "Events not present in local database",
      receiptMatchesRecorded: receipt.ledgerChainValid === false,
    };
  }

  const result = verifyLedgerEventsOffline(dbRows);
  console.log(`\nVerification Result:`);
  console.log(`  Valid:             ${result.valid}`);
  console.log(`  Events Verified:   ${result.totalEventsVerified} / ${dbRows.length}`);
  if (!result.valid) {
    console.log(`  Broken At Event:   #${(result.brokenRowIndex ?? 0) + 1} (Row ID: ${result.brokenRowId})`);
    console.log(`  Reason:            ${result.reason}`);
    console.log(`  Expected Hash:     ${result.expectedHash}`);
    console.log(`  Actual Hash:       ${result.actualHash}`);
  }

  return {
    valid: result.valid,
    result,
    receiptMatchesRecorded: receipt.ledgerChainValid === result.valid,
  };
}

// Allow CLI execution: npx tsx scripts/verify-receipt-offline.ts [receiptPath]
if (process.argv[1]?.endsWith("verify-receipt-offline.ts")) {
  const target = process.argv[2] || "eval/results/single-real-run.json";
  verifyReceiptOffline(target)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
