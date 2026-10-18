import { db } from "./index";
import { ledgerEvents } from "./schema";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";

export interface AppendLedgerParams {
  jobId: string;
  eventType: string; // e.g. 'JOB_CREATED', 'JOB_FUNDED', 'WORK_SUBMITTED', 'VERIFICATION_COMPLETED', 'GUARD_EVALUATED', 'PAYOUT_INITIATED', 'PAYOUT_CONFIRMED'
  previousState?: string | null;
  newState: string;
  payload: Record<string, unknown>;
  isMock?: boolean;
  actor: "CLIENT" | "FREELANCER" | "VERIFIER" | "GUARD" | "PAYPAL_API" | "PAYPAL_WEBHOOK" | "ADMIN" | "SYSTEM";
}

/**
 * Append an immutable event to the audit ledger.
 * HARD RULE: Only INSERT operations are allowed.
 * We compute a cryptographic SHA-256 hash chaining to the last event for tamper-evident provenance.
 */
export async function appendLedgerEvent(params: AppendLedgerParams) {
  const isMock = params.isMock ?? (process.env.PAYPAL_MOCK === "true");

  // Fetch the latest event for this job to compute hash chain
  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000";
  try {
    const lastEvent = await db
      .select({ signatureOrHash: ledgerEvents.signatureOrHash })
      .from(ledgerEvents)
      .where(eq(ledgerEvents.jobId, params.jobId))
      .orderBy(desc(ledgerEvents.createdAt))
      .limit(1);

    if (lastEvent.length > 0 && lastEvent[0].signatureOrHash) {
      previousHash = lastEvent[0].signatureOrHash;
    }
  } catch (err) {
    // If DB isn't ready or during isolated unit testing, fall back safely
    console.warn("[Ledger] Could not query last event hash, using genesis hash:", err);
  }

  // Cryptographic integrity hash over current event + prior hash
  const payloadString = JSON.stringify(params.payload);
  const hashContent = `${previousHash}|${params.jobId}|${params.eventType}|${params.newState}|${params.actor}|${isMock}|${payloadString}`;
  const signatureOrHash = crypto.createHash("sha256").update(hashContent).digest("hex");

  const [inserted] = await db
    .insert(ledgerEvents)
    .values({
      jobId: params.jobId,
      eventType: params.eventType,
      previousState: params.previousState ?? null,
      newState: params.newState,
      payload: params.payload,
      isMock,
      actor: params.actor,
      signatureOrHash,
    })
    .returning();

  return inserted;
}

/**
 * Read-only retrieval of a job's complete audit trail, in chronological order.
 */
export async function getJobLedger(jobId: string) {
  return db
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.jobId, jobId))
    .orderBy(ledgerEvents.createdAt);
}
