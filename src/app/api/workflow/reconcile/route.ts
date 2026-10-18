import { NextRequest, NextResponse } from "next/server";
import { reconcileJobPayoutWorkflow } from "@/lib/workflow/retry";
import { db, jobs } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/workflow/reconcile
 * Trigger asynchronous payout reconciliation workflow for a given job.
 * Suitable for Render cron jobs, background workers, or polling hooks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required for payout reconciliation" },
        { status: 400 }
      );
    }

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const result = await reconcileJobPayoutWorkflow(jobId);

    return NextResponse.json({
      success: true,
      jobId,
      reconciliation: result,
      jobStatus: job.status,
    });
  } catch (error: any) {
    console.error("[Workflow Reconcile Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to reconcile payout status" },
      { status: 500 }
    );
  }
}
