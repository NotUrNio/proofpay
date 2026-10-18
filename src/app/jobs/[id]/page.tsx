"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Upload,
  ExternalLink,
  Lock,
  History,
  FileCheck,
} from "lucide-react";

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

interface LedgerEvent {
  id: string;
  eventType: string;
  previousState: string | null;
  newState: string;
  isMock: boolean;
  actor: string;
  payload: Record<string, unknown>;
  signatureOrHash: string | null;
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
  verdict: Verdict | null;
  payments: Payment[];
  ledger: LedgerEvent[];
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

  const { job, criteria, mandate, verdict, payments, ledger, isMock } = data;

  const isFunded = job.status !== "CREATED";
  const isSettled = job.status === "SETTLED";
  const payoutPayment = payments.find((p) => p.type === "PAYOUT");

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

      {/* Pipeline Status Flow */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className={`p-3 rounded-lg border ${job.status === "CREATED" ? "bg-blue-50 border-blue-300 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
            <div className="text-xs font-semibold">1. Setup & Mandate</div>
            <div className="text-sm font-bold mt-1">Signed Mandate</div>
          </div>
          <div className={`p-3 rounded-lg border ${job.status === "FUNDED" ? "bg-blue-50 border-blue-300 text-blue-900" : isFunded ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
            <div className="text-xs font-semibold">2. Client Escrow</div>
            <div className="text-sm font-bold mt-1">{isFunded ? "✓ Funded via PayPal" : "Pending Funding"}</div>
          </div>
          <div className={`p-3 rounded-lg border ${job.status === "SUBMITTED" || job.status === "VERIFYING" ? "bg-purple-50 border-purple-300 text-purple-900" : verdict ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
            <div className="text-xs font-semibold">3. AI Verification</div>
            <div className="text-sm font-bold mt-1">{verdict ? `✓ ${verdict.overallPassed ? "Passed" : "Failed"}` : "Awaiting Work"}</div>
          </div>
          <div className={`p-3 rounded-lg border ${isSettled ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
            <div className="text-xs font-semibold">4. Guard & Payout</div>
            <div className="text-sm font-bold mt-1">{isSettled ? "✓ Paid to Freelancer" : "Pending Release"}</div>
          </div>
        </div>

        {/* Milestone Actions Panel */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Current Status:</span>{" "}
            <span className="font-mono uppercase font-bold text-blue-700">{job.status}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {job.status === "CREATED" && (
              <>
                <button
                  onClick={handleFund}
                  disabled={funding}
                  className="bg-paypal-blue hover:bg-paypal-darkblue text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  {funding ? "Connecting to PayPal..." : "Fund Escrow with PayPal (Sandbox Buyer Flow)"}
                </button>

                {isMock && (
                  <button
                    onClick={handleSimulateMockFund}
                    disabled={funding}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1.5 border border-amber-600"
                    title="Simulate funding only in offline mock mode"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Simulate Funding (MOCK MODE ONLY)
                  </button>
                )}
              </>
            )}

            {job.status === "FUNDED" && (
              <Link
                href={`/jobs/${job.id}/submit`}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Submit Deliverable (Freelancer)
              </Link>
            )}

            {isSettled && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Funds Released via PayPal Payouts
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-Column Grid: Left: Mandate & Verification, Right: Payout & Policy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Signed Mandate & Acceptance Criteria */}
        <div className="space-y-6">
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

            <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 space-y-1 border border-slate-200">
              <div><span className="text-slate-400">Payee:</span> {mandate?.payeeEmail || job.freelancerEmail}</div>
              <div><span className="text-slate-400">Max Cap:</span> ${mandate?.maxAmount || job.amount} {job.currency}</div>
              <div><span className="text-slate-400">Expires:</span> {mandate ? new Date(mandate.expiresAt).toLocaleDateString() : "N/A"}</div>
              <div className="break-all pt-1 border-t border-slate-200">
                <span className="text-slate-400">HMAC Sig:</span> {mandate?.signature ? mandate.signature.slice(0, 32) + "..." : "Generated"}
              </div>
            </div>
          </div>

          {/* Criteria List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>Acceptance Criteria Ruleset</span>
            </h3>

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
                    {c.isHardCheck ? "MANDATORY" : "RUBRIC"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Verdict & Settlement Details */}
        <div className="space-y-6">
          {/* AI Verdict Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Verification Verdict & Evidence</span>
              </h3>
              {verdict && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${verdict.overallPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  {verdict.overallPassed ? "VERIFIED PASS" : "FAIL"}
                </span>
              )}
            </div>

            {verdict ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700">Model Confidence:</span>
                  <span className="font-bold text-indigo-700 font-mono">{(parseFloat(verdict.confidence) * 100).toFixed(1)}%</span>
                </div>
                <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                  &quot;{verdict.reasoning}&quot;
                </p>

                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-semibold text-slate-700">Per-Criterion Evidence:</div>
                  {verdict.perCriteriaResults.map((r, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-slate-50 border border-slate-100 flex items-start gap-2">
                      <span className={r.passed ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {r.passed ? "✓" : "✗"}
                      </span>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{r.name}</div>
                        {r.reason && <div className="text-[11px] text-slate-500 mt-0.5">{r.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 p-6 text-center bg-slate-50 rounded-lg border border-slate-100">
                Awaiting deliverable submission to trigger verification engine.
              </div>
            )}
          </div>

          {/* PayPal Settlement Details */}
          {payoutPayment && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>PayPal Payout Settlement Complete</span>
              </div>
              <div className="text-xs font-mono text-emerald-800 space-y-1">
                <div>Payout Item / Batch ID: {payoutPayment.paypalId}</div>
                <div>Status: {payoutPayment.status}</div>
                <div>Amount: ${payoutPayment.amount} {payoutPayment.currency}</div>
                <div>Recipient: {job.freelancerEmail}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Append-Only Audit Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Append-Only Audit Ledger</h2>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-mono">
            {ledger.length} immutable events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">State Transition</th>
                <th className="px-6 py-3">Mode</th>
                <th className="px-6 py-3">Integrity SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {ledger.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(evt.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3 font-bold text-slate-800 whitespace-nowrap">
                    {evt.eventType}
                  </td>
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                    {evt.actor}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="text-slate-400">{evt.previousState || "NONE"}</span> →{" "}
                    <span className="font-semibold text-blue-700">{evt.newState}</span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    {evt.isMock ? (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                        MOCK MODE
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300">
                        REAL SANDBOX
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-400 text-[11px] max-w-xs truncate" title={evt.signatureOrHash || ""}>
                    {evt.signatureOrHash ? evt.signatureOrHash.slice(0, 16) + "..." : "GENESIS"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
