import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPayPalAccessToken, createOrder, createPayout, PayPalConfigError } from "../src/lib/paypal";

describe("PayPal REST Client & Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw PayPalConfigError if credentials missing and PAYPAL_MOCK is not true", async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    process.env.PAYPAL_MOCK = "false";

    await expect(getPayPalAccessToken()).rejects.toThrow(PayPalConfigError);
  });

  it("should return simulated access token when PAYPAL_MOCK=true", async () => {
    process.env.PAYPAL_MOCK = "true";
    const token = await getPayPalAccessToken();
    expect(token).toContain("MOCK_PAYPAL_ACCESS_TOKEN");
  });

  it("should return mock order with approve link when PAYPAL_MOCK=true", async () => {
    process.env.PAYPAL_MOCK = "true";
    const order = await createOrder({
      amount: "50.00",
      jobId: "test-job-id",
    });

    expect(order.id).toContain("MOCK_ORDER");
    expect(order.status).toBe("CREATED");
    const approveLink = order.links.find((l) => l.rel === "approve");
    expect(approveLink).toBeDefined();
  });

  it("should return mock payout batch when PAYPAL_MOCK=true", async () => {
    process.env.PAYPAL_MOCK = "true";
    const payout = await createPayout({
      recipientEmail: "freelancer@sandbox.paypal.com",
      amount: "50.00",
      note: "Test payout",
      senderBatchId: "batch-123",
      senderItemId: "item-123",
    });

    expect(payout.batch_header.payout_batch_id).toContain("MOCK_BATCH");
    expect(payout.batch_header.batch_status).toBe("SUCCESS");
  });
});
