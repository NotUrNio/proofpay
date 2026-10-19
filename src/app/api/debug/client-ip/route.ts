import { NextRequest, NextResponse } from "next/server";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { getClientIpDetails } from "@/lib/rate-limit";

/**
 * Reviewer-only diagnostic route to verify client IP derivation behind Render proxy.
 * Checks connecting IP, header source, and multi-hop forwarding safely.
 */
export async function GET(req: NextRequest) {
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const details = getClientIpDetails(req);

  return NextResponse.json({
    success: true,
    clientIp: details.ip,
    sourceHeader: details.sourceHeader,
    rawHeaderValue: details.rawHeaderValue || null,
    isPrivate: details.isPrivate,
    allForwardingHeaders: {
      "cf-connecting-ip": req.headers.get("cf-connecting-ip"),
      "x-forwarded-for": req.headers.get("x-forwarded-for"),
      "x-real-ip": req.headers.get("x-real-ip"),
    },
    message: `Connecting client IP derived as '${details.ip}' via '${details.sourceHeader}'.`,
  });
}

