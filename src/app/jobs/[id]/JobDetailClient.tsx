"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  Upload,
  Lock,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { SignatureCheckpointRoute, CheckpointStepId } from "@/components/pipeline/SignatureCheckpointRoute";
import { VerdictInspectionPanel } from "@/components/verdict/VerdictInspectionPanel";

export interface Criterion {
  id: string;
  name: string;
  type: string;
  isHardCheck: boolean;
  ruleSpec: Record<string, unknown>;
}

export interface Mandate {
  jobId: string;
  maxAmount: string;
  currency: string;
  payeeEmail: string;
  scope: string;
  expiresAt: string | Date;
  signature: string;
}

export interface Verdict {
  overallPassed: boolean;
  confidence: string;
  reasoning: string;
  perCriteriaResults: Array<{
    name: string;
    passed: boolean;
    confidence?: number;
    reason?: string;
    evidence?: string;
  }>;
}

export interface Submission {
  id: string;
  fileUrl?: string;
  mimeType?: string;
  fileSizeBytes?: string;
  textContent?: string;
  metadata?: { width?: number; height?: number };
  createdAt: string | Date;
}

export interface Payment {
  id: string;
  type: string;
  paypalId: string | null;
  amount: string;
  currency: string;
  status: string;
  isMock: boolean;
  createdAt: string | Date;
}

export interface JobData {
  job: {
    id: string;
    title: string;
    description: string;
    clientEmail: string;
    freelancerEmail: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string | Date;
  };
  criteria: Criterion[];
  mandate: Mandate;
  submissions: Submission[];
  verdict: Verdict | null;
  payments: Payment[];
  isMock: boolean;
}

export function JobDetailClient({
  initialData,
  jobId,
}: {
  initialData?: JobData | null;
  jobId: string;
}) {
  const [data, setData] = useState<JobData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [funding, setFunding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load job", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchJob();
    }
  }, [jobId]);

  const handleFundEscrow = async () => {
    setFunding(true);
    try {
      if (typeof document !== "undefined" && !document.cookie.includes("proofpay_role=")) {
        await fetch("/api/auth/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "client" }),
        });
      }
      const res = await fetch(`/api/jobs/${jobId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_order" }),
      });
      const resData = await res.json();
      if (resData.approveUrl) {
        window.location.href = resData.approveUrl;
      } else {
        await fetchJob();
      }
    } catch (err) {
      console.error("Failed to fund escrow:", err);
    } finally {
      setFunding(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Section-by-section skeletons matching exact card heights (NO min-h-[1400px])
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6" aria-busy="true">
        {/* Top bar skeleton: 24px */}
        <div className="flex items-center justify-between h-6">
          <div className="h-4 w-32 rounded bg-[#21262D] animate-pulse" />
          <div className="h-4 w-28 rounded bg-[#21262D] animate-pulse" />
        </div>
        {/* Hero milestone card skeleton: 200px */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 h-[200px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-6 w-3/4 rounded bg-[#21262D] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[#21262D] animate-pulse" />
          </div>
          <div className="h-12 rounded-xl bg-[#0D1117] border border-[#21262D] animate-pulse" />
        </div>
        {/* Checkpoint route skeleton: 140px */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 h-[140px] flex flex-col justify-between">
          <div className="h-4 w-40 rounded bg-[#21262D] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#0D1117] border border-[#21262D] animate-pulse" />
            ))}
          </div>
        </div>
        {/* Mandate & Sandbox references skeleton: 160px */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 h-[160px] flex flex-col justify-between">
          <div className="h-4 w-48 rounded bg-[#21262D] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-16 rounded-xl bg-[#0D1117] border border-[#21262D] animate-pulse" />
            <div className="h-16 rounded-xl bg-[#0D1117] border border-[#21262D] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.job) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-3">
        <h2 className="text-xl font-bold text-white">Milestone Not Found</h2>
        <p className="text-xs text-slate-400">The requested milestone ID does not exist in the sandbox database.</p>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
        </Link>
      </div>
    );
  }

  const { job, mandate, verdict, submissions, payments } = data;

  // Determine current checkpoint step
  let currentStep: CheckpointStepId = "funded";
  if (job.status === "CREATED") currentStep = "funded";
  else if (job.status === "FUNDED") currentStep = "submitted";
  else if (job.status === "SUBMITTED") currentStep = "checked";
  else if (job.status === "VERIFYING" || job.status === "MANUAL_REVIEW" || job.status === "VERIFIED") currentStep = "guard";
  else if (job.status === "PAID" || job.status === "SETTLED") currentStep = "settled";

  // Plain-language next step guidance
  const getNextActionMessage = () => {
    switch (job.status) {
      case "CREATED":
        return "Milestone created. Alice must fund the $50.00 USD escrow via PayPal Orders to lock funds.";
      case "FUNDED":
        return "Escrow funded! Priya can now submit the final deliverable. Once submitted, verification begins immediately.";
      case "SUBMITTED":
      case "VERIFYING":
        return "Deliverable submitted. Deterministic hard checks and multimodal model sensors are actively running.";
      case "MANUAL_REVIEW":
      case "VERIFIED":
        return "Review pending. Color tolerance or ambiguity was detected. Alex will review the deliverable in the Review Inbox.";
      case "PAID":
      case "SETTLED":
        return `Milestone complete! Payout of $${parseFloat(job.amount).toFixed(2)} USD was dispatched to ${job.freelancerEmail} via PayPal Payouts.`;
      case "REJECTED":
        return "Deliverable failed contractual verification. Escrow funds remain safely locked for client refund.";
      default:
        return "Awaiting next pipeline stage.";
    }
  };

  const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6" aria-live="polite">
      {/* Back Link & Job ID */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to overview</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-400">
          Job ID: {job.id.slice(0, 8)}...
        </span>
      </div>

      {/* 1. Header Box */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {job.title}
              </h1>
              {data.isMock && (
                <span className="bg-amber-950/80 border border-amber-800 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded">
                  [SIMULATED]
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              {job.description}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="font-mono font-bold text-2xl text-white">
              ${parseFloat(job.amount).toFixed(2)} {job.currency}
            </div>
            <div className="text-[11px] text-slate-400">Protected Escrow</div>
          </div>
        </div>

        {/* What Happens Next Callout */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 flex items-start gap-3 text-xs">
          <div className="w-6 h-6 rounded-lg bg-blue-950 border border-blue-800 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5">
            <span className="font-semibold text-white block">What Happens Next:</span>
            <p className="text-slate-300 leading-relaxed">{getNextActionMessage()}</p>
          </div>
        </div>

        {/* Action Buttons for Current State */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {job.status === "CREATED" && (
            <button
              type="button"
              onClick={handleFundEscrow}
              disabled={funding}
              className="bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{funding ? "Connecting to PayPal..." : `Fund Escrow ($${job.amount} USD)`}</span>
            </button>
          )}

          {job.status === "FUNDED" && (
            <Link
              href={`/jobs/${job.id}/submit`}
              className="bg-[#2EA043] hover:bg-[#238636] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Submit Deliverable as Priya</span>
            </Link>
          )}

          {(job.status === "MANUAL_REVIEW" || job.status === "VERIFIED") && (
            <Link
              href="/inbox"
              className="bg-[#D29922] hover:bg-[#BB8009] text-black text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Triage in Review Inbox as Alex</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. Signature Checkpoint Route Component */}
      <SignatureCheckpointRoute
        currentStep={currentStep}
        statusText={`Milestone state: ${job.status}`}
      />

      {/* 3. Verdict Inspection Panel if verdict exists */}
      {verdict && (
        <VerdictInspectionPanel
          overallPassed={verdict.overallPassed}
          confidence={verdict.confidence}
          reasoning={verdict.reasoning}
          perCriteriaResults={verdict.perCriteriaResults}
          mimeType={latestSubmission?.mimeType}
          width={latestSubmission?.metadata?.width}
          height={latestSubmission?.metadata?.height}
          decision={job.status === "PAID" || job.status === "SETTLED" ? "AUTO_PAY" : job.status === "MANUAL_REVIEW" || job.status === "VERIFIED" ? "NEEDS_HUMAN" : "REJECT"}
        />
      )}

      {/* 4. Traceable Sandbox IDs (Orders, Payouts, HMAC Mandate) */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white">
          Contract Mandate & PayPal Sandbox References
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Mandate Signature */}
          <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-sans font-semibold text-slate-300">
                HMAC-SHA256 Mandate
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(mandate.signature, "mandate")}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {copiedId === "mandate" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === "mandate" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {mandate.signature}
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              Cap: ${mandate.maxAmount} {mandate.currency} • Payee: {mandate.payeeEmail}
            </div>
          </div>

          {/* PayPal Payout or Capture reference */}
          {/* PayPal Payout or Capture reference */}
          <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-sans font-semibold text-slate-300">
                  PayPal Sandbox Trace
                </span>
                {payments && payments.some((p) => p.isMock) && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-1.5 py-0.5 rounded font-sans">
                    [SIMULATED]
                  </span>
                )}
              </div>
              <a
                href="https://www.sandbox.paypal.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <span>Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Accurate Funding & Payout Real vs Simulated Disclosure */}
            {(() => {
              const funding = payments?.find((p) => p.type === "FUNDING");
              const payout = payments?.find((p) => p.type === "PAYOUT");

              if (funding && payout) {
                if (funding.isMock && !payout.isMock) {
                  return (
                    <div className="text-[10px] text-emerald-400 font-sans font-medium">
                      Funding simulated; payout is a real sandbox payout
                    </div>
                  );
                } else if (funding.isMock && payout.isMock) {
                  return (
                    <div className="text-[10px] text-amber-400 font-sans font-medium">
                      Both funding and payout are simulated (offline test mode)
                    </div>
                  );
                } else {
                  return (
                    <div className="text-[10px] text-emerald-400 font-sans font-medium">
                      Live PayPal Escrow Captured &amp; Real Payout Settled
                    </div>
                  );
                }
              } else if (funding) {
                return (
                  <div className="text-[10px] text-slate-400 font-sans font-medium">
                    {funding.isMock ? "Funding simulated (sandbox escrow locked)" : "Live PayPal Escrow Captured"}
                  </div>
                );
              }
              return (
                <div className="text-[10px] text-slate-400 font-sans">
                  Awaiting payment capture
                </div>
              );
            })()}

            <div className="text-[11px] text-slate-300 truncate">
              {payments && payments.length > 0 ? (
                <span>{payments[0].type}: {payments[0].paypalId}</span>
              ) : (
                <span className="text-slate-400">Awaiting payment capture</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              Linked via custom_id / sender_item_id
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
