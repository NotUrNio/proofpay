import { z } from "zod";

export const OutcomeCountSchema = z.object({
  decision: z.enum(["AUTO_PAY", "NEEDS_HUMAN", "REJECT"]),
  real: z.number().int().nonnegative(),
  simulated: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const ReasonCodeSchema = z.object({
  code: z.string().max(80),
  count: z.number().int().nonnegative(),
});

export const HardCheckFailureSchema = z.object({
  type: z.string().max(50),
  count: z.number().int().nonnegative(),
  label: z.string().max(80),
});

export const ModelAgreementSchema = z.object({
  runsK: z.number().int(),
  agreement3of3: z.number().int().nonnegative(),
  agreement2of3: z.number().int().nonnegative(),
  agreement1of3: z.number().int().nonnegative(),
  preModelRejections: z.number().int().nonnegative(),
  totalEvaluated: z.number().int().nonnegative(),
});

export const SpendVsCapsSchema = z.object({
  dailyCapUsd: z.number().nonnegative(),
  jobCapUsd: z.number().nonnegative(),
  realSpentTodayUsd: z.number().nonnegative(),
  simulatedSpentTodayUsd: z.number().nonnegative(),
  totalSpentTodayUsd: z.number().nonnegative(),
  remainingDailyUsd: z.number(),
  currency: z.literal("USD"),
});

export const LatencyMetricsSchema = z.object({
  sampleCount: z.number().int().nonnegative(),
  hasEnoughData: z.boolean(),
  medianSeconds: z.number().nullable(),
  p90Seconds: z.number().nullable(),
  note: z.string().max(120),
});

export const ActivityDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventCount: z.number().int().nonnegative(),
  realEvents: z.number().int().nonnegative(),
  simulatedEvents: z.number().int().nonnegative(),
});

export const ActivityOverTimeSchema = z.object({
  distinctDaysCount: z.number().int().nonnegative(),
  hasMultipleDays: z.boolean(),
  days: z.array(ActivityDaySchema),
});

export const EvalCategoryBreakdownSchema = z.object({
  category: z.string().max(50),
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  accuracyPercent: z.number().min(0).max(100),
});

export const EvalMetricsSchema = z.object({
  overallAccuracyPercent: z.number().min(0).max(100),
  falseApprovalFraction: z.string().max(20),
  wilsonIntervalLow: z.number().min(0).max(1),
  wilsonIntervalHigh: z.number().min(0).max(1),
  totalBenchmarkCases: z.number().int().nonnegative(),
  primaryModel: z.string().max(60),
  fallbackModel: z.string().max(60),
  sampleSizeCaveat: z.string().max(160),
  categories: z.array(EvalCategoryBreakdownSchema),
});

export const KpiMetricsSchema = z.object({
  clientDepositedReal: z.string(),
  clientDepositedSimulated: z.string(),
  clientDepositedTotal: z.string(),
  escrowBalanceReal: z.string(),
  escrowBalanceSimulated: z.string(),
  escrowBalanceTotal: z.string(),
  freelancerSettledReal: z.string(),
  freelancerSettledSimulated: z.string(),
  freelancerSettledTotal: z.string(),
  pendingReviewsCount: z.number().int().nonnegative(),
  activeJobsCount: z.number().int().nonnegative(),
});

// Strict allowlist: disallows emails, user names, PayPal IDs, and raw ledger payloads
export const AnalyticsResponseSchema = z
  .object({
    success: z.literal(true),
    timestamp: z.string().datetime(),
    kpis: KpiMetricsSchema,
    outcomes: z.array(OutcomeCountSchema),
    topReasons: z.array(ReasonCodeSchema),
    hardCheckFailures: z.array(HardCheckFailureSchema),
    modelAgreement: ModelAgreementSchema,
    spendVsCaps: SpendVsCapsSchema,
    latency: LatencyMetricsSchema,
    activity: ActivityOverTimeSchema,
    evalBenchmark: EvalMetricsSchema,
    dataSources: z.record(
      z.string(),
      z.object({
        table: z.string(),
        window: z.string(),
        includesSimulated: z.boolean(),
      })
    ),
  })
  .strict();

export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
export type OutcomeCount = z.infer<typeof OutcomeCountSchema>;
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type HardCheckFailure = z.infer<typeof HardCheckFailureSchema>;
export type ModelAgreement = z.infer<typeof ModelAgreementSchema>;
export type SpendVsCaps = z.infer<typeof SpendVsCapsSchema>;
export type LatencyMetrics = z.infer<typeof LatencyMetricsSchema>;
export type ActivityOverTime = z.infer<typeof ActivityOverTimeSchema>;
export type EvalMetrics = z.infer<typeof EvalMetricsSchema>;
export type KpiMetrics = z.infer<typeof KpiMetricsSchema>;
