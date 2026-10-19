import { NextResponse } from "next/server";
import { db, jobs, payments, approvals, verdicts, submissions } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allJobs = await db.select().from(jobs);
    const allPayments = await db.select().from(payments);

    // Escrow: sum of jobs that are FUNDED, SUBMITTED, VERIFYING, or VERIFIED (not yet settled/paid)
    let escrowBalance = 0;
    // Settled: sum of completed payouts
    let freelancerSettled = 0;
    // Client deposited
    let clientDeposited = 0;

    for (const job of allJobs) {
      const amt = parseFloat(job.amount) || 0;
      if (["FUNDED", "SUBMITTED", "VERIFYING", "VERIFIED", "MANUAL_REVIEW"].includes(job.status)) {
        escrowBalance += amt;
      }
      if (["PAID", "SETTLED"].includes(job.status)) {
        freelancerSettled += amt;
      }
      if (job.status !== "CREATED") {
        clientDeposited += amt;
      }
    }

    // Pending review count: jobs in MANUAL_REVIEW or jobs with verdicts where confidence < 0.85 and status is VERIFIED
    const pendingReviews = allJobs.filter(
      (j) => j.status === "MANUAL_REVIEW" || j.status === "VERIFIED"
    ).length;

    return NextResponse.json({
      success: true,
      clientDeposited: clientDeposited.toFixed(2),
      escrowBalance: escrowBalance.toFixed(2),
      freelancerSettled: freelancerSettled.toFixed(2),
      activeJobsCount: allJobs.length,
      pendingReviewsCount: pendingReviews,
      currency: "USD",
      businessAccount: "client@example.test",
      freelancerAccount: "freelancer@example.test",
    });
  } catch (error) {
    console.error("[Stats] Failed to compute money flow:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate money flow metrics" },
      { status: 500 }
    );
  }
}

