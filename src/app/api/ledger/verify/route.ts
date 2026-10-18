import { NextRequest, NextResponse } from "next/server";
import { verifyLedgerChain } from "@/db/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId") || undefined;

    const result = await verifyLedgerChain(jobId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[API] Ledger verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ledger verification failed",
      },
      { status: 500 }
    );
  }
}

