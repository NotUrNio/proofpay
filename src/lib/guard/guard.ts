import { verifyMandate } from "./mandate";
import { GuardInput, GuardResult, RuleEvaluation } from "./types";

/**
 * ProofPay Pure TypeScript Policy Guard (ZERO LLM Imports).
 * Evaluates deterministic invariant rules to decide whether funds can be autonomously released.
 */
export function evaluatePolicyGuard(input: GuardInput): GuardResult {
  const { job, mandate, verdict, policy, context } = input;
  const now = context.now || new Date();
  const ruleResults: RuleEvaluation[] = [];

  const jobAmount = parseFloat(job.amount);
  const mandateMax = parseFloat(mandate.maxAmount);
  const policyJobCap = parseFloat(policy.maxJobPayoutAmount);
  const policyDailyCap = parseFloat(policy.maxDailyPayoutAmount);

  // 1. Mandate Signature Check
  const mandateCheck = verifyMandate(mandate, context.signingSecret, now);
  ruleResults.push({
    ruleId: "RULE_MANDATE_SIG_VALID",
    ruleName: "Mandate HMAC-SHA256 Cryptographic Signature",
    passed: mandateCheck.valid,
    details: mandateCheck.valid ? "Mandate signature authentic" : (mandateCheck.reason || "Invalid signature"),
    severity: "FATAL",
  });

  // 2. Mandate Expiration Check
  const isExpired = new Date(mandate.expiresAt).getTime() < now.getTime();
  ruleResults.push({
    ruleId: "RULE_MANDATE_NOT_EXPIRED",
    ruleName: "Mandate Expiration Check",
    passed: !isExpired,
    details: isExpired ? `Mandate expired at ${mandate.expiresAt}` : `Valid until ${mandate.expiresAt}`,
    severity: "FATAL",
  });

  // 3. Payee Match Check
  const payeeMatches = job.freelancerEmail.trim().toLowerCase() === mandate.payeeEmail.trim().toLowerCase();
  ruleResults.push({
    ruleId: "RULE_PAYEE_MATCH",
    ruleName: "Payee Identity Verification",
    passed: payeeMatches,
    details: payeeMatches
      ? `Payee matches mandate (${job.freelancerEmail})`
      : `Payee mismatch: job=${job.freelancerEmail}, mandate=${mandate.payeeEmail}`,
    severity: "FATAL",
  });

  // 4. Mandate Amount Cap Check
  const withinMandateCap = !isNaN(jobAmount) && !isNaN(mandateMax) && jobAmount <= mandateMax;
  ruleResults.push({
    ruleId: "RULE_MANDATE_AMOUNT_CAP",
    ruleName: "Mandate Maximum Cap Check",
    passed: withinMandateCap,
    details: withinMandateCap
      ? `Amount $${jobAmount.toFixed(2)} <= Mandate Max $${mandateMax.toFixed(2)}`
      : `Amount $${jobAmount} exceeds mandate limit $${mandateMax}`,
    severity: "FATAL",
  });

  // 5. Policy Per-Job Cap Check
  const withinPolicyJobCap = !isNaN(jobAmount) && !isNaN(policyJobCap) && jobAmount <= policyJobCap;
  ruleResults.push({
    ruleId: "RULE_POLICY_JOB_CAP",
    ruleName: "Policy Per-Job Payout Cap",
    passed: withinPolicyJobCap,
    details: withinPolicyJobCap
      ? `Amount $${jobAmount.toFixed(2)} <= Policy Cap $${policyJobCap.toFixed(2)}`
      : `Amount $${jobAmount} exceeds system policy job cap $${policyJobCap}`,
    severity: "HUMAN_REVIEW",
  });

  // 6. Policy Daily Cap Check
  const projectedDailyTotal = context.dailyPayoutTotalSoFar + jobAmount;
  const withinDailyCap = !isNaN(projectedDailyTotal) && !isNaN(policyDailyCap) && projectedDailyTotal <= policyDailyCap;
  ruleResults.push({
    ruleId: "RULE_POLICY_DAILY_CAP",
    ruleName: "Policy Daily Payout Velocity Cap",
    passed: withinDailyCap,
    details: withinDailyCap
      ? `Daily total $${projectedDailyTotal.toFixed(2)} <= Daily Limit $${policyDailyCap.toFixed(2)}`
      : `Daily total $${projectedDailyTotal.toFixed(2)} exceeds limit $${policyDailyCap.toFixed(2)}`,
    severity: "HUMAN_REVIEW",
  });

  // 7. Confidence Threshold Check
  const meetsConfidence = verdict.confidence >= policy.minConfidenceThreshold;
  ruleResults.push({
    ruleId: "RULE_CONFIDENCE_THRESHOLD",
    ruleName: "AI Verification Confidence Threshold",
    passed: meetsConfidence,
    details: meetsConfidence
      ? `Confidence ${(verdict.confidence * 100).toFixed(1)}% >= Threshold ${(policy.minConfidenceThreshold * 100).toFixed(1)}%`
      : `Confidence ${(verdict.confidence * 100).toFixed(1)}% is below threshold ${(policy.minConfidenceThreshold * 100).toFixed(1)}%`,
    severity: "HUMAN_REVIEW",
  });

  // 8. Hard Deterministic Checks Passed
  const failedHardChecks = (verdict.perCriteriaResults || []).filter(
    (c) => c.isHardCheck && !c.passed
  );
  const allHardPassed = failedHardChecks.length === 0 && verdict.overallPassed !== false;
  ruleResults.push({
    ruleId: "RULE_HARD_CHECKS_PASSED",
    ruleName: "Deterministic Hard Acceptance Criteria",
    passed: allHardPassed,
    details: allHardPassed
      ? "All mandatory deterministic criteria satisfied"
      : `Failed ${failedHardChecks.length} hard criteria: ${failedHardChecks.map((c) => c.name).join(", ")}`,
    severity: "FATAL",
  });

  // 9. Idempotency Key Unused Check
  const idempotencySafe = !context.isIdempotencyKeyUsed;
  ruleResults.push({
    ruleId: "RULE_IDEMPOTENCY_UNUSED",
    ruleName: "Payout Idempotency Key Verification",
    passed: idempotencySafe,
    details: idempotencySafe ? "Idempotency key is clean and unused" : "Duplicate payout request detected",
    severity: "FATAL",
  });

  // 10. Job State Valid Check
  const validStates = ["SUBMITTED", "VERIFYING", "VERIFIED", "CREATED", "FUNDED"];
  const isStateValid = validStates.includes(job.status);
  ruleResults.push({
    ruleId: "RULE_JOB_STATE_VALID",
    ruleName: "Job State Invariant",
    passed: isStateValid,
    details: isStateValid ? `State is valid (${job.status})` : `Invalid state for payout: ${job.status}`,
    severity: "FATAL",
  });

  // Decision Logic:
  // - Any FATAL failure -> REJECT
  // - Any HUMAN_REVIEW failure -> NEEDS_HUMAN
  // - Otherwise -> AUTO_PAY

  const fatalFails = ruleResults.filter((r) => !r.passed && r.severity === "FATAL");
  const humanFails = ruleResults.filter((r) => !r.passed && r.severity === "HUMAN_REVIEW");

  const firedRuleIds = ruleResults.filter((r) => !r.passed).map((r) => r.ruleId);

  if (fatalFails.length > 0) {
    return {
      decision: "REJECT",
      firedRuleIds,
      ruleResults,
      summary: `Payout rejected: violated ${fatalFails.length} fatal safety invariant(s): ${fatalFails.map((r) => r.ruleName).join("; ")}`,
    };
  }

  if (humanFails.length > 0) {
    return {
      decision: "NEEDS_HUMAN",
      firedRuleIds,
      ruleResults,
      summary: `Held for human approval queue: ${humanFails.map((r) => r.ruleName).join("; ")}`,
    };
  }

  return {
    decision: "AUTO_PAY",
    firedRuleIds: [],
    ruleResults,
    summary: `All ${ruleResults.length} policy guard rules passed. Authorized for immediate autonomous PayPal payout.`,
  };
}
