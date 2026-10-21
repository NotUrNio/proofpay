/**
 * Pure display-layer utility for masking sensitive user/payee emails
 * in the public audit ledger UI and public ledger API while preserving
 * underlying stored payloads and cryptographic SHA-256 hashes byte-for-byte.
 */

export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return email;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;

  const user = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (user.length <= 2) {
    return `${user[0]}***@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export function maskPayloadEmails(val: unknown): unknown {
  if (val === null || val === undefined || typeof val !== "object") {
    if (typeof val === "string" && val.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return maskEmail(val);
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val.map(maskPayloadEmails);
  }

  const record = val as Record<string, unknown>;
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const isEmailKey = /email/i.test(key);
    if (typeof value === "string") {
      if (isEmailKey || (value.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
        masked[key] = maskEmail(value);
      } else {
        masked[key] = value;
      }
    } else {
      masked[key] = maskPayloadEmails(value);
    }
  }

  return masked;
}

