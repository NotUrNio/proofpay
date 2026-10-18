import { NextRequest, NextResponse } from "next/server";
import { db, jobs, criteria, mandates, submissions, verdicts, payments } from "@/db";
import { getJobLedger } from "@/db/ledger";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobCriteria = await db.select().from(criteria).where(eq(criteria.jobId, id));
    const [mandate] = await db.select().from(mandates).where(eq(mandates.jobId, id)).limit(1);
    const jobSubmissions = await db.select().from(submissions).where(eq(submissions.jobId, id)).orderBy(desc(submissions.createdAt));
    const latestSubmission = jobSubmissions[0] || null;

    let latestVerdict = null;
    if (latestSubmission) {
      const [v] = await db.select().from(verdicts).where(eq(verdicts.submissionId, latestSubmission.id)).limit(1);
      latestVerdict = v || null;
    }

    const jobPayments = await db.select().from(payments).where(eq(payments.jobId, id)).orderBy(desc(payments.createdAt));
    const ledger = await getJobLedger(id);

    return NextResponse.json({
      job,
      criteria: jobCriteria,
      mandate,
      submissions: jobSubmissions,
      verdict: latestVerdict,
      payments: jobPayments,
      ledger,
      isMock: process.env.PAYPAL_MOCK === "true",
    });
  } catch (err) {
    console.error("[API] Failed to get job:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
