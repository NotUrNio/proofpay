import { NextRequest, NextResponse } from "next/server";
import { db, policies, jobs, verdicts, submissions } from "@/db";
import { desc, eq } from "drizzle-orm";
import evalCases from "../../../../eval/cases.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [currentPolicy] = await db
      .select()
      .from(policies)
      .where(eq(policies.isActive, true))
      .orderBy(desc(policies.createdAt))
      .limit(1);

    // Default policy values if not seeded yet
    const policy = currentPolicy || {
      name: "Default Platform Security Policy",
      maxDailyPayoutAmount: "1000.00",
      maxJobPayoutAmount: "500.00",
      minConfidenceThreshold: "0.8500",
      requireHumanReviewIfAmbiguous: true,
      isActive: true,
    };

    // Load past verdicts from DB or benchmark eval set for counterfactual preview
    const dbVerdicts = await db.select().from(verdicts);
    const dbJobs = await db.select().from(jobs);

    return NextResponse.json({
      success: true,
      policy,
      benchmarkCases: evalCases,
      pastJobsCount: dbJobs.length,
    });
  } catch (error) {
    console.error("[Policy API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch policy configuration" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name = "Updated Security Policy",
      maxDailyPayoutAmount = "1000.00",
      maxJobPayoutAmount = "500.00",
      minConfidenceThreshold = "0.8500",
      requireHumanReviewIfAmbiguous = true,
    } = body;

    // Deactivate previous policies
    await db.update(policies).set({ isActive: false }).where(eq(policies.isActive, true));

    // Insert new policy
    const [newPolicy] = await db
      .insert(policies)
      .values({
        name,
        maxDailyPayoutAmount: String(maxDailyPayoutAmount),
        maxJobPayoutAmount: String(maxJobPayoutAmount),
        minConfidenceThreshold: String(minConfidenceThreshold),
        requireHumanReviewIfAmbiguous: Boolean(requireHumanReviewIfAmbiguous),
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      policy: newPolicy,
    });
  } catch (error) {
    console.error("[Policy API] Update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update policy" },
      { status: 500 }
    );
  }
}
