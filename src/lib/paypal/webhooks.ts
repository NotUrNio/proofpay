import { getPayPalAccessToken, getPayPalBaseUrl, isPayPalMock } from "./auth";
import { VerifyWebhookParams, WebhookVerificationResponse } from "./types";
import { PayPalWebhookVerificationError } from "./errors";

/**
 * Verify a PayPal Webhook signature against PayPal's verification endpoint.
 * CRITICAL: rawBody must be the raw, unparsed request body string directly from the HTTP request.
 */
export async function verifyWebhookSignature(params: VerifyWebhookParams): Promise<boolean> {
  const { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime, webhookId, rawBody } = params;

  if (isPayPalMock()) {
    // In mock mode, allow verification if basic required headers are present
    return Boolean(transmissionId && webhookId && transmissionSig);
  }

  let eventObject: Record<string, unknown>;
  try {
    eventObject = JSON.parse(rawBody);
  } catch (err) {
    throw new PayPalWebhookVerificationError("Malformed JSON in raw webhook body", err);
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const verificationPayload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: eventObject,
  };

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(verificationPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new PayPalWebhookVerificationError(
      `Webhook verification endpoint error: status ${response.status}`,
      errorText
    );
  }

  const data = (await response.json()) as WebhookVerificationResponse;
  return data.verification_status === "SUCCESS";
}
