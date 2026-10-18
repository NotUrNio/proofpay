import { NextRequest, NextResponse } from "next/server";
import { db, policies, jobs, verdicts, mandates } from "@/db";
import { desc, eq, gt } from "drizzle-orm";
import { assertAuthorizedRole } from "@/lib/auth/roles";
import { z } from "zod";
import evalCases from "../../../../eval/cases.json";

export const dynamic = "force-dynamic";

const policySchema = z.object({
  name: z.string().min(1).max(100).default("Updated Security Policy"),
  maxDailyPayoutAmount: z.coerce.number().positive().max(10000),
  maxJobPayoutAmount: z.coerce.number().positive().max(5000),
  minConfidenceThreshold: z.coerce.number().min(0.5).max(1.0),
  requireHumanReviewIfAmbiguous: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  // Role check: Reviewers can view policy configuration
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  try {
    const [currentPolicy] = await db
      .select()
      .from(policies)
      .where(eq(policies.isActive, true))
      .orderBy(desc(policies.createdAt))
      .limit(1);

    const policy = currentPolicy || {
      name: "Default Platform Security Policy",
      maxDailyPayoutAmount: "1000.00",
      maxJobPayoutAmount: "500.00",
      minConfidenceThreshold: "0.8500",
      requireHumanReviewIfAmbiguous: true,
      isActive: true,
    };

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
  // Server-side role check: Only reviewer can edit platform policy
  const auth = assertAuthorizedRole(req, ["reviewer"]);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = policySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid policy parameters",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      name,
      maxDailyPayoutAmount,
      maxJobPayoutAmount,
      minConfidenceThreshold,
      requireHumanReviewIfAmbiguous,
    } = parseResult.data;

    // Hard Constraint: Policy edits can NEVER exceed any active signed mandate's maxAmount cap
    const activeMandates = await db
      .select()
      .from(mandates)
      .where(gt(mandates.expiresAt, new Date()));

    if (activeMandates.length > 0) {
      const minMandateCap = Math.min(
        ...activeMandates.map((m) => parseFloat(m.maxAmount))
      );
      if (maxJobPayoutAmount > minMandateCap) {
        return NextResponse.json(
          {
            error: `Policy violation: maxJobPayoutAmount ($${maxJobPayoutAmount.toFixed(
              2
            )}) cannot exceed the active signed mandate cap ($${minMandateCap.toFixed(
              2
            )}). Signed client mandates represent immutable financial limits.`,
            mandateCap: minMandateCap,
            requestedAmount: maxJobPayoutAmount,
          },
          { status: 400 }
        );
      }
    }

    // Deactivate previous active policies
    await db.update(policies).set({ isActive: false }).where(eq(policies.isActive, true));

    // Insert new policy version
    const [newPolicy] = await db
      .insert(policies)
      .values({
        name,
        maxDailyPayoutAmount: maxDailyPayoutAmount.toFixed(2),
        maxJobPayoutAmount: maxJobPayoutAmount.toFixed(2),
        minConfidenceThreshold: minConfidenceThreshold.toFixed(4),
        requireHumanReviewIfAmbiguous,
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
