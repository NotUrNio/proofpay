import { NextRequest, NextResponse } from "next/server";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { getAnalyticsData } from "@/lib/analytics";
import { ensureDatabaseSchema } from "@/db/init";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDatabaseSchema();

  // Access rule matches /studio: available to all authenticated personas (client, freelancer, reviewer)
  const auth = assertAuthorizedRole(req, ["client", "freelancer", "reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  try {
    const data = await getAnalyticsData();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Analytics API] Aggregation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to compute analytics aggregation",
        message: error.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
