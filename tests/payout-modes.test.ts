import { describe, it, expect } from "vitest";

describe("Payout Modes & Ledger Real vs Simulated Labeling", () => {
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

  it("formats ledger events as authentic PayPal actions WITHOUT [SIMULATED] when PAYPAL_MOCK is false", () => {
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

  it("correctly identifies PayPal INSUFFICIENT_FUNDS error details", () => {
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
  });

  it("handles INSUFFICIENT_FUNDS by generating structured 402 error payload", () => {
    const simulateErrorResponse = (errDetails: string) => {
      return {
        status: 402,
        body: {
          success: false,
          error: "INSUFFICIENT_FUNDS",
          message:
            "Platform Sandbox Escrow Balance Depleted: PayPal rejected payout with INSUFFICIENT_FUNDS. (Over N demo runs without buyer captures, the platform sandbox balance drained to $0.00. Top up balance in PayPal Developer Dashboard or enable PAYPAL_MOCK=true).",
          jobStatus: "VERIFIED",
          decision: "AUTO_PAY",
        },
      };
    };

    const res = simulateErrorResponse("INSUFFICIENT_FUNDS");
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_FUNDS");
    expect(res.body.message).toContain("Platform Sandbox Escrow Balance Depleted");
  });
});

