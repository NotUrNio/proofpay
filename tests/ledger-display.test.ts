import { describe, it, expect } from "vitest";
import { maskEmail, maskPayloadEmails } from "../src/lib/ledger-display";
import { canonicalJsonStringify, verifyLedgerEventsOffline } from "../src/db/ledger";
import crypto from "crypto";

describe("Public Ledger Display Layer Email Masking & Hash Immutability", () => {
  it("masks emails correctly while preserving username boundaries and domain", () => {
    expect(maskEmail("alice@proofpay.io")).toBe("a***e@proofpay.io");
    expect(maskEmail("sb-personal123@personal.example.com")).toBe("s***3@personal.example.com");
    expect(maskEmail("sb-biz987@business.example.com")).toBe("s***7@business.example.com");
    expect(maskEmail("me@test.com")).toBe("m***@test.com");
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
  });

  it("masks emails in complex real-run ledger payloads while preserving PayPal IDs, amounts, and hashes", () => {
    const rawPayload = {
      title: "Social Media Banner (Summer Sale)",
      orderId: "4LF11783H4649862W",
      captureId: "4GP221272V958470N",
      payoutBatchId: "CPMFG3U4LAXS2",
      payoutItemId: "A7PB6RVHLGY2U",
      amount: "5.00",
      currency: "USD",
      clientEmail: "sb-buyer77419@personal.example.com",
      freelancerEmail: "sb-payee88312@business.example.com",
      metadata: {
        nestedEmail: "support@proofpay.io",
        attemptCount: 1,
      },
    };

    const masked = maskPayloadEmails(rawPayload) as typeof rawPayload;

    // Emails are masked
    expect(masked.clientEmail).toBe("s***9@personal.example.com");
    expect(masked.freelancerEmail).toBe("s***2@business.example.com");
    expect(masked.metadata.nestedEmail).toBe("s***t@proofpay.io");

    // Traceable PayPal IDs, amounts, titles are untouched
    expect(masked.orderId).toBe("4LF11783H4649862W");
    expect(masked.captureId).toBe("4GP221272V958470N");
    expect(masked.payoutBatchId).toBe("CPMFG3U4LAXS2");
    expect(masked.payoutItemId).toBe("A7PB6RVHLGY2U");
    expect(masked.amount).toBe("5.00");
    expect(masked.currency).toBe("USD");
    expect(masked.title).toBe("Social Media Banner (Summer Sale)");
  });

  it("proves that display-layer masking does not alter underlying stored payloads or break cryptographic chain verification", () => {
    const storedPayload = {
      orderId: "ORDER-HASH-1",
      amount: "10.00",
      clientEmail: "real-buyer@example.com",
      freelancerEmail: "real-freelancer@example.com",
    };

    const genesis = "0000000000000000000000000000000000000000000000000000000000000000";
    const payloadCanonicalStr = canonicalJsonStringify(storedPayload);
    const expectedHash = crypto
      .createHash("sha256")
      .update(`${genesis}|job-display-test|JOB_FUNDED|FUNDED|CLIENT|false|${payloadCanonicalStr}`)
      .digest("hex");

    const storedEvent = {
      id: crypto.randomUUID(),
      jobId: "job-display-test",
      eventType: "JOB_FUNDED",
      newState: "FUNDED",
      actor: "CLIENT",
      isMock: false,
      payload: storedPayload,
      signatureOrHash: expectedHash,
    };

    // 1. Verify the stored event is cryptographically valid
    const initialVerify = verifyLedgerEventsOffline([storedEvent]);
    expect(initialVerify.valid).toBe(true);

    // 2. Derive display layer representation (e.g. for /ledger UI or /api/ledger)
    const displayEvent = {
      ...storedEvent,
      payload: maskPayloadEmails(storedEvent.payload),
    };

    // Stored object was not mutated
    expect((storedEvent.payload as any).clientEmail).toBe("real-buyer@example.com");
    // Display object has masked email
    expect((displayEvent.payload as any).clientEmail).toBe("r***r@example.com");

    // 3. Hash of the stored event remains valid and unchanged
    const postVerify = verifyLedgerEventsOffline([storedEvent]);
    expect(postVerify.valid).toBe(true);
    expect(postVerify.totalEventsVerified).toBe(1);
  });
});

