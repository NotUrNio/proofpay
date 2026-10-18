/**
 * Resilient Retry & Workflow Orchestration Module for ProofPay
 * Designed for distributed deployments (e.g., Render Web Services & Background Workers).
 * Provides exponential backoff with full jitter, idempotency safeguards, and
 * asynchronous reconciliation workflows for PayPal Payouts.
 */

import { PayPalError } from "../paypal/errors";
import { getPayoutBatch, getPayoutItem } from "../paypal/payouts";
import { db, jobs, payments } from "../../db";
import { appendLedgerEvent } from "../../db/ledger";
import { eq } from "drizzle-orm";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryableStatusCodes?: number[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Calculates exponential backoff with full jitter to avoid the thundering herd problem.
 */
export function calculateBackoff(
  attempt: number,
  initialDelayMs: number = 300,
  maxDelayMs: number = 5000,
  backoffFactor: number = 2
): number {
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  // Full jitter: random between 0 and cappedDelay
  return Math.floor(Math.random() * cappedDelay);
}

/**
 * Executes a function with automatic retry logic for transient network or server errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const backoffFactor = options.backoffFactor ?? 2;
  const retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const isLastAttempt = attempt > maxRetries;
      if (isLastAttempt) {
        break;
      }

      let isRetryable = false;

      // Handle PayPalError status codes
      if (err instanceof PayPalError || (err && typeof err.statusCode === "number")) {
        if (retryableStatusCodes.includes(err.statusCode)) {
          isRetryable = true;
        }
      } else if (
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ENOTFOUND" ||
        err?.message?.includes("fetch failed")
      ) {
        isRetryable = true;
      }

      if (!isRetryable) {
        // Non-transient error (e.g. 400 Bad Request, 401 Unauthorized, 422 Unprocessable)
        throw err;
      }

      const delay = calculateBackoff(attempt, initialDelayMs, maxDelayMs, backoffFactor);
      if (options.onRetry) {
        options.onRetry(attempt, err, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export interface PayoutReconciliationResult {
  payoutBatchId: string;
  batchStatus: string;
  payoutItemId?: string;
  itemStatus?: string;
  attempts: number;
  finalized: boolean;
}

/**
 * Polls PayPal for the terminal status of a Payout Batch.
 * PayPal Payouts are queued asynchronously (often starting in 'PENDING' or 'PROCESSING').
 * This workflow polls with backoff until the batch reaches 'SUCCESS', 'DENIED', or max attempts.
 */
export async function pollPayoutBatchStatus(
  payoutBatchId: string,
  options: { maxPollAttempts?: number; pollIntervalMs?: number } = {}
): Promise<PayoutReconciliationResult> {
  const maxPollAttempts = options.maxPollAttempts ?? 5;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  let attempts = 0;

  while (attempts < maxPollAttempts) {
    attempts++;

    const batch = await withRetry(() => getPayoutBatch(payoutBatchId), {
      maxRetries: 2,
      initialDelayMs: 200,
    });

    const status = batch?.batch_header?.batch_status;
    const items = batch?.items || [];
    const firstItem = items[0];

    // Terminal statuses in PayPal Payouts
    const isTerminal = status === "SUCCESS" || status === "DENIED" || status === "CANCELED";

    if (isTerminal || attempts >= maxPollAttempts) {
      return {
        payoutBatchId,
        batchStatus: status || "UNKNOWN",
        payoutItemId: firstItem?.payout_item_id,
        itemStatus: firstItem?.transaction_status,
        attempts,
        finalized: isTerminal,
      };
    }

    // Wait before next poll attempt
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    payoutBatchId,
    batchStatus: "PROCESSING",
    attempts,
    finalized: false,
  };
}

/**
 * End-to-end Payout Reconciliation Workflow for a specific Job.
 * Syncs the latest PayPal status back to the database and audit ledger.
 */
export async function reconcileJobPayoutWorkflow(jobId: string): Promise<PayoutReconciliationResult | null> {
  // 1. Fetch payout record for this job
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.jobId, jobId))
    .limit(1);

  if (!payment || !payment.paypalId || payment.type !== "PAYOUT") {
    return null;
  }

  // 2. Poll the payout status
  const reconciliation = await pollPayoutBatchStatus(payment.paypalId, {
    maxPollAttempts: 3,
    pollIntervalMs: 500,
  });

  // 3. Update payment table if batch status changed
  if (reconciliation.finalized && payment.status !== "COMPLETED") {
    await db
      .update(payments)
      .set({
        status: reconciliation.batchStatus === "SUCCESS" ? "COMPLETED" : reconciliation.batchStatus,
      })
      .where(eq(payments.id, payment.id));

    // Append ledger audit event for state reconciliation
    await appendLedgerEvent({
      jobId,
      eventType: "PAYOUT_RECONCILED",
      previousState: payment.status,
      newState: reconciliation.batchStatus,
      actor: "SYSTEM",
      payload: {
        payoutBatchId: reconciliation.payoutBatchId,
        payoutItemId: reconciliation.payoutItemId,
        batchStatus: reconciliation.batchStatus,
        itemStatus: reconciliation.itemStatus,
        attempts: reconciliation.attempts,
      },
    });
  }

  return reconciliation;
}
