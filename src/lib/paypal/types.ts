export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookId?: string;
  isMock: boolean;
}

export interface OAuthTokenResponse {
  scope: string;
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number; // in seconds (typically 32400 = 9 hours)
  nonce: string;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Orders v2 Interfaces
export interface CreateOrderParams {
  amount: string; // e.g. "50.00"
  currency?: string; // default "USD"
  description?: string;
  jobId: string;
  requestId?: string; // PayPal-Request-Id for idempotency
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PayPalOrderLink {
  href: string;
  rel: string;
  method: string;
}

export interface PayPalOrderResponse {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  intent: "CAPTURE";
  purchase_units: Array<{
    reference_id?: string;
    amount: {
      currency_code: string;
      value: string;
    };
    payee?: {
      email_address?: string;
      merchant_id?: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
  links: PayPalOrderLink[];
}

export interface CaptureOrderResponse {
  id: string; // Order ID
  status: "COMPLETED" | "DECLINED" | "FAILED" | "PENDING";
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string; // Capture ID
        status: "COMPLETED" | "DECLINED" | "FAILED" | "PENDING";
        amount: {
          currency_code: string;
          value: string;
        };
        seller_protection?: {
          status: string;
        };
        final_capture?: boolean;
      }>;
    };
  }>;
  payer?: {
    email_address?: string;
    payer_id?: string;
  };
}

// Payouts REST Interfaces
export interface CreatePayoutParams {
  recipientEmail: string;
  amount: string; // e.g. "50.00"
  currency?: string; // default "USD"
  note: string;
  senderBatchId: string; // Idempotency key at batch level
  senderItemId: string; // Idempotency / reference key at item level
  emailSubject?: string;
}

export interface PayoutBatchResponse {
  batch_header: {
    payout_batch_id: string;
    batch_status: "PENDING" | "PROCESSING" | "SUCCESS" | "CANCELED" | "DENIED";
    time_created: string;
    sender_batch_header: {
      sender_batch_id: string;
      email_subject?: string;
    };
    amount: {
      currency: string;
      value: string;
    };
  };
  links: PayPalOrderLink[];
}

export interface PayoutItemResponse {
  payout_item_id: string;
  payout_batch_id: string;
  payout_item_fee?: {
    currency: string;
    value: string;
  };
  payout_item: {
    recipient_type: "EMAIL" | "PHONE" | "PAYPAL_ID";
    amount: {
      currency: string;
      value: string;
    };
    note?: string;
    receiver: string;
    sender_item_id?: string;
  };
  transaction_id?: string;
  transaction_status: "SUCCESS" | "FAILED" | "PENDING" | "UNCLAIMED" | "RETURNED" | "ONHOLD" | "BLOCKED" | "REFUNDED" | "REVERSED";
  time_processed?: string;
  errors?: Record<string, unknown>;
  links: PayPalOrderLink[];
}

// Webhook Verification Interfaces
export interface VerifyWebhookParams {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  rawBody: string; // Unparsed raw body string
}

export interface WebhookVerificationResponse {
  verification_status: "SUCCESS" | "FAILURE";
}

// Refund Capture Interfaces (POST /v2/payments/captures/{capture_id}/refund)
export interface RefundCaptureParams {
  captureId: string;
  amount?: string;
  currency?: string;
  noteToPayer?: string;
  requestId?: string;
}

export interface RefundResponse {
  id: string;
  status: "COMPLETED" | "PENDING" | "FAILED";
  amount?: {
    value: string;
    currency_code: string;
  };
  note_to_payer?: string;
  create_time?: string;
  update_time?: string;
  links?: PayPalOrderLink[];
}
