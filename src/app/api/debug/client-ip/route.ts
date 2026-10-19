import { NextRequest, NextResponse } from "next/server";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { getClientIpDetails } from "@/lib/rate-limit";

// TODO(remove-after-hosted-verification): Remove /api/debug/client-ip after the project owner
// verifies hosted client IP derivation and rate-limit isolation from two distinct networks.
/**
 * Reviewer-only diagnostic route to verify client IP derivation behind Render/Cloudflare proxy.
 * Checks connecting IP, header source, Cloudflare verification, and multi-hop forwarding safely.
 */
export async function GET(req: NextRequest) {
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const details = getClientIpDetails(req);

  return NextResponse.json({
    success: true,
    derivedIp: details.ip,
    clientIp: details.ip,
    rule: details.rule,
    sourceHeader: details.sourceHeader,
    cloudflareVerified: details.cloudflareVerified,
    hopList: details.hopList,
    trustedProxyHops: details.trustedProxyHops,
    rawHeaderValue: details.rawHeaderValue || null,
    isPrivate: details.isPrivate,
    allForwardingHeaders: {
      "cf-ray": req.headers.get("cf-ray"),
      "cf-connecting-ip": req.headers.get("cf-connecting-ip"),
      "true-client-ip": req.headers.get("true-client-ip"),
      "x-forwarded-for": req.headers.get("x-forwarded-for"),
      "x-real-ip": req.headers.get("x-real-ip"),
    },
    message: `Connecting client IP derived as '${details.ip}' via rule '${details.rule}' (source='${details.sourceHeader}', cloudflareVerified=${details.cloudflareVerified}, trustedProxyHops=${details.trustedProxyHops}).`,
  });
}
