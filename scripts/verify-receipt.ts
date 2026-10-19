/**
 * Verification CLI utility for ProofPay receipts.
 * Usage: npx tsx scripts/verify-receipt.ts [receiptPath]
 */
import { verifyReceiptOffline, verifyReceiptEventsOffline } from "./verify-receipt-offline";

export { verifyReceiptOffline, verifyReceiptEventsOffline };

if (process.argv[1]?.endsWith("verify-receipt.ts")) {
  const target = process.argv[2] || "eval/results/single-real-run.json";
  try {
    const res = verifyReceiptOffline(target);
    if (!res || !res.valid) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}
