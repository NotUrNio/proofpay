import { NextRequest, NextResponse } from "next/server";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { resetBundledDemoState } from "@/lib/bootstrap";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Gate with ENABLE_DEMO_RESET=true (default off, set-manually in render.yaml)
    if (process.env.ENABLE_DEMO_RESET !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Not Found: Demo state reset is disabled (ENABLE_DEMO_RESET is not set to 'true')",
        },
        { status: 404 }
      );
    }

    // 2. Strict rate limit: max 5 reset requests per minute per IP
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`demo_reset_${clientIp}`, 5, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimit.reason || "Too many demo reset requests. Please wait 60 seconds.",
        },
        { status: 429 }
      );
    }

    // 3. Role authorization: requires explicit reviewer role credential (no cookie -> 403; client/freelancer -> 403)
    const auth = assertAuthorizedRole(req, ["reviewer"]);
    if ("errorResponse" in auth) {
      return auth.errorResponse;
    }

    // 4. Perform idempotent state reset and append DEMO_STATE_RESET ledger event
    const { changedRows, ledgerEventId } = await resetBundledDemoState();

    return NextResponse.json({
      success: true,
      message: "Bundled demo jobs successfully restored to canonical states without deleting ledger rows",
      changedRows,
      ledgerEventId,
    });
  } catch (error: any) {
    console.error("[API] Failed to reset demo state:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset demo state" },
      { status: 500 }
    );
  }
}
