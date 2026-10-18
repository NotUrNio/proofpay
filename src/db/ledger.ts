import { db } from "./index";
import { ledgerEvents } from "./schema";
import { asc, desc, eq } from "drizzle-orm";
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
 * Deterministic canonical JSON serialization to guarantee identical SHA-256 hashes
 * regardless of key insertion order or PostgreSQL JSONB column reordering.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    sortedKeys
      .map((key) => JSON.stringify(key) + ":" + canonicalJsonStringify((obj as Record<string, unknown>)[key]))
      .join(",") +
    "}"
  );
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
      .orderBy(desc(ledgerEvents.sequenceNumber))
      .limit(1);

    if (lastEvent.length > 0 && lastEvent[0].signatureOrHash) {
      previousHash = lastEvent[0].signatureOrHash;
    }
  } catch (err) {
    // If DB isn't ready or during isolated unit testing, fall back safely
    console.warn("[Ledger] Could not query last event hash, using genesis hash:", err);
  }

  // Cryptographic integrity hash over current event + prior hash
  const payloadString = canonicalJsonStringify(params.payload);
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
    .orderBy(asc(ledgerEvents.sequenceNumber));
}

export interface LedgerVerificationResult {
  valid: boolean;
  totalEventsVerified: number;
  brokenRowId?: string;
  brokenRowIndex?: number;
  expectedHash?: string;
  actualHash?: string | null;
  reason?: string;
}

/**
 * Validates the cryptographic SHA-256 integrity hash chain across audit events.
 * Walks events in chronological order per-job and verifies tamper-evidence.
 */
export async function verifyLedgerChain(jobId?: string): Promise<LedgerVerificationResult> {
  if (jobId) {
    const events = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.jobId, jobId))
      .orderBy(asc(ledgerEvents.sequenceNumber));

    let currentHash = "0000000000000000000000000000000000000000000000000000000000000000";

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      const payloadString = canonicalJsonStringify(evt.payload);
      const hashContent = `${currentHash}|${evt.jobId}|${evt.eventType}|${evt.newState}|${evt.actor}|${evt.isMock}|${payloadString}`;
      const expectedHash = crypto.createHash("sha256").update(hashContent).digest("hex");

      if (evt.signatureOrHash !== expectedHash) {
        return {
          valid: false,
          totalEventsVerified: i,
          brokenRowId: evt.id,
          brokenRowIndex: i,
          expectedHash,
          actualHash: evt.signatureOrHash,
          reason: `Cryptographic hash chain broken at event #${i + 1} (${evt.eventType}, ID: ${evt.id})`,
        };
      }

      currentHash = evt.signatureOrHash;
    }

    return {
      valid: true,
      totalEventsVerified: events.length,
    };
  }

  // Global verification across all distinct jobs
  const distinctJobs = await db
    .selectDistinct({ jobId: ledgerEvents.jobId })
    .from(ledgerEvents);

  let totalEvents = 0;
  for (const row of distinctJobs) {
    const res = await verifyLedgerChain(row.jobId);
    if (!res.valid) {
      return res;
    }
    totalEvents += res.totalEventsVerified;
  }

  return {
    valid: true,
    totalEventsVerified: totalEvents,
  };
}

