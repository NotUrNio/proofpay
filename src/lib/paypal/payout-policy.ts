import crypto from "crypto";
import { isBundledDemoJob, ALLOWED_DEMO_PAYEES } from "../demo-templates";
import { createPayout } from "./payouts";
import { getPayPalBaseUrl, isPayPalMock } from "./auth";
import { CreatePayoutParams, PayoutBatchResponse } from "./types";

export type RealPayoutGuardErrorCode =
  | "UNFUNDED_REAL_PAYOUT"
  | "MISSING_PAYEE_ENV"
  | "PLACEHOLDER_PAYEE_FORBIDDEN"
  | "DAILY_REAL_PAYOUT_CAP_EXCEEDED";

export class RealPayoutGuardError extends Error {
  public readonly code: RealPayoutGuardErrorCode;

  constructor(code: RealPayoutGuardErrorCode, message: string) {
    super(message);
    this.name = "RealPayoutGuardError";
    this.code = code;
  }
}

/**
 * Returns true if the email is a placeholder, fixture, or bundled demo persona email
 * that must never be targeted by a real PayPal Sandbox Payout.
 */
export function isPlaceholderOrDemoPayee(email: string): boolean {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return true;
  if (ALLOWED_DEMO_PAYEES.map((e) => e.toLowerCase()).includes(normalized)) {
    return true;
  }
  if (
    normalized.endsWith("@example.test") ||
    normalized.endsWith("@proofpay.io") ||
    normalized.endsWith("@sandbox.paypal.com") ||
    normalized.includes("your_sandbox_") ||
    normalized.startsWith("<")
  ) {
    return true;
  }

  return false;
}

/**
 * Reads the real PayPal Sandbox payee email from environment variables.
 * Fails loudly if the required env var is unset or contains a placeholder.
 */
export function resolveConfiguredSandboxPayeeEmail(
  env: NodeJS.ProcessEnv = process.env
): string {
  const raw =
    env.PAYPAL_SANDBOX_PAYEE_EMAIL?.trim() ||
    env.PAYPAL_SANDBOX_PERSONAL_EMAIL?.trim() ||
    "";

  if (!raw || isPlaceholderOrDemoPayee(raw)) {
    throw new RealPayoutGuardError(
      "MISSING_PAYEE_ENV",
      "Missing required environment variable PAYPAL_SANDBOX_PAYEE_EMAIL (or PAYPAL_SANDBOX_PERSONAL_EMAIL). Real PayPal Sandbox payouts require a registered sandbox personal account email from env vars."
    );
  }

  return raw;
}

/**
 * Reads the real PayPal Sandbox buyer/client email from environment variables.
 * Fails loudly if unset or placeholder.
 */
export function resolveConfiguredSandboxBuyerEmail(
  env: NodeJS.ProcessEnv = process.env
): string {
  const raw =
    env.PAYPAL_SANDBOX_CLIENT_EMAIL?.trim() ||
    env.PAYPAL_SANDBOX_PERSONAL_EMAIL?.trim() ||
    env.PAYPAL_SANDBOX_BUSINESS_EMAIL?.trim() ||
    "";

  if (!raw || isPlaceholderOrDemoPayee(raw)) {
    throw new RealPayoutGuardError(
      "MISSING_PAYEE_ENV",
      "Missing required environment variable PAYPAL_SANDBOX_CLIENT_EMAIL (or PAYPAL_SANDBOX_PERSONAL_EMAIL). Real PayPal Sandbox runs require a configured sandbox buyer email from env vars."
    );
  }

  return raw;
}

/**
 * Bundled demo jobs ALWAYS simulate the payout regardless of PAYPAL_MOCK.
 */
export function shouldSimulatePayoutForJob(
  job: { title: string; freelancerEmail: string },
  isMockEnv: boolean = isPayPalMock()
): boolean {
  if (isBundledDemoJob(job.title, job.freelancerEmail)) {
    return true;
  }
  return isMockEnv;
}

export interface FundingPaymentSnapshot {
  type: string;
  status: string;
  isMock: boolean;
  paypalId: string | null;
}

/**
 * Verifies that a job was funded by a real buyer-approved PayPal capture
 * (not simulated mock funding and not unfunded).
 */
export function hasRealBuyerApprovedCapture(
  fundingPayments: FundingPaymentSnapshot[]
): boolean {
  return fundingPayments.some((p) => {
    if (p.type !== "FUNDING") return false;
    if (p.status !== "COMPLETED" && p.status !== "SUCCESS") return false;
    if (p.isMock) return false;
    const id = (p.paypalId || "").trim();
    if (!id) return false;
    if (id.startsWith("MOCK_") || id.startsWith("sim_")) return false;
    return true;
  });
}

export interface DailyRealPayoutCapResult {
  allowed: boolean;
  reason?: string;
  maxCount: number;
  maxUsd: number;
  currentCount: number;
  currentUsd: number;
}

/**
 * Enforces a hard daily cap on real PayPal Sandbox payouts (both count and total USD).
 */
export function checkDailyRealPayoutCap(
  todayRealPayouts: Array<{ amount: string }>,
  candidateAmountUsd: string,
  env: NodeJS.ProcessEnv = process.env
): DailyRealPayoutCapResult {
  const maxCount = Math.max(
    1,
    parseInt(env.MAX_DAILY_REAL_PAYOUT_COUNT || "5", 10) || 5
  );
  const maxUsd = Math.max(
    1,
    parseFloat(env.MAX_DAILY_REAL_PAYOUT_USD || "25.00") || 25.0
  );

  const currentCount = todayRealPayouts.length;
  const currentUsd = todayRealPayouts.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );
  const candidateAmount = parseFloat(candidateAmountUsd) || 0;

  if (currentCount + 1 > maxCount) {
    return {
      allowed: false,
      reason: `Hard daily real payout count cap reached (${currentCount}/${maxCount} real payouts today). Demo/simulated payouts remain available.`,
      maxCount,
      maxUsd,
      currentCount,
      currentUsd,
    };
  }

  if (currentUsd + candidateAmount > maxUsd + 1e-6) {
    return {
      allowed: false,
      reason: `Hard daily real payout USD cap reached ($${currentUsd.toFixed(2)} + $${candidateAmount.toFixed(2)} exceeds $${maxUsd.toFixed(2)} daily cap).`,
      maxCount,
      maxUsd,
      currentCount,
      currentUsd,
    };
  }

  return {
    allowed: true,
    maxCount,
    maxUsd,
    currentCount,
    currentUsd,
  };
}

export function buildSimulatedPayoutBatch(params: {
  amount: string;
  currency: string;
  senderBatchId: string;
  emailSubject?: string;
}): PayoutBatchResponse {
  const mockBatchId = `MOCK_BATCH_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  return {
    batch_header: {
      payout_batch_id: mockBatchId,
      batch_status: "SUCCESS",
      time_created: new Date().toISOString(),
      sender_batch_header: {
        sender_batch_id: params.senderBatchId,
        email_subject: params.emailSubject || "ProofPay Simulated Milestone Payout",
      },
      amount: {
        currency: params.currency,
        value: params.amount,
      },
    },
    links: [
      {
        href: `${getPayPalBaseUrl()}/v1/payments/payouts/${mockBatchId}`,
        rel: "self",
        method: "GET",
      },
    ],
  };
}

export interface DispatchJobPayoutOptions {
  job: {
    id: string;
    title: string;
    freelancerEmail: string;
    amount: string;
    currency: string;
  };
  fundingPayments: FundingPaymentSnapshot[];
  todayRealPayouts: Array<{ amount: string }>;
  senderBatchId: string;
  senderItemId: string;
  note: string;
  isMockEnv?: boolean;
  env?: NodeJS.ProcessEnv;
  createPayoutFn?: (params: CreatePayoutParams) => Promise<PayoutBatchResponse>;
}

export interface DispatchJobPayoutResult {
  payoutResult: PayoutBatchResponse;
  isSimulated: boolean;
  recipientEmail: string;
  mode: "SIMULATED_DEMO_PAYOUT" | "SIMULATED_TEST_MODE" | "REAL_PAYPAL_SANDBOX";
  uiModeLabel: string;
}

/**
 * Canonical payout dispatcher for ProofPay jobs.
 * - Bundled demo jobs ALWAYS simulate the payout ([SIMULATED]) regardless of PAYPAL_MOCK,
 *   never invoking PayPal Payouts REST API.
 * - Real payouts are ONLY executed when:
 *   1. The job is not a bundled demo job and PAYPAL_MOCK=false
 *   2. The job has a real buyer-approved PayPal funding capture
 *   3. A real sandbox payee email is configured in env vars (and job payee is not a placeholder)
 *   4. The hard daily cap on real payouts has not been reached
 */
export async function dispatchJobPayout(
  options: DispatchJobPayoutOptions
): Promise<DispatchJobPayoutResult> {
  const {
    job,
    fundingPayments,
    todayRealPayouts,
    senderBatchId,
    senderItemId,
    note,
    isMockEnv = isPayPalMock(),
    env = process.env,
    createPayoutFn = createPayout,
  } = options;

  const isDemoJob = isBundledDemoJob(job.title, job.freelancerEmail);
  const isSimulated = shouldSimulatePayoutForJob(job, isMockEnv);

  if (isSimulated) {
    const payoutResult = buildSimulatedPayoutBatch({
      amount: job.amount,
      currency: job.currency,
      senderBatchId,
    });
    return {
      payoutResult,
      isSimulated: true,
      recipientEmail: job.freelancerEmail,
      mode: isDemoJob ? "SIMULATED_DEMO_PAYOUT" : "SIMULATED_TEST_MODE",
      uiModeLabel: "Funding simulated; payout is a simulated demo payout ([SIMULATED])",
    };
  }

  // Real Payout Path Guards:
  // 1. Must have a real buyer-approved PayPal funding capture
  if (!hasRealBuyerApprovedCapture(fundingPayments)) {
    throw new RealPayoutGuardError(
      "UNFUNDED_REAL_PAYOUT",
      "Real PayPal Sandbox payout blocked: job has no completed buyer-approved PayPal funding capture."
    );
  }

  // 2. Require configured sandbox payee env var and forbid placeholder payee emails
  const configuredPayee = resolveConfiguredSandboxPayeeEmail(env);
  if (isPlaceholderOrDemoPayee(job.freelancerEmail)) {
    throw new RealPayoutGuardError(
      "PLACEHOLDER_PAYEE_FORBIDDEN",
      `Real PayPal Sandbox payout blocked: recipient '${job.freelancerEmail}' is a placeholder/demo address. Real payouts must target a configured sandbox account (${configuredPayee}).`
    );
  }

  // 3. Enforce hard daily cap on real payouts
  const capCheck = checkDailyRealPayoutCap(todayRealPayouts, job.amount, env);
  if (!capCheck.allowed) {
    throw new RealPayoutGuardError(
      "DAILY_REAL_PAYOUT_CAP_EXCEEDED",
      capCheck.reason || "Daily real payout cap exceeded."
    );
  }

  // 4. Execute authentic PayPal Sandbox Payout
  const payoutResult = await createPayoutFn({
    recipientEmail: job.freelancerEmail,
    amount: job.amount,
    currency: job.currency,
    note,
    senderBatchId,
    senderItemId,
  });

  return {
    payoutResult,
    isSimulated: false,
    recipientEmail: job.freelancerEmail,
    mode: "REAL_PAYPAL_SANDBOX",
    uiModeLabel: "Funded by real buyer capture; payout is a real PayPal Sandbox payout",
  };
}
