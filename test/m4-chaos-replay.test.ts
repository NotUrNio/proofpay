import { describe, it, expect, beforeEach } from "vitest";
import { runChaosDrill, ORDERS_MOCK_CODES, PAYOUTS_MOCK_CODES } from "../src/lib/paypal/chaos";
import { evaluatePolicyGuard } from "../src/lib/guard";
import { appendLedgerEvent, verifyLedgerChain } from "../src/db/ledger";
import { ensureDatabaseSchema } from "../src/db/init";
import crypto from "crypto";
describe("Milestone 4: Failure Drills, Chaos Negative Testing & Policy Replay", () => {
  beforeEach(async () => {
    process.env.PAYPAL_MOCK = "true";
    await ensureDatabaseSchema();
  });

  describe("1. PayPal Negative Testing Protocol Specification", () => {
    it("should correctly define Orders v2 mock application codes for HTTP header injection", () => {
      expect(ORDERS_MOCK_CODES.INSTRUMENT_DECLINED.code).toBe("INSTRUMENT_DECLINED");
      expect(ORDERS_MOCK_CODES.INSTRUMENT_DECLINED.endpoint).toContain("/capture");

      expect(ORDERS_MOCK_CODES.DUPLICATE_INVOICE_ID.code).toBe("DUPLICATE_INVOICE_ID");
      expect(ORDERS_MOCK_CODES.DUPLICATE_INVOICE_ID.endpoint).toBe("POST /v2/checkout/orders");

      const headerValue = JSON.stringify({
        mock_application_codes: ORDERS_MOCK_CODES.INSTRUMENT_DECLINED.code,
      });
      const parsed = JSON.parse(headerValue);
      expect(parsed.mock_application_codes).toBe("INSTRUMENT_DECLINED");
    });

    it("should correctly define Payouts v1 payload simulation codes according to PayPal docs", () => {
      expect(PAYOUTS_MOCK_CODES.ERRPYO004.code).toBe("ERRPYO004");
      expect(PAYOUTS_MOCK_CODES.ERRPYO004.name).toBe("INSUFFICIENT_FUNDS");
      expect(PAYOUTS_MOCK_CODES.ERRPYO004.endpoint).toBe("POST /v1/payments/payouts");

      expect(PAYOUTS_MOCK_CODES.ERRPYO002.code).toBe("ERRPYO002");
      expect(PAYOUTS_MOCK_CODES.ERRPYO002.name).toBe("SENDER_EMAIL_UNCONFIRMED");
    });
  });

  describe("2. Adversarial Prompt Injection Defense Drill", () => {
    it("should reject an adversarial injection drill via pure TypeScript Policy Guard invariants", async () => {
      const drillResult = await runChaosDrill("ADVERSARIAL_INJECTION");

      expect(drillResult.drillType).toBe("ADVERSARIAL_INJECTION");
      expect(drillResult.proofPayHandled).toBe(true);
      expect(drillResult.httpStatus).toBe(403);

      const rawErr = drillResult.rawPayPalError as { guardDecision: string; violations: string[]; zeroLlmGuaranteed: boolean };
      expect(rawErr.guardDecision).toBe("REJECT");
      expect(rawErr.zeroLlmGuaranteed).toBe(true);
      expect(rawErr.violations.length).toBeGreaterThanOrEqual(3);
      expect(rawErr.violations.some((v) => v.includes("RULE_PAYEE_MATCH"))).toBe(true);
    });
  });

  describe("3. Counterfactual Policy Replay Engine (Dry-Run Mode)", () => {
    const mockMandate = {
      jobId: "test_job_replay_123",
      maxAmount: "50.00",
      currency: "USD",
      payeeEmail: "priya@sandbox.paypal.com",
      scope: "banner_design",
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      signature: "dummy_valid_sig",
    };

    it("should flip an AUTO_PAY decision to NEEDS_HUMAN when confidence threshold is raised in replay", () => {
      const job = {
        id: "test_job_replay_123",
        amount: "50.00",
        currency: "USD",
        status: "VERIFIED",
        freelancerEmail: "priya@sandbox.paypal.com",
      };

      const verdict = {
        overallPassed: true,
        confidence: 0.88, // 88% confidence
        reasoning: "Passed all rubrics",
        perCriteriaResults: [],
        allHardChecksPassed: true,
        injectionSuspected: false,
      };

      // 1. Replay under calibrated default threshold (0.85) -> AUTO_PAY
      const resultDefault = evaluatePolicyGuard({
        job,
        mandate: {
          ...mockMandate,
          // Sign valid mandate
          signature: crypto
            .createHmac("sha256", "test_signing_secret_32_characters_long_min!")
            .update(
              JSON.stringify({
                currency: "USD",
                expiresAt: mockMandate.expiresAt,
                jobId: job.id,
                maxAmount: "50.00",
                payeeEmail: "priya@sandbox.paypal.com",
                scope: "banner_design",
              })
            )
            .digest("hex"),
        },
        verdict,
        policy: {
          maxDailyPayoutAmount: "1000.00",
          maxJobPayoutAmount: "500.00",
          minConfidenceThreshold: 0.85,
          requireHumanReviewIfAmbiguous: true,
        },
        context: {
          dailyPayoutTotalSoFar: 0,
          isIdempotencyKeyUsed: false,
          signingSecret: "test_signing_secret_32_characters_long_min!",
        },
      });

      expect(resultDefault.decision).toBe("AUTO_PAY");

      // 2. Replay under stricter policy threshold (0.95) -> NEEDS_HUMAN
      const resultStrict = evaluatePolicyGuard({
        job,
        mandate: {
          ...mockMandate,
          signature: crypto
            .createHmac("sha256", "test_signing_secret_32_characters_long_min!")
            .update(
              JSON.stringify({
                currency: "USD",
                expiresAt: mockMandate.expiresAt,
                jobId: job.id,
                maxAmount: "50.00",
                payeeEmail: "priya@sandbox.paypal.com",
                scope: "banner_design",
              })
            )
            .digest("hex"),
        },
        verdict,
        policy: {
          maxDailyPayoutAmount: "1000.00",
          maxJobPayoutAmount: "500.00",
          minConfidenceThreshold: 0.95, // Raised from 0.85 to 0.95
          requireHumanReviewIfAmbiguous: true,
        },
        context: {
          dailyPayoutTotalSoFar: 0,
          isIdempotencyKeyUsed: false,
          signingSecret: "test_signing_secret_32_characters_long_min!",
        },
      });

      expect(resultStrict.decision).toBe("NEEDS_HUMAN");
      expect(resultStrict.firedRuleIds).toContain("RULE_CONFIDENCE_THRESHOLD");
    });
  });

  describe("4. Chaos Drill Audit Provenance & Hash Chain Integrity", () => {
    it("should append chaos drill events to the immutable ledger and maintain cryptographic hash chain", async () => {
      const jobId = crypto.randomUUID();

      const { db, jobs } = await import("../src/db");
      await db.insert(jobs).values({
        id: jobId,
        title: "Chaos Drill Milestone",
        description: "Test job for chaos drill",
        clientEmail: "client@test.com",
        freelancerEmail: "freelancer@test.com",
        amount: "5.00",
        currency: "USD",
        status: "CREATED",
      });

      await appendLedgerEvent({
        jobId,
        eventType: "JOB_CREATED",
        newState: "CREATED",
        actor: "CLIENT",
        payload: { title: "Chaos Drill Milestone" },
      });

      await appendLedgerEvent({
        jobId,
        eventType: "CHAOS_DRILL_EXECUTED",
        newState: "CREATED",
        actor: "SYSTEM",
        payload: {
          drillType: "INSTRUMENT_DECLINED",
          mockCode: "INSTRUMENT_DECLINED",
          result: "HANDLED_GRACEFULLY",
        },
      });

      const audit = await verifyLedgerChain(jobId);
      expect(audit.valid).toBe(true);
      expect(audit.totalEventsVerified).toBe(2);
    });

    it("should execute RETRY_500_IDEMPOTENCY drill and prove idempotent recovery with same requestId", async () => {
      const drillResult = await runChaosDrill("RETRY_500_IDEMPOTENCY");
      expect(drillResult.drillType).toBe("RETRY_500_IDEMPOTENCY");
      expect(drillResult.proofPayHandled).toBe(true);
      expect(drillResult.moneyMoved).toBe(false);
      expect(drillResult.triggerMechanism).toBe("Idempotency Replay Safeguard");
      expect(drillResult.summary).toContain("double payment mathematically impossible");
    });

    it("should execute WEBHOOK_REPLAY drill and prove deduplication with zero duplicate effects", async () => {
      const drillResult = await runChaosDrill("WEBHOOK_REPLAY");
      expect(drillResult.drillType).toBe("WEBHOOK_REPLAY");
      expect(drillResult.proofPayHandled).toBe(true);
      expect(drillResult.moneyMoved).toBe(false);
      expect(drillResult.httpStatus).toBe(200);
      expect(drillResult.summary).toContain("webhook replay defense");
    });
  });
});
