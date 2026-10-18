"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Building2,
  DollarSign,
  Palette,
  ExternalLink,
} from "lucide-react";

interface InboxItem {
  job: {
    id: string;
    title: string;
    description: string;
    clientEmail: string;
    freelancerEmail: string;
    amount: string;
    currency: string;
    status: string;
  };
  submission: {
    id: string;
    fileUrl?: string;
    textContent?: string;
    fileSizeBytes?: string;
    metadata?: { width?: number; height?: number };
  };
  verdict: {
    id: string;
    overallPassed: boolean;
    confidence: string;
    reasoning: string;
    perCriteriaResults: Array<{
      name: string;
      passed: boolean;
      reason?: string;
    }>;
  };
  mandate?: {
    maxAmount: string;
    expiresAt: string;
  };
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchInbox = async () => {
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("Failed to load inbox items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleDecision = async (jobId: string, action: "approve" | "reject") => {
    setProcessingId(jobId);
    setActionMessage(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(
          action === "approve"
            ? `Milestone successfully approved! Instant PayPal Payout released (Batch: ${data.payoutBatchId || "Confirmed"}).`
            : "Milestone rejected and escrow marked for client return."
        );
        await fetchInbox();
      } else {
        alert(data.error || "Decision failed");
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Human-in-the-Loop Review Inbox
          </div>
          <h1 className="text-3xl font-black text-slate-900">Borderline Decision Queue</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            When deliverables land in borderline confidence thresholds (such as CIEDE2000 color distance ΔE₀₀ in the [11.5, 16.0] review zone), the Zero-LLM Policy Guard halts auto-settlement and routes the deliverable here for human review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInbox}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading review inbox...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Inbox Zero!</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              All active deliverables have passed autonomous verification and settled, or there are no borderline review cases pending.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
            >
              <span>View Milestone Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(({ job, submission, verdict, mandate }) => (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 hover:border-slate-300 transition-all"
            >
              {/* Item Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
                    <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                      NEEDS_HUMAN
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Job ID: {job.id.slice(0, 8)}...</span>
                    <span>Client: {job.clientEmail}</span>
                    <span>Freelancer: {job.freelancerEmail}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Escrow Value</div>
                  <div className="text-xl font-extrabold text-blue-700">
                    ${job.amount} {job.currency}
                  </div>
                </div>
              </div>

              {/* Review Reason & Deliverable Inspection */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Left: Deliverable Thumbnail */}
                <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center">
                  {submission.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={submission.fileUrl}
                      alt="Deliverable submission"
                      className="max-h-48 object-contain rounded-lg shadow-xs"
                    />
                  ) : (
                    <div className="p-4 text-xs text-slate-500 italic text-center">
                      &quot;{submission.textContent || "No text deliverable"}&quot;
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-slate-500 mt-2">
                    {submission.metadata?.width && submission.metadata?.height
                      ? `${submission.metadata.width}×${submission.metadata.height} px`
                      : "1080×1080 px"}
                  </div>
                </div>

                {/* Right: Reason & Per-Criteria Results */}
                <div className="md:col-span-8 space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Why Human Review was Triggered:</span>
                      </span>
                      <span className="font-mono text-xs bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Confidence: {(parseFloat(verdict.confidence) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed italic">
                      &quot;{verdict.reasoning}&quot;
                    </p>
                  </div>

                  {/* Criteria summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {verdict.perCriteriaResults.map((r, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border flex items-center justify-between ${
                          r.passed
                            ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                            : "bg-amber-50/60 border-amber-200 text-amber-950"
                        }`}
                      >
                        <span className="font-semibold truncate pr-2">{r.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            r.passed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {r.passed ? "PASS" : "REVIEW"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <span>View Full Details &amp; AG Grid Ledger</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDecision(job.id, "reject")}
                    disabled={processingId === job.id}
                    className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
                  >
                    Reject &amp; Refund Escrow
                  </button>

                  <button
                    onClick={() => handleDecision(job.id, "approve")}
                    disabled={processingId === job.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {processingId === job.id
                        ? "Triggering PayPal Payout..."
                        : `Approve Payout ($${job.amount} via PayPal)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
