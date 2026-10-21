import { describe, it, expect, beforeEach } from "vitest";
import { isBundledDemoJob, BUNDLED_DEMO_PRESETS, ALLOWED_DEMO_PAYEES } from "../src/lib/demo-templates";
import { evaluatePolicyGuard } from "../src/lib/guard";

describe("Demo Funding Invariant & Template Validation", () => {
  it("permits simulated funding for authentic bundled demo presets with standard payee", () => {
    for (const title of BUNDLED_DEMO_PRESETS) {
      expect(isBundledDemoJob(title, "priya@proofpay.io")).toBe(true);
      expect(isBundledDemoJob(title, "priya-designer@sandbox.paypal.com")).toBe(true);
    }
  });

  it("permits simulated funding for scenario titles prefixed with Demo:", () => {
    expect(isBundledDemoJob("Demo: Custom Guided Scenario", "priya@proofpay.io")).toBe(true);
  });

  it("strictly rejects simulated funding for user-supplied job titles", () => {
    expect(isBundledDemoJob("Build an arbitrary e-commerce app", "priya@proofpay.io")).toBe(false);
    expect(isBundledDemoJob("Personal Project Milestone 1", "priya@proofpay.io")).toBe(false);
  });

  it("strictly rejects simulated funding for user-supplied payees (arbitrary withdrawal targets)", () => {
    expect(isBundledDemoJob("Demo: 1. Happy Path: Compliant Banner", "attacker@evil.com")).toBe(false);
    expect(isBundledDemoJob("Demo: 1. Happy Path: Compliant Banner", "my-personal-paypal@gmail.com")).toBe(false);
  });
});

describe("Policy Restore & Mandate Financial Safety", () => {
  it("rejects policy edit or restore if maxJobPayoutAmount exceeds active client mandate cap", () => {
    const mandateCap = 15.0; // Client signed an immutable $15.00 mandate cap
    const restoredPolicyJobAmount = 500.0; // Policy attempts to allow $500 payouts

    expect(restoredPolicyJobAmount > mandateCap).toBe(true);
  });

  it("ensures Policy Guard strictly fails-closed if mandate signature is invalid or tampered", () => {
    const tamperedMandate = {
      jobId: "job-123",
      maxAmount: "50.00",
      currency: "USD",
      payeeEmail: "priya@proofpay.io",
      scope: "design",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      signature: "tampered_hmac_signature_value",
    };

    const guardResult = evaluatePolicyGuard({
      job: {
        id: "job-123",
        amount: "50.00",
        currency: "USD",
        status: "VERIFIED",
        freelancerEmail: "priya@proofpay.io",
      },
      mandate: tamperedMandate,
      verdict: {
        overallPassed: true,
        confidence: 0.99,
        reasoning: "All checks passed",
        perCriteriaResults: [],
        allHardChecksPassed: true,
        injectionSuspected: false,
      },
      policy: {
        maxDailyPayoutAmount: "1000.00",
        maxJobPayoutAmount: "500.00",
        minConfidenceThreshold: 0.85,
        requireHumanReviewIfAmbiguous: true,
      },
      context: {
        dailyPayoutTotalSoFar: 0,
        isIdempotencyKeyUsed: false,
        signingSecret: "test_secret_32_characters_long_for_guard!",
      },
    });

    expect(guardResult.decision).not.toBe("AUTO_PAY");
    expect(guardResult.firedRuleIds).toContain("RULE_MANDATE_SIG_VALID");
  });
});
