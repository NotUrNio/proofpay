import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight health check endpoint for Render, load balancers, and monitoring.
 * Zero database queries, zero authentication, zero side effects.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "proofpay",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}

