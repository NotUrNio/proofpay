import * as dotenv from "dotenv";
dotenv.config();

import { verifyLedgerChain } from "../src/db/ledger";
import { ensureDatabaseSchema } from "../src/db/init";

async function main() {
  console.log("=== ProofPay Audit Ledger Integrity Verification ===");
  await ensureDatabaseSchema();

  const jobIdArg = process.argv[2];
  console.log(jobIdArg ? `Verifying hash chain for Job ID: ${jobIdArg}` : "Verifying global audit ledger hash chain...");

  const result = await verifyLedgerChain(jobIdArg);

  if (result.valid) {
    console.log(`\n[PASS] Cryptographic integrity intact! All ${result.totalEventsVerified} ledger events verified.`);
    console.log("No tampering or broken hash chain links detected.");
  } else {
    console.error(`\n[FAIL] TAMPERING DETECTED! ${result.reason}`);
    console.error(`Broken Row ID:     ${result.brokenRowId}`);
    console.error(`Expected SHA-256:  ${result.expectedHash}`);
    console.error(`Actual Value:      ${result.actualHash}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[FAIL] Ledger verification script error:", err);
  process.exit(1);
});
