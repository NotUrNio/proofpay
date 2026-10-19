#!/usr/bin/env bash
# scripts/check-client-ip.sh
# Diagnostic script to check client IP resolution and proxy trust hops on ProofPay
# Usage:
#   ./scripts/check-client-ip.sh [BASE_URL]
# Example:
#   ./scripts/check-client-ip.sh https://proofpay.onrender.com

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"
ENDPOINT="${BASE_URL}/api/debug/client-ip"

echo "Checking ProofPay client IP resolution on: ${ENDPOINT}"
echo "--------------------------------------------------------"

HTTP_STATUS=$(curl -s -o /tmp/client_ip_response.json -w "%{http_code}" -H "Cookie: proofpay_role=reviewer" "${ENDPOINT}")

if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "ERROR: Request failed with HTTP status ${HTTP_STATUS}"
  if [ -f /tmp/client_ip_response.json ]; then
    cat /tmp/client_ip_response.json
    echo ""
  fi
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  cat /tmp/client_ip_response.json | jq '{
    derivedIp: .derivedIp,
    rule: .rule,
    cloudflareVerified: .cloudflareVerified,
    hopList: .hopList,
    trustedProxyHopsConfigured: .trustedProxyHopsConfigured
  }'
else
  cat /tmp/client_ip_response.json
  echo ""
fi

echo "--------------------------------------------------------"
echo "Status: OK (HTTP 200)"
