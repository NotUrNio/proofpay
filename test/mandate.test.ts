import { describe, it, expect } from "vitest";
import { signMandate, verifyMandate, MandatePayload } from "../src/lib/guard/mandate";

describe("Mandate Signing & Cryptographic Verification", () => {
  const secret = "test_signing_secret_at_least_32_characters_long_12345";
  const basePayload: MandatePayload = {
    jobId: "11111111-2222-3333-4444-555555555555",
    maxAmount: "50.00",
    currency: "USD",
    payeeEmail: "priya-designer@sandbox.paypal.com",
    scope: "social_media_banner_milestone_1",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h in future
  };

  it("should successfully sign and verify a valid mandate", () => {
    const signed = signMandate(basePayload, secret);
    expect(signed.signature).toBeDefined();
    expect(signed.signature.length).toBe(64); // SHA-256 hex string

    const result = verifyMandate(signed, secret);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should reject a mandate if payload content was tampered with", () => {
    const signed = signMandate(basePayload, secret);
    // Tamper with the amount
    const tampered = { ...signed, maxAmount: "500.00" };

    const result = verifyMandate(tampered, secret);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("signature mismatch or tampering");
  });

  it("should reject a mandate signed with a different secret", () => {
    const signed = signMandate(basePayload, "attacker_secret_value_1234567890");
    const result = verifyMandate(signed, secret);
    expect(result.valid).toBe(false);
  });

  it("should reject an expired mandate", () => {
    const expiredPayload: MandatePayload = {
      ...basePayload,
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute in past
    };
    const signed = signMandate(expiredPayload, secret);
    const result = verifyMandate(signed, secret);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("expired");
  });
});
