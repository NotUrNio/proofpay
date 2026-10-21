/**
 * CLI utility to restore bundled demo jobs to their canonical states
 * without deleting append-only ledger rows.
 * Usage: npx tsx scripts/reset-demo-state.ts
 */
import { resetBundledDemoState } from "../src/lib/bootstrap";

async function main() {
  console.log("================================================================================");
  console.log("             ProofPay: Idempotent Demo State Restoration                        ");
  console.log("================================================================================");
  console.log("Restoring bundled jobs (PAID, NEEDS_HUMAN, FUNDED) to canonical presentation states...");

  const { changedRows } = await resetBundledDemoState();

  if (changedRows.length > 0) {
    console.log(`\nSuccess: Restored ${changedRows.length} item(s):`);
    for (const row of changedRows) {
      console.log(`  - ${row}`);
    }
  } else {
    console.log("\nAll bundled demo jobs are already in their canonical states. (0 changes needed)");
  }
  console.log("Postgres append-only audit ledger preserved with zero row deletions.");
}

if (process.argv[1]?.endsWith("reset-demo-state.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
