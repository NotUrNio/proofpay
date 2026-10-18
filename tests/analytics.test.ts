import { describe, it, expect, beforeEach } from "vitest";
import {
  computeLatencyFromEvents,
  computeActivityOverTime,
  loadEvalBenchmarkData,
  clearAnalyticsCache,
} from "@/lib/analytics";
import { AnalyticsResponseSchema } from "@/lib/analytics-schema";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { NextRequest } from "next/server";

describe("Analytics Unit & Security Suite", () => {
  beforeEach(() => {
    clearAnalyticsCache();
  });

  describe("Latency Calculation", () => {
    it("returns null median and p90 when event count is 0", () => {
      const res = computeLatencyFromEvents([]);
      expect(res).toEqual({ count: 0, median: null, p90: null });
    });

    it("returns null median and p90 when sample size is below statistical significance threshold (n < 5)", () => {
      const base = new Date("2026-10-18T10:00:00Z").getTime();
      const events = [
        { jobId: "j1", eventType: "WORK_SUBMITTED", createdAt: new Date(base) },
        { jobId: "j1", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 2000) },
        { jobId: "j2", eventType: "WORK_SUBMITTED", createdAt: new Date(base + 3000) },
        { jobId: "j2", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 7000) },
        { jobId: "j3", eventType: "WORK_SUBMITTED", createdAt: new Date(base + 8000) },
        { jobId: "j3", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 12000) },
      ];
      const res = computeLatencyFromEvents(events);
      expect(res.count).toBe(3);
      expect(res.median).toBeNull();
      expect(res.p90).toBeNull();
    });

    it("computes accurate median and p90 when n >= 5 with out-of-order events", () => {
      const base = new Date("2026-10-18T10:00:00Z").getTime();
      // 5 jobs with latencies: 2s, 4s, 6s, 8s, 10s
      const events = [
        // j3 payout before j1 submit in array order to test sorting
        { jobId: "j3", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 1000 + 6000) },
        { jobId: "j1", eventType: "WORK_SUBMITTED", createdAt: new Date(base) },
        { jobId: "j1", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 2000) },
        { jobId: "j2", eventType: "WORK_SUBMITTED", createdAt: new Date(base + 500) },
        { jobId: "j2", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 500 + 4000) },
        { jobId: "j3", eventType: "WORK_SUBMITTED", createdAt: new Date(base + 1000) },
        { jobId: "j4", eventType: "WORK_SUBMITTED", createdAt: new Date(base + 2000) },
        { jobId: "j4", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 2000 + 8000) },
        { jobId: "j5", eventType: "WORK_SUBMITTED", createdAt: new Date(base + 3000) },
        { jobId: "j5", eventType: "PAYOUT_RELEASED", createdAt: new Date(base + 3000 + 10000) },
      ];

      const res = computeLatencyFromEvents(events);
      expect(res.count).toBe(5);
      // Latencies: [2, 4, 6, 8, 10]. Median is 6.
      expect(res.median).toBe(6);
      // p90Index = min(4, floor(5 * 0.9)) = 4 -> 10
      expect(res.p90).toBe(10);
    });
  });

  describe("Activity Over Time Calculation", () => {
    it("returns empty days when events array is empty", () => {
      const res = computeActivityOverTime([]);
      expect(res.distinctDaysCount).toBe(0);
      expect(res.hasMultipleDays).toBe(false);
      expect(res.days).toEqual([]);
    });

    it("suppresses single-day timeline to avoid misleading zero-slope charts", () => {
      const events = [
        { createdAt: new Date("2026-10-18T10:00:00Z"), isMock: false },
        { createdAt: new Date("2026-10-18T12:00:00Z"), isMock: true },
        { createdAt: new Date("2026-10-18T14:00:00Z"), isMock: false },
      ];
      const res = computeActivityOverTime(events);
      expect(res.distinctDaysCount).toBe(1);
      expect(res.hasMultipleDays).toBe(false);
      expect(res.days).toEqual([]);
    });

    it("aggregates real vs simulated events across multiple days", () => {
      const events = [
        { createdAt: new Date("2026-10-17T09:00:00Z"), isMock: false },
        { createdAt: new Date("2026-10-17T11:00:00Z"), isMock: true },
        { createdAt: new Date("2026-10-18T08:00:00Z"), isMock: false },
        { createdAt: new Date("2026-10-18T15:00:00Z"), isMock: false },
      ];
      const res = computeActivityOverTime(events);
      expect(res.distinctDaysCount).toBe(2);
      expect(res.hasMultipleDays).toBe(true);
      expect(res.days).toHaveLength(2);
      expect(res.days[0]).toEqual({
        date: "2026-10-17",
        eventCount: 2,
        realEvents: 1,
        simulatedEvents: 1,
      });
      expect(res.days[1]).toEqual({
        date: "2026-10-18",
        eventCount: 2,
        realEvents: 2,
        simulatedEvents: 0,
      });
    });
  });

  describe("Eval Benchmark Data Loader", () => {
    it("reads latest.json benchmark fixture accurately", () => {
      const data = loadEvalBenchmarkData();
      expect(data.totalBenchmarkCases).toBeGreaterThan(0);
      expect(data.overallAccuracyPercent).toBeGreaterThanOrEqual(0);
      expect(data.overallAccuracyPercent).toBeLessThanOrEqual(100);
      expect(data.wilsonIntervalLow).toBeLessThanOrEqual(data.wilsonIntervalHigh);
      expect(data.modelAgreement.runsK).toBe(3);
    });
  });

  describe("Zod Strict Allowlist Security", () => {
    const validSample = {
      success: true as const,
      timestamp: new Date().toISOString(),
      kpis: {
        clientDepositedReal: "$100.00",
        clientDepositedSimulated: "$50.00",
        clientDepositedTotal: "$150.00",
        escrowBalanceReal: "$50.00",
        escrowBalanceSimulated: "$0.00",
        escrowBalanceTotal: "$50.00",
        freelancerSettledReal: "$50.00",
        freelancerSettledSimulated: "$50.00",
        freelancerSettledTotal: "$100.00",
        pendingReviewsCount: 1,
        activeJobsCount: 2,
      },
      outcomes: [
        { decision: "AUTO_PAY" as const, real: 2, simulated: 1, total: 3 },
        { decision: "NEEDS_HUMAN" as const, real: 0, simulated: 1, total: 1 },
        { decision: "REJECT" as const, real: 0, simulated: 0, total: 0 },
      ],
      topReasons: [{ code: "SPEC_MATCH", count: 3 }],
      hardCheckFailures: [{ type: "DIMENSIONS", count: 1, label: "Dimension check" }],
      modelAgreement: {
        runsK: 3,
        agreement3of3: 20,
        agreement2of3: 2,
        agreement1of3: 0,
        preModelRejections: 6,
        totalEvaluated: 28,
      },
      spendVsCaps: {
        dailyCapUsd: 1000,
        jobCapUsd: 250,
        realSpentTodayUsd: 50,
        simulatedSpentTodayUsd: 50,
        totalSpentTodayUsd: 100,
        remainingDailyUsd: 900,
        currency: "USD" as const,
      },
      latency: {
        sampleCount: 5,
        hasEnoughData: true,
        medianSeconds: 4.2,
        p90Seconds: 7.8,
        note: "5 samples",
      },
      activity: {
        distinctDaysCount: 0,
        hasMultipleDays: false,
        days: [],
      },
      evalBenchmark: {
        overallAccuracyPercent: 100,
        falseApprovalFraction: "0/22",
        wilsonIntervalLow: 0.8794,
        wilsonIntervalHigh: 1.0,
        totalBenchmarkCases: 28,
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.5-flash-lite",
        sampleSizeCaveat: "Benchmark sample size caveat.",
        categories: [],
      },
      dataSources: {
        kpis: { table: "jobs", window: "All time", includesSimulated: true },
      },
    };

    it("accepts valid schema payload", () => {
      const parsed = AnalyticsResponseSchema.parse(validSample);
      expect(parsed.success).toBe(true);
    });

    it("strictly rejects payloads with forbidden PII or secret fields", () => {
      // Forbidden PII fields
      const piiPayload = {
        ...validSample,
        clientEmail: "secret-client@example.test",
        paypalBatchId: "PAYOUTS-999-SECRET",
        rawPayload: { token: "secret" },
      };
      expect(() => AnalyticsResponseSchema.parse(piiPayload)).toThrow();
    });

    it("rejects negative counts and out-of-range accuracy", () => {
      const invalidCounts = {
        ...validSample,
        kpis: {
          ...validSample.kpis,
          activeJobsCount: -1,
        },
      };
      expect(() => AnalyticsResponseSchema.parse(invalidCounts)).toThrow();
    });
  });

  describe("Role Access Parity", () => {
    it("allows client, freelancer, and reviewer roles to access analytics", () => {
      for (const role of ["client", "freelancer", "reviewer"]) {
        const req = new NextRequest("http://localhost:3000/api/stats/analytics", {
          headers: {
            cookie: `proofpay_role=${role}`,
          },
        });
        const auth = assertAuthorizedRole(req, ["client", "freelancer", "reviewer"]);
        expect("errorResponse" in auth).toBe(false);
        if ("role" in auth) {
          expect(auth.role).toBe(role);
        }
      }
    });

    it("denies access with 403 when role is not in the allowed list", async () => {
      const req = new NextRequest("http://localhost:3000/api/stats/analytics", {
        headers: {
          cookie: "proofpay_role=freelancer",
        },
      });
      // Test when an endpoint restricts to reviewer only
      const auth = assertAuthorizedRole(req, ["reviewer"]);
      expect("errorResponse" in auth).toBe(true);
      if ("errorResponse" in auth) {
        expect(auth.errorResponse.status).toBe(403);
      }
    });
  });
});
