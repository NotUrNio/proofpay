import { NextRequest, NextResponse } from "next/server";
import { runChaosDrill } from "@/lib/paypal/chaos";
import { assertAuthorizedRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Role check: Only reviewers can trigger failure chaos drills
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  try {
    const body = await req.json();
    const { drillType, jobId } = body;

    if (!drillType) {
      return NextResponse.json({ error: "Missing drillType" }, { status: 400 });
    }

    const result = await runChaosDrill(drillType, jobId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[Chaos API] Drill error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Chaos drill failed",
      },
      { status: 500 }
    );
  }
}
