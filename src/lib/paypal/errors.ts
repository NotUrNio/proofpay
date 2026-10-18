export class PayPalError extends Error {
  public statusCode?: number;
  public details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = "PayPalError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class PayPalAuthError extends PayPalError {
  constructor(message: string, details?: unknown) {
    super(`PayPal Authentication Failed: ${message}`, 401, details);
    this.name = "PayPalAuthError";
  }
}

export class PayPalConfigError extends PayPalError {
  constructor(message: string) {
    super(
      `PayPal Configuration Missing: ${message}. Please check your .env configuration. If you intend to run in isolated mock mode, set PAYPAL_MOCK=true.`,
      500
    );
    this.name = "PayPalConfigError";
  }
}

export class PayPalWebhookVerificationError extends PayPalError {
  constructor(message: string, details?: unknown) {
    super(`PayPal Webhook Signature Verification Failed: ${message}`, 400, details);
    this.name = "PayPalWebhookVerificationError";
  }
}

export class PayPalIdempotencyError extends PayPalError {
  constructor(message: string, details?: unknown) {
    super(`PayPal Idempotency Conflict: ${message}`, 409, details);
    this.name = "PayPalIdempotencyError";
  }
}
