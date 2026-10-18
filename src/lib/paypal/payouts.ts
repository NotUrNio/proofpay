import { getPayPalAccessToken, getPayPalBaseUrl, isPayPalMock } from "./auth";
import { CreatePayoutParams, PayoutBatchResponse, PayoutItemResponse } from "./types";
import { PayPalError } from "./errors";
import crypto from "crypto";

/**
 * Execute a Payout to a freelancer's PayPal sandbox personal account.
 * Uses sender_batch_id as the primary idempotency key.
 */
export async function createPayout(params: CreatePayoutParams): Promise<PayoutBatchResponse> {
  const {
    recipientEmail,
    amount,
    currency = "USD",
    note,
    senderBatchId,
    senderItemId,
    emailSubject = "ProofPay Milestone Payout Released",
  } = params;

  if (isPayPalMock()) {
    const mockBatchId = `MOCK_BATCH_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      batch_header: {
        payout_batch_id: mockBatchId,
        batch_status: "SUCCESS",
        time_created: new Date().toISOString(),
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: emailSubject,
        },
        amount: {
          currency,
          value: amount,
        },
      },
      links: [
        {
          href: `${getPayPalBaseUrl()}/v1/payments/payouts/${mockBatchId}`,
          rel: "self",
          method: "GET",
        },
      ],
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const body = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: emailSubject,
      email_message: note,
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: amount,
          currency: currency,
        },
        receiver: recipientEmail,
        note: note,
        sender_item_id: senderItemId,
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = errText;
    }
    throw new PayPalError(
      `PayPal Payouts creation failed: status ${response.status} ${response.statusText}`,
      response.status,
      parsed
    );
  }

  return (await response.json()) as PayoutBatchResponse;
}

/**
 * Check the status of a specific Payout Item.
 * Returns processing status, fee, and PayPal transaction ID.
 */
export async function getPayoutItem(payoutItemId: string): Promise<PayoutItemResponse> {
  if (isPayPalMock() || payoutItemId.startsWith("MOCK_")) {
    return {
      payout_item_id: payoutItemId,
      payout_batch_id: "MOCK_BATCH_ID",
      payout_item: {
        recipient_type: "EMAIL",
        amount: {
          currency: "USD",
          value: "50.00",
        },
        receiver: "priya-freelancer@sandbox.paypal.com",
        sender_item_id: "mock_item_id",
      },
      transaction_id: "MOCK_TXN_ID_" + crypto.randomUUID().slice(0, 8),
      transaction_status: "SUCCESS",
      time_processed: new Date().toISOString(),
      links: [],
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v1/payments/payouts-item/${payoutItemId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new PayPalError(
      `Failed to fetch payout item ${payoutItemId}: status ${response.status}`,
      response.status,
      errText
    );
  }

  return (await response.json()) as PayoutItemResponse;
}
