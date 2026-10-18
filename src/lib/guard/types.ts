import { SignedMandate } from "./mandate";

export type GuardDecision = "AUTO_PAY" | "NEEDS_HUMAN" | "REJECT";

export interface CriterionCheckResult {
  id?: string;
  criterionId?: string;
  name: string;
  isHardCheck: boolean;
  passed: boolean;
  reason?: string;
  confidence?: number;
}

export interface GuardVerdictInput {
  overallPassed: boolean;
  confidence: number; // 0.00 to 1.00
  reasoning: string;
  perCriteriaResults: CriterionCheckResult[];
}

export interface GuardJobInput {
  id: string;
  amount: string; // e.g. "50.00"
  currency: string;
  status: string; // e.g. "SUBMITTED" or "VERIFIED"
  freelancerEmail: string;
}

export interface GuardPolicyInput {
  maxDailyPayoutAmount: string; // e.g. "1000.00"
  maxJobPayoutAmount: string;   // e.g. "500.00"
  minConfidenceThreshold: number; // e.g. 0.85
  requireHumanReviewIfAmbiguous?: boolean;
}

export interface GuardContextInput {
  dailyPayoutTotalSoFar: number;
  isIdempotencyKeyUsed: boolean;
  signingSecret?: string;
  now?: Date;
}

export interface GuardInput {
  job: GuardJobInput;
  mandate: SignedMandate;
  verdict: GuardVerdictInput;
  policy: GuardPolicyInput;
  context: GuardContextInput;
}

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  details: string;
  severity: "FATAL" | "HUMAN_REVIEW" | "INFO";
}

export interface GuardResult {
  decision: GuardDecision;
  firedRuleIds: string[];
  ruleResults: RuleEvaluation[];
  summary: string;
}
