import { getPayPalAccessToken, getPayPalBaseUrl, isPayPalMock } from "./auth";
import { CreateOrderParams, PayPalOrderResponse, CaptureOrderResponse } from "./types";
import { PayPalError } from "./errors";
import crypto from "crypto";

/**
 * Create a PayPal Order with intent=CAPTURE.
 * Follows PayPal Orders v2 REST standard with PayPal-Request-Id for idempotency.
 */
export async function createOrder(params: CreateOrderParams): Promise<PayPalOrderResponse> {
  const {
    amount,
    currency = "USD",
    description = "ProofPay Escrow Milestone Funding",
    jobId,
    requestId = `order_${jobId}_${crypto.randomUUID().slice(0, 8)}`,
    returnUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/jobs/${jobId}?funded=true`,
    cancelUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/jobs/${jobId}?canceled=true`,
  } = params;

  if (isPayPalMock()) {
    const mockId = `MOCK_ORDER_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      id: mockId,
      status: "CREATED",
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: jobId,
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      links: [
        {
          href: `${returnUrl}&token=${mockId}`,
          rel: "approve",
          method: "GET",
        },
        {
          href: `${getPayPalBaseUrl()}/v2/checkout/orders/${mockId}`,
          rel: "self",
          method: "GET",
        },
      ],
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: jobId,
        description,
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
    application_context: {
      brand_name: "ProofPay Escrow",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new PayPalError(`Failed to create PayPal order: ${response.status} ${response.statusText}`, response.status, errText);
  }

  return (await response.json()) as PayPalOrderResponse;
}

/**
 * Capture an approved PayPal Order.
 * Releases funds into the platform's Sandbox Business account.
 */
export async function captureOrder(orderId: string, requestId?: string): Promise<CaptureOrderResponse> {
  const reqId = requestId || `capture_${orderId}_${crypto.randomUUID().slice(0, 8)}`;

  if (isPayPalMock()) {
    const mockCaptureId = `MOCK_CAPTURE_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      id: orderId,
      status: "COMPLETED",
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: mockCaptureId,
                status: "COMPLETED",
                amount: {
                  currency_code: "USD",
                  value: "50.00",
                },
              },
            ],
          },
        },
      ],
      payer: {
        email_address: "mock-buyer@sandbox.paypal.com",
        payer_id: "MOCK_PAYER_ID",
      },
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": reqId,
      Prefer: "return=representation",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new PayPalError(`Failed to capture PayPal order ${orderId}: ${response.status} ${response.statusText}`, response.status, errText);
  }

  return (await response.json()) as CaptureOrderResponse;
}
