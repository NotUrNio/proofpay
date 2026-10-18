import crypto from "crypto";

export interface MandatePayload {
  jobId: string;
  maxAmount: string; // e.g. "50.00"
  currency: string;  // "USD"
  payeeEmail: string;
  scope: string;     // e.g. "social_media_banner_milestone_1"
  expiresAt: string; // ISO 8601 string
}

export interface SignedMandate extends MandatePayload {
  signature: string;
}

export function canonicalizeMandate(payload: MandatePayload): string {
  // Enforce sorted deterministic key order for consistent hashing
  return JSON.stringify({
    currency: payload.currency,
    expiresAt: payload.expiresAt,
    jobId: payload.jobId,
    maxAmount: payload.maxAmount,
    payeeEmail: payload.payeeEmail.toLowerCase(),
    scope: payload.scope,
  });
}

/**
 * Sign an Intent Mandate with HMAC-SHA256 using the system secret.
 */
export function signMandate(payload: MandatePayload, secret = process.env.MANDATE_SIGNING_SECRET || "default_test_secret_32_chars_min"): SignedMandate {
  const canonical = canonicalizeMandate(payload);
  const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  return {
    ...payload,
    signature,
  };
}

/**
 * Verify a Signed Mandate's cryptographic HMAC-SHA256 signature and expiration.
 */
export function verifyMandate(
  mandate: SignedMandate,
  secret = process.env.MANDATE_SIGNING_SECRET || "default_test_secret_32_chars_min",
  now: Date = new Date()
): { valid: boolean; reason?: string } {
  if (!mandate || !mandate.signature) {
    return { valid: false, reason: "Missing mandate signature" };
  }

  // Check expiration
  const expiryDate = new Date(mandate.expiresAt);
  if (isNaN(expiryDate.getTime())) {
    return { valid: false, reason: "Invalid expiresAt date format" };
  }
  if (now.getTime() > expiryDate.getTime()) {
    return { valid: false, reason: "Mandate has expired" };
  }

  // Verify HMAC signature
  const canonical = canonicalizeMandate(mandate);
  const expectedSignature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");

  // Constant-time comparison to prevent timing attacks
  const bufExpected = Buffer.from(expectedSignature, "hex");
  const bufActual = Buffer.from(mandate.signature, "hex");

  if (bufExpected.length !== bufActual.length || !crypto.timingSafeEqual(bufExpected, bufActual)) {
    return { valid: false, reason: "Mandate signature mismatch or tampering detected" };
  }

  return { valid: true };
}
