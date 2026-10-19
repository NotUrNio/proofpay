import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/roles";
import { resetBundledDemoState } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== "reviewer") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Reviewer role required to reset bundled demo states" },
        { status: 403 }
      );
    }

    const { changedRows } = await resetBundledDemoState();

    return NextResponse.json({
      success: true,
      message: "Bundled demo jobs successfully restored to canonical states without deleting ledger rows",
      changedRows,
    });
  } catch (error: any) {
    console.error("[API] Failed to reset demo state:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset demo state" },
      { status: 500 }
    );
  }
}
