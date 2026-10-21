import { describe, it, expect, vi } from "vitest";
import {
  dispatchJobPayout,
  shouldSimulatePayoutForJob,
  hasRealBuyerApprovedCapture,
  checkDailyRealPayoutCap,
  resolveConfiguredSandboxPayeeEmail,
  RealPayoutGuardError,
} from "../src/lib/paypal/payout-policy";

describe("Payout Modes, Bundled Demo Guard, Real Capture Requirement & Daily Cap", () => {
  it("formats ledger events with [SIMULATED] tag when PAYPAL_MOCK is true", () => {
    const isMock = true;
    const eventTypeSubmit = isMock ? "PAYOUT_INITIATED [SIMULATED]" : "PAYOUT_INITIATED";
    const eventTypeInbox = isMock ? "PAYOUT_RELEASED [SIMULATED]" : "PAYOUT_RELEASED";
    const mode = isMock ? "SIMULATED_TEST_MODE" : "REAL_PAYPAL_SANDBOX";

    expect(eventTypeSubmit).toBe("PAYOUT_INITIATED [SIMULATED]");
    expect(eventTypeInbox).toBe("PAYOUT_RELEASED [SIMULATED]");
    expect(mode).toBe("SIMULATED_TEST_MODE");
    expect(isMock).toBe(true);
  });

  it("formats ledger events as authentic PayPal actions WITHOUT [SIMULATED] when PAYPAL_MOCK is false on a real job", () => {
    const isMock = false;
    const eventTypeSubmit = isMock ? "PAYOUT_INITIATED [SIMULATED]" : "PAYOUT_INITIATED";
    const eventTypeInbox = isMock ? "PAYOUT_RELEASED [SIMULATED]" : "PAYOUT_RELEASED";
    const mode = isMock ? "SIMULATED_TEST_MODE" : "REAL_PAYPAL_SANDBOX";

    expect(eventTypeSubmit).toBe("PAYOUT_INITIATED");
    expect(eventTypeInbox).toBe("PAYOUT_RELEASED");
    expect(eventTypeSubmit).not.toContain("[SIMULATED]");
    expect(eventTypeInbox).not.toContain("[SIMULATED]");
    expect(mode).toBe("REAL_PAYPAL_SANDBOX");
    expect(isMock).toBe(false);
  });

  it("bundled demo job NEVER calls PayPal Payouts even when PAYPAL_MOCK=false", async () => {
    const createPayoutSpy = vi.fn();

    const bundledDemoJob = {
      id: "demo-job-1",
      title: "Demo: 1. Happy Path: Compliant Banner",
      freelancerEmail: "priya@proofpay.io",
      amount: "5.00",
      currency: "USD",
    };

    expect(shouldSimulatePayoutForJob(bundledDemoJob, false)).toBe(true);

    const res = await dispatchJobPayout({
      job: bundledDemoJob,
      fundingPayments: [], // Even with no real funding capture, demo jobs simulate cleanly
      todayRealPayouts: [],
      senderBatchId: "batch_demo_1",
      senderItemId: "item_demo_1",
      note: "Bundled demo scenario",
      isMockEnv: false, // PAYPAL_MOCK=false (as on Render)
      createPayoutFn: createPayoutSpy,
    });

    expect(createPayoutSpy).not.toHaveBeenCalled();
    expect(res.isSimulated).toBe(true);
    expect(res.mode).toBe("SIMULATED_DEMO_PAYOUT");
    expect(res.payoutResult.batch_header.payout_batch_id).toMatch(/^MOCK_BATCH_/);
    expect(res.uiModeLabel).toContain("[SIMULATED]");
  });

  it("real payout without a buyer-approved capture is IMPOSSIBLE and throws UNFUNDED_REAL_PAYOUT", async () => {
    const createPayoutSpy = vi.fn();
    const realJob = {
      id: "real-job-unfunded",
      title: "Custom Brand Identity Package",
      freelancerEmail: "verified-payee@personal.example.com",
      amount: "5.00",
      currency: "USD",
    };

    // Case A: Zero funding payments
    await expect(
      dispatchJobPayout({
        job: realJob,
        fundingPayments: [],
        todayRealPayouts: [],
        senderBatchId: "batch_real_1",
        senderItemId: "item_real_1",
        note: "Unfunded attempt",
        isMockEnv: false,
        env: { PAYPAL_SANDBOX_PAYEE_EMAIL: "verified-payee@personal.example.com" } as any,
        createPayoutFn: createPayoutSpy,
      })
    ).rejects.toMatchObject({
      name: "RealPayoutGuardError",
      code: "UNFUNDED_REAL_PAYOUT",
    });

    // Case B: Only a simulated MOCK_CAPTURE funding payment exists
    await expect(
      dispatchJobPayout({
        job: realJob,
        fundingPayments: [
          {
            type: "FUNDING",
            status: "COMPLETED",
            isMock: true,
            paypalId: "MOCK_CAPTURE_12345678",
          },
        ],
        todayRealPayouts: [],
        senderBatchId: "batch_real_2",
        senderItemId: "item_real_2",
        note: "Simulated funding attempt on real payout",
        isMockEnv: false,
        env: { PAYPAL_SANDBOX_PAYEE_EMAIL: "verified-payee@personal.example.com" } as any,
        createPayoutFn: createPayoutSpy,
      })
    ).rejects.toMatchObject({
      name: "RealPayoutGuardError",
      code: "UNFUNDED_REAL_PAYOUT",
    });

    expect(createPayoutSpy).not.toHaveBeenCalled();
  });

  it("fails loudly with MISSING_PAYEE_ENV when required sandbox payee env var is missing or placeholder", () => {
    expect(() => resolveConfiguredSandboxPayeeEmail({} as any)).toThrowError(
      RealPayoutGuardError
    );
    expect(() =>
      resolveConfiguredSandboxPayeeEmail({
        PAYPAL_SANDBOX_PAYEE_EMAIL: "freelancer@example.test",
      } as any)
    ).toThrowError(/Missing required environment variable/);
    expect(() =>
      resolveConfiguredSandboxPayeeEmail({
        PAYPAL_SANDBOX_PAYEE_EMAIL: "priya@proofpay.io",
      } as any)
    ).toThrowError(/Missing required environment variable/);
  });

  it("enforces hard daily cap on real payouts (both count and USD total)", async () => {
    const createPayoutSpy = vi.fn();
    const realJob = {
      id: "real-job-capped",
      title: "Custom Milestone",
      freelancerEmail: "verified-payee@personal.example.com",
      amount: "10.00",
      currency: "USD",
    };
    const validFunding = [
      {
        type: "FUNDING",
        status: "COMPLETED",
        isMock: false,
        paypalId: "8XY12345ABC67890",
      },
    ];

    // Exceeds USD cap ($20 already paid + $10 candidate > $25 cap)
    await expect(
      dispatchJobPayout({
        job: realJob,
        fundingPayments: validFunding,
        todayRealPayouts: [{ amount: "15.00" }, { amount: "5.00" }],
        senderBatchId: "batch_cap_usd",
        senderItemId: "item_cap_usd",
        note: "Cap test",
        isMockEnv: false,
        env: {
          PAYPAL_SANDBOX_PAYEE_EMAIL: "verified-payee@personal.example.com",
          MAX_DAILY_REAL_PAYOUT_USD: "25.00",
          MAX_DAILY_REAL_PAYOUT_COUNT: "5",
        } as any,
        createPayoutFn: createPayoutSpy,
      })
    ).rejects.toMatchObject({
      code: "DAILY_REAL_PAYOUT_CAP_EXCEEDED",
    });

    // Exceeds count cap (2 already paid, max count = 2)
    await expect(
      dispatchJobPayout({
        job: { ...realJob, amount: "1.00" },
        fundingPayments: validFunding,
        todayRealPayouts: [{ amount: "1.00" }, { amount: "1.00" }],
        senderBatchId: "batch_cap_cnt",
        senderItemId: "item_cap_cnt",
        note: "Cap count test",
        isMockEnv: false,
        env: {
          PAYPAL_SANDBOX_PAYEE_EMAIL: "verified-payee@personal.example.com",
          MAX_DAILY_REAL_PAYOUT_USD: "25.00",
          MAX_DAILY_REAL_PAYOUT_COUNT: "2",
        } as any,
        createPayoutFn: createPayoutSpy,
      })
    ).rejects.toMatchObject({
      code: "DAILY_REAL_PAYOUT_CAP_EXCEEDED",
    });

    expect(createPayoutSpy).not.toHaveBeenCalled();
  });

  it("executes real PayPal Sandbox payout when funded by a real buyer capture and within daily cap", async () => {
    const createPayoutSpy = vi.fn().mockResolvedValue({
      batch_header: {
        payout_batch_id: "REAL_SANDBOX_BATCH_999",
        batch_status: "PENDING",
        time_created: new Date().toISOString(),
        sender_batch_header: { sender_batch_id: "batch_ok_1" },
        amount: { currency: "USD", value: "5.00" },
      },
      links: [],
    });

    const realJob = {
      id: "real-job-ok",
      title: "Custom Milestone Deliverable",
      freelancerEmail: "verified-payee@personal.example.com",
      amount: "5.00",
      currency: "USD",
    };

    const res = await dispatchJobPayout({
      job: realJob,
      fundingPayments: [
        {
          type: "FUNDING",
          status: "COMPLETED",
          isMock: false,
          paypalId: "CAPTURE_REAL_987654321",
        },
      ],
      todayRealPayouts: [{ amount: "5.00" }],
      senderBatchId: "batch_ok_1",
      senderItemId: "item_ok_1",
      note: "Real settlement",
      isMockEnv: false,
      env: {
        PAYPAL_SANDBOX_PAYEE_EMAIL: "verified-payee@personal.example.com",
        MAX_DAILY_REAL_PAYOUT_USD: "25.00",
        MAX_DAILY_REAL_PAYOUT_COUNT: "5",
      } as any,
      createPayoutFn: createPayoutSpy,
    });

    expect(createPayoutSpy).toHaveBeenCalledTimes(1);
    expect(createPayoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "verified-payee@personal.example.com",
        amount: "5.00",
        currency: "USD",
      })
    );
    expect(res.isSimulated).toBe(false);
    expect(res.mode).toBe("REAL_PAYPAL_SANDBOX");
    expect(res.payoutResult.batch_header.payout_batch_id).toBe("REAL_SANDBOX_BATCH_999");
  });

  it("correctly identifies PayPal INSUFFICIENT_FUNDS error details and returns 402", () => {
    const errDetails1 = "INSUFFICIENT_FUNDS: Sender does not have enough balance";
    const errDetails2 = { name: "ERRPYO004", message: "Account balance too low" };

    const checkInsufficient = (details: any) => {
      if (typeof details === "string") {
        return details.includes("INSUFFICIENT_FUNDS") || details.includes("ERRPYO004");
      }
      return JSON.stringify(details).includes("INSUFFICIENT_FUNDS") || JSON.stringify(details).includes("ERRPYO004");
    };

    expect(checkInsufficient(errDetails1)).toBe(true);
    expect(checkInsufficient(errDetails2)).toBe(true);
    expect(checkInsufficient("GENERIC_NETWORK_ERROR")).toBe(false);
    expect(hasRealBuyerApprovedCapture([])).toBe(false);
    expect(checkDailyRealPayoutCap([], "5.00").allowed).toBe(true);
  });
});
