"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Upload,
  Lock,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import { LivePipelineBoard } from "@/components/pipeline/LivePipelineBoard";
import { VerdictInspectionPanel } from "@/components/verdict/VerdictInspectionPanel";
import { AgGridLedger, LedgerRowData } from "@/components/ledger/AgGridLedger";

interface Criterion {
  id: string;
  name: string;
  type: string;
  isHardCheck: boolean;
  ruleSpec: Record<string, unknown>;
}

interface Mandate {
  jobId: string;
  maxAmount: string;
  currency: string;
  payeeEmail: string;
  scope: string;
  expiresAt: string;
  signature: string;
}

interface Verdict {
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

interface Submission {
  id: string;
  fileUrl?: string;
  mimeType?: string;
  fileSizeBytes?: string;
  textContent?: string;
  metadata?: { width?: number; height?: number };
  createdAt: string;
}

interface Payment {
  id: string;
  type: string;
  paypalId: string;
  amount: string;
  currency: string;
  status: string;
  isMock: boolean;
  createdAt: string;
}

interface JobData {
  job: {
    id: string;
    title: string;
    description: string;
    clientEmail: string;
    freelancerEmail: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  };
  criteria: Criterion[];
  mandate: Mandate;
  submissions: Submission[];
  verdict: Verdict | null;
  payments: Payment[];
  ledger: LedgerRowData[];
  isMock: boolean;
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${id}`);
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
    fetchJob();

    // Check if returning from PayPal Sandbox buyer approval flow
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");
      const fundedParam = searchParams.get("funded");

      if (token && fundedParam === "true") {
        setFunding(true);
        fetch(`/api/jobs/${id}/fund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "capture", orderId: token }),
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.success) {
              window.history.replaceState({}, document.title, `/jobs/${id}`);
              fetchJob();
            }
          })
          .catch((err) => console.error("Capture callback error:", err))
          .finally(() => setFunding(false));
      }
    }
  }, [id]);

  const handleFund = async () => {
    setFunding(true);
    try {
      const res = await fetch(`/api/jobs/${id}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto" }),
      });
      const result = await res.json();
      if (result.approveUrl) {
        window.location.href = result.approveUrl;
      } else {
        await fetchJob();
      }
    } catch (err) {
      console.error("Funding error", err);
    } finally {
      setFunding(false);
    }
  };

  const handleSimulateMockFund = async () => {
    setFunding(true);
    try {
      const res = await fetch(`/api/jobs/${id}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mock_fund" }),
      });
      const result = await res.json();
      if (result.error) {
        alert(result.error);
      } else {
        await fetchJob();
      }
    } catch (err) {
      console.error("Simulated funding error", err);
    } finally {
      setFunding(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Loading milestone details...</div>;
  }

  if (!data || !data.job) {
    return <div className="p-12 text-center text-rose-500 text-sm">Milestone not found</div>;
  }

  const { job, criteria, mandate, submissions, verdict, payments, ledger, isMock } = data;
  const isFunded = job.status !== "CREATED";
  const isSettled = ["PAID", "SETTLED"].includes(job.status);
  const latestSub = submissions && submissions.length > 0 ? submissions[0] : null;

  // Find PayPal IDs from payments or ledger events
  const orderPayment = payments.find((p) => p.type === "ORDER");
  const payoutPayment = payments.find((p) => p.type === "PAYOUT");
  const fundedEvent = ledger.find((e) => e.eventType === "JOB_FUNDED");
  const payoutEvent = ledger.find((e) => e.eventType === "PAYOUT_RELEASED" || e.eventType === "PAYOUT_INITIATED");

  const captureId = (fundedEvent?.payload?.captureId as string) || (orderPayment?.paypalId as string);
  const orderId = (fundedEvent?.payload?.orderId as string) || (orderPayment?.paypalId as string);
  const payoutId = (payoutEvent?.payload?.payoutItemId as string) || (payoutPayment?.paypalId as string);
  const payoutBatchId = (payoutEvent?.payload?.payoutBatchId as string);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-black text-slate-900">{job.title}</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Milestone UUID: {job.id}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-semibold uppercase">Escrow Value</div>
            <div className="text-2xl font-extrabold text-blue-700">${job.amount} {job.currency}</div>
          </div>
        </div>
      </div>

      {/* 1. Live Pipeline Board */}
      <LivePipelineBoard
        status={job.status}
        orderId={orderId}
        captureId={captureId}
        payoutId={payoutId}
        payoutBatchId={payoutBatchId}
        confidence={verdict?.confidence}
        amount={job.amount}
        currency={job.currency}
        freelancerEmail={job.freelancerEmail}
        fileName={latestSub?.fileUrl ? latestSub.fileUrl.split("/").pop() : undefined}
        guardDecision={verdict?.overallPassed ? "AUTO_PAY" : "NEEDS_HUMAN"}
        jobId={job.id}
      />

      {/* Action Bar for Funding / Submission */}
      {(!isFunded || (job.status === "FUNDED" && !latestSub)) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <strong className="text-slate-900">Next Action Required:</strong>{" "}
            {!isFunded
              ? "Client needs to authorize and capture PayPal escrow deposit."
              : "Freelancer needs to upload project deliverable."}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isFunded && (
              <>
                <button
                  onClick={handleFund}
                  disabled={funding}
                  className="bg-paypal-blue hover:bg-paypal-darkblue text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  <DollarSign className="w-4 h-4" />
                  {funding ? "Connecting to PayPal..." : "Fund Escrow via PayPal (Buyer Approval)"}
                </button>

                {isMock && (
                  <button
                    onClick={handleSimulateMockFund}
                    disabled={funding}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1 border border-amber-600"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Simulate Funding (MOCK)
                  </button>
                )}
              </>
            )}

            {job.status === "FUNDED" && (
              <Link
                href={`/jobs/${job.id}/submit`}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Deliverable (Freelancer)</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 2. Verdict Inspection Panel (when verdict exists) */}
      {verdict && (
        <VerdictInspectionPanel
          overallPassed={verdict.overallPassed}
          confidence={verdict.confidence}
          reasoning={verdict.reasoning}
          perCriteriaResults={verdict.perCriteriaResults}
          deliverableUrl={latestSub?.fileUrl}
          deliverableText={latestSub?.textContent}
          mimeType={latestSub?.mimeType}
          fileSizeBytes={latestSub?.fileSizeBytes}
          width={latestSub?.metadata?.width}
          height={latestSub?.metadata?.height}
          decision={verdict.overallPassed ? "AUTO_PAY" : "NEEDS_HUMAN"}
        />
      )}

      {/* 3. Signed Security Mandate & Acceptance Criteria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mandate Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>HMAC-SHA256 Signed Intent Mandate</span>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded border border-indigo-200">
              Security Mandate
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3.5 text-xs font-mono text-slate-700 space-y-1.5 border border-slate-200">
            <div><span className="text-slate-400">Payee:</span> {mandate?.payeeEmail || job.freelancerEmail}</div>
            <div><span className="text-slate-400">Max Mandate Cap:</span> ${mandate?.maxAmount || job.amount} {job.currency}</div>
            <div><span className="text-slate-400">Expires:</span> {mandate ? new Date(mandate.expiresAt).toLocaleDateString() : "N/A"}</div>
            <div className="break-all pt-1.5 border-t border-slate-200">
              <span className="text-slate-400">Cryptographic Sig:</span>{" "}
              <span className="text-indigo-600 font-bold">{mandate?.signature ? mandate.signature.slice(0, 36) + "..." : "Generated"}</span>
            </div>
          </div>
        </div>

        {/* Criteria List */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>Job Acceptance Ruleset ({criteria.length})</span>
            </h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-mono px-2 py-0.5 rounded border border-blue-200">
              Contract Specification
            </span>
          </div>

          <div className="space-y-2">
            {criteria.map((c) => (
              <div key={c.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-start justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Type: {c.type} {c.isHardCheck && "• Deterministic Hard Check"}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.isHardCheck ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                  {c.isHardCheck ? "HARD CHECK" : "RUBRIC"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. AG Grid Interactive Audit Ledger */}
      <AgGridLedger events={ledger} jobId={job.id} onRefresh={fetchJob} />
    </div>
  );
}
