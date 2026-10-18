import { NextRequest, NextResponse } from "next/server";
import { db, ledgerEvents } from "@/db";
import { asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const events = await db
      .select()
      .from(ledgerEvents)
      .orderBy(desc(ledgerEvents.sequenceNumber))
      .limit(limit);

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("[API] Failed to fetch global ledger:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch global ledger" },
      { status: 500 }
    );
  }
}
