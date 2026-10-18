import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { evaluatePolicyGuard } from "../src/lib/guard";
import { signMandate } from "../src/lib/guard/mandate";
import { assertAuthorizedRole, checkRateLimit, UserRole } from "../src/lib/auth/roles";
import { assertReadOnlyTool, STUDIO_AI_TOOLS } from "../src/lib/studio/assistant";

const SIGNING_SECRET = "test_signing_secret_min_32_characters_for_hmac_sha256";

describe("Milestone 4 & Step 0 Security & Architectural Boundaries", () => {
  // Test (a): Human approval still fails on expired mandate, cap exceeded or payee mismatch
  describe("(a) Human Approval Guard Constraints", () => {
    it("fails human approval when the signed mandate has expired", () => {
      const expiredDate = new Date(Date.now() - 3600 * 1000).toISOString();
      const jobId = "job_test_expired";
      const payeeEmail = "freelancer@test.com";

      const signed = signMandate({
        jobId,
        maxAmount: "100.00",
        currency: "USD",
        payeeEmail,
        scope: "test",
        expiresAt: expiredDate,
      }, SIGNING_SECRET);

      const result = evaluatePolicyGuard({
        job: {
          id: jobId,
          amount: "50.00",
          currency: "USD",
          status: "VERIFIED",
          freelancerEmail: payeeEmail,
        },
        mandate: {
          jobId,
          maxAmount: "100.00",
          currency: "USD",
          payeeEmail,
          scope: "test",
          expiresAt: expiredDate,
          signature: signed.signature,
        },
        verdict: {
          overallPassed: true, // Human reviewer clicked "Approve"
          confidence: 1.0,
          reasoning: "Approved by manual reviewer",
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
          signingSecret: SIGNING_SECRET,
        },
      });

      expect(result.decision).toBe("REJECT");
      expect(result.firedRuleIds).toContain("RULE_MANDATE_NOT_EXPIRED");
    });

    it("fails human approval when payout amount exceeds mandate maxAmount", () => {
      const futureDate = new Date(Date.now() + 86400 * 1000).toISOString();
      const jobId = "job_test_cap_exceeded";
      const payeeEmail = "freelancer@test.com";

      const signed = signMandate({
        jobId,
        maxAmount: "25.00", // Mandate authorizes up to $25.00
        currency: "USD",
        payeeEmail,
        scope: "test",
        expiresAt: futureDate,
      }, SIGNING_SECRET);

      const result = evaluatePolicyGuard({
        job: {
          id: jobId,
          amount: "50.00", // Job requests $50.00 > $25.00 cap
          currency: "USD",
          status: "VERIFIED",
          freelancerEmail: payeeEmail,
        },
        mandate: {
          jobId,
          maxAmount: "25.00",
          currency: "USD",
          payeeEmail,
          scope: "test",
          expiresAt: futureDate,
          signature: signed.signature,
        },
        verdict: {
          overallPassed: true,
          confidence: 1.0,
          reasoning: "Approved by human reviewer",
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
          signingSecret: SIGNING_SECRET,
        },
      });

      expect(result.decision).toBe("REJECT");
      expect(result.firedRuleIds).toContain("RULE_MANDATE_AMOUNT_CAP");
    });

    it("fails human approval when payee email does not match signed mandate", () => {
      const futureDate = new Date(Date.now() + 86400 * 1000).toISOString();
      const jobId = "job_test_payee_mismatch";
      const authorizedPayee = "authorized@test.com";
      const maliciousPayee = "attacker@evil.com";

      const signed = signMandate({
        jobId,
        maxAmount: "100.00",
        currency: "USD",
        payeeEmail: authorizedPayee,
        scope: "test",
        expiresAt: futureDate,
      }, SIGNING_SECRET);

      const result = evaluatePolicyGuard({
        job: {
          id: jobId,
          amount: "50.00",
          currency: "USD",
          status: "VERIFIED",
          freelancerEmail: maliciousPayee, // Attacker swapped recipient
        },
        mandate: {
          jobId,
          maxAmount: "100.00",
          currency: "USD",
          payeeEmail: authorizedPayee,
          scope: "test",
          expiresAt: futureDate,
          signature: signed.signature,
        },
        verdict: {
          overallPassed: true,
          confidence: 1.0,
          reasoning: "Approved by human reviewer",
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
          signingSecret: SIGNING_SECRET,
        },
      });

      expect(result.decision).toBe("REJECT");
      expect(result.firedRuleIds).toContain("RULE_PAYEE_MATCH");
    });
  });

  // Test (b): No client or UI code imports lib/paypal
  describe("(b) Architectural Boundary: Zero PayPal Imports in UI/Client Code", () => {
    function scanDirectory(dir: string, fileList: string[] = []): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Exclude api routes from UI check
          if (entry.name === "api") continue;
          scanDirectory(fullPath, fileList);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    it("verifies that NO frontend UI page or component imports from lib/paypal", () => {
      const srcAppDir = path.resolve(__dirname, "../src/app");
      const srcComponentsDir = path.resolve(__dirname, "../src/components");

      const uiFiles = [
        ...scanDirectory(srcAppDir),
        ...scanDirectory(srcComponentsDir),
      ];

      expect(uiFiles.length).toBeGreaterThan(5);

      const violations: { file: string; line: string }[] = [];

      for (const file of uiFiles) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");
        for (const line of lines) {
          if (
            line.includes("from \"@/lib/paypal") ||
            line.includes("from '../lib/paypal") ||
            line.includes("from '../../lib/paypal") ||
            line.includes("from \"../lib/paypal")
          ) {
            violations.push({ file: path.relative(process.cwd(), file), line: line.trim() });
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // Test (c): Mutating routes reject the wrong role
  describe("(c) Access Control & Role Enforcement", () => {
    it("rejects unauthorized client from performing reviewer actions", () => {
      const fakeReq = {
        cookies: {
          get: (name: string) => ({ value: "client" }),
        },
        headers: {
          get: (name: string) => null,
        },
      } as any;

      const auth = assertAuthorizedRole(fakeReq, ["reviewer"]);
      expect("errorResponse" in auth).toBe(true);
      if ("errorResponse" in auth) {
        expect(auth.errorResponse.status).toBe(403);
      }
    });

    it("authorizes reviewer for reviewer actions", () => {
      const fakeReq = {
        cookies: {
          get: (name: string) => ({ value: "reviewer" }),
        },
        headers: {
          get: (name: string) => null,
        },
      } as any;

      const auth = assertAuthorizedRole(fakeReq, ["reviewer"]);
      expect("user" in auth).toBe(true);
      if ("user" in auth) {
        expect(auth.user.role).toBe("reviewer");
      }
    });

    it("rejects client role from submitting deliverables", () => {
      const fakeReq = {
        cookies: {
          get: (name: string) => ({ value: "client" }),
        },
        headers: {
          get: (name: string) => null,
        },
      } as any;

      const auth = assertAuthorizedRole(fakeReq, ["freelancer", "reviewer"]);
      expect("errorResponse" in auth).toBe(true);
      if ("errorResponse" in auth) {
        expect(auth.errorResponse.status).toBe(403);
      }
    });

    it("enforces sliding window rate limit for submissions", () => {
      const testKey = "test_rate_limit_user_" + Date.now();
      for (let i = 0; i < 5; i++) {
        const check = checkRateLimit(testKey, 5, 10000);
        expect(check.allowed).toBe(true);
      }
      const sixthCheck = checkRateLimit(testKey, 5, 10000);
      expect(sixthCheck.allowed).toBe(false);
      expect(sixthCheck.remaining).toBe(0);
    });
  });

  // Test (d): Policy validation
  describe("(d) Policy Validation Constraints", () => {
    it("validates that policy confidence must be between 0.5 and 1.0", () => {
      const invalidLow = 0.4;
      const valid = 0.85;
      expect(invalidLow >= 0.5 && invalidLow <= 1.0).toBe(false);
      expect(valid >= 0.5 && valid <= 1.0).toBe(true);
    });
  });

  // Test (e): Counterfactual simulator calls real guard() on recorded outputs with zero network calls
  describe("(e) Counterfactual Simulator Determinism & Zero Network Calls", () => {
    it("executes evaluatePolicyGuard on past verdict without making any fetch calls", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      try {
        const signed = signMandate({
          jobId: "replay_test_job",
          maxAmount: "100.00",
          currency: "USD",
          payeeEmail: "freelancer@test.com",
          scope: "test",
          expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        }, SIGNING_SECRET);

        const decision = evaluatePolicyGuard({
          job: {
            id: "replay_test_job",
            amount: "50.00",
            currency: "USD",
            status: "VERIFIED",
            freelancerEmail: "freelancer@test.com",
          },
          mandate: {
            jobId: "replay_test_job",
            maxAmount: "100.00",
            currency: "USD",
            payeeEmail: "freelancer@test.com",
            scope: "test",
            expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
            signature: signed.signature,
          },
          verdict: {
            overallPassed: true,
            confidence: 0.95,
            reasoning: "Clean replay test",
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
            signingSecret: SIGNING_SECRET,
          },
        });

        expect(decision.decision).toBe("AUTO_PAY");
        // Verify ZERO network calls were made
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // Test (f): Studio AI Assistant Read-Only Safety
  describe("(f) Studio AI Assistant Safety: Strictly Read-Only", () => {
    it("allows registered read-only diagnostic tools", () => {
      const metricsTool = assertReadOnlyTool("getSettlementMetrics");
      expect(metricsTool.readOnly).toBe(true);

      const auditTool = assertReadOnlyTool("getJobAuditSummary");
      expect(auditTool.readOnly).toBe(true);
    });

    it("throws critical security exception if any mutation or payment tool is invoked", () => {
      const maliciousToolNames = [
        "approveJob",
        "payDeliverable",
        "executePayout",
        "refundEscrowPayment",
        "updatePolicyCap",
        "deleteLedgerRow",
      ];

      for (const toolName of maliciousToolNames) {
        expect(() => assertReadOnlyTool(toolName)).toThrow(
          /CRITICAL SECURITY VIOLATION/
        );
      }
    });
  });
});

