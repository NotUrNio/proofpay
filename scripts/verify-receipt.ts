/**
 * Verification CLI utility for ProofPay receipts.
 * Usage: npx tsx scripts/verify-receipt.ts [receiptPath]
 */
import { verifyReceiptOffline } from "./verify-receipt-offline";

export { verifyReceiptOffline };

if (process.argv[1]?.endsWith("verify-receipt.ts")) {
  const target = process.argv[2] || "eval/results/single-real-run.json";
  verifyReceiptOffline(target)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
