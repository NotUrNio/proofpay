import { db, jobs, criteria, mandates, submissions, verdicts, payments } from "@/db";
import { eq, desc } from "drizzle-orm";
import { JobDetailClient } from "./JobDetailClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      return {
        title: "Milestone Details — ProofPay",
        description: "Autonomous milestone escrow and cryptographic verification details.",
      };
    }
    return {
      title: `${job.title} — ProofPay Milestone`,
      description: job.description || "ProofPay autonomous escrow milestone details and checkpoint verification.",
    };
  } catch (err) {
    return {
      title: "Milestone Details — ProofPay",
      description: "ProofPay milestone escrow details.",
    };
  }
}

import { cookies } from "next/headers";
import { ROLE_COOKIE_NAME, DEMO_USERS, UserRole, canUserAccessJob } from "@/lib/auth/roles";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const cookieStore = await cookies();
    const roleValue = (cookieStore.get(ROLE_COOKIE_NAME)?.value || "reviewer") as UserRole;
    const user = DEMO_USERS[roleValue] || DEMO_USERS.reviewer;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      return <JobDetailClient initialData={null} jobId={id} />;
    }

    // Enforce role and ownership authorization
    if (!canUserAccessJob(user, job)) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-rose-900/60 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">403: Access Denied</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Signed in as <strong>{user.name}</strong>. You do not own this private milestone and are not designated as its recipient or reviewer.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 bg-[#21262D] hover:bg-[#30363D] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const jobCriteria = await db.select().from(criteria).where(eq(criteria.jobId, id));
    const [mandate] = await db.select().from(mandates).where(eq(mandates.jobId, id)).limit(1);
    const jobSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.jobId, id))
      .orderBy(desc(submissions.createdAt));
    const latestSubmission = jobSubmissions[0] || null;

    let latestVerdict = null;
    if (latestSubmission) {
      const [v] = await db
        .select()
        .from(verdicts)
        .where(eq(verdicts.submissionId, latestSubmission.id))
        .limit(1);
      latestVerdict = v || null;
    }

    const jobPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.jobId, id))
      .orderBy(desc(payments.createdAt));

    const initialData = {
      job: {
        ...job,
        createdAt: job.createdAt.toISOString(),
      },
      criteria: jobCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        isHardCheck: c.isHardCheck,
        ruleSpec: (c.ruleSpec as Record<string, unknown>) || {},
      })),
      mandate: mandate
        ? {
            jobId: mandate.jobId,
            maxAmount: mandate.maxAmount,
            currency: mandate.currency,
            payeeEmail: mandate.payeeEmail,
            scope: mandate.scope,
            expiresAt: mandate.expiresAt.toISOString(),
            signature: mandate.signature,
          }
        : {
            jobId: id,
            maxAmount: job.amount,
            currency: job.currency,
            payeeEmail: job.freelancerEmail,
            scope: "default",
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            signature: "UNSET",
          },
      submissions: jobSubmissions.map((s) => ({
        id: s.id,
        fileUrl: s.fileUrl || undefined,
        mimeType: s.mimeType || undefined,
        fileSizeBytes: s.fileSizeBytes || undefined,
        textContent: s.textContent || undefined,
        metadata: (s.metadata as { width?: number; height?: number }) || undefined,
        createdAt: s.createdAt.toISOString(),
      })),
      verdict: latestVerdict
        ? {
            overallPassed: latestVerdict.overallPassed,
            confidence: latestVerdict.confidence,
            reasoning: latestVerdict.reasoning,
            perCriteriaResults: (latestVerdict.perCriteriaResults as any) || [],
          }
        : null,
      payments: jobPayments.map((p) => ({
        id: p.id,
        type: p.type,
        paypalId: p.paypalId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        isMock: p.isMock,
        createdAt: p.createdAt.toISOString(),
      })),
      isMock: process.env.PAYPAL_MOCK === "true",
    };

    return <JobDetailClient initialData={initialData} jobId={id} />;
  } catch (err) {
    console.error("Error loading job on server:", err);
    return <JobDetailClient initialData={null} jobId={id} />;
  }
}
