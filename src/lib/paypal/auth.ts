import { CachedToken, OAuthTokenResponse } from "./types";
import { PayPalAuthError, PayPalConfigError } from "./errors";

let tokenCache: CachedToken | null = null;

export function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
}

export function isPayPalMock(): boolean {
  return process.env.PAYPAL_MOCK === "true";
}

export function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const isMock = isPayPalMock();

  if (!isMock && (!clientId || !clientSecret || clientId.includes("your_sandbox_") || clientSecret.includes("your_sandbox_"))) {
    throw new PayPalConfigError(
      "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing or contains placeholder values. " +
      "Provide valid sandbox credentials in .env, or explicitly set PAYPAL_MOCK=true for offline simulation."
    );
  }

  return {
    clientId: clientId || "mock-client-id",
    clientSecret: clientSecret || "mock-client-secret",
    baseUrl: getPayPalBaseUrl(),
    isMock,
  };
}

/**
 * Fetch and cache an OAuth2 Bearer token from PayPal Sandbox.
 * Automatically refreshes if token is missing, expired, or expiring in the next 5 minutes.
 */
export async function getPayPalAccessToken(forceRefresh = false): Promise<string> {
  const { clientId, clientSecret, baseUrl, isMock } = getPayPalCredentials();

  if (isMock) {
    return "MOCK_PAYPAL_ACCESS_TOKEN_" + Date.now();
  }

  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minute safety buffer

  if (!forceRefresh && tokenCache && tokenCache.expiresAt > now + bufferMs) {
    return tokenCache.accessToken;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "Accept-Language": "en_US",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: unknown;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      errorJson = errorText;
    }
    throw new PayPalAuthError(`Status ${response.status}: ${response.statusText}`, errorJson);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

/**
 * Force an immediate token refresh (bypassing cache), returning details for diagnostics.
 */
export async function forceRefreshToken(): Promise<{ accessToken: string; expiresIn: number; expiresAt: Date }> {
  const { clientId, clientSecret, baseUrl, isMock } = getPayPalCredentials();

  if (isMock) {
    return {
      accessToken: "MOCK_PAYPAL_ACCESS_TOKEN_" + Date.now(),
      expiresIn: 32400,
      expiresAt: new Date(Date.now() + 32400 * 1000),
    };
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new PayPalAuthError(`Failed to refresh token: status ${response.status}`, errorText);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return {
    accessToken: tokenCache.accessToken,
    expiresIn: data.expires_in,
    expiresAt: new Date(tokenCache.expiresAt),
  };
}
