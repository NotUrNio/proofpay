"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Palette,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Loader2,
  RefreshCw,
  Check,
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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<"approve" | "reject" | null>(null);

  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const openConfirmModal = (action: "approve" | "reject") => {
    if (typeof document !== "undefined") {
      lastFocusedRef.current = document.activeElement as HTMLElement;
    }
    setShowConfirmModal(action);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(null);
    setTimeout(() => {
      lastFocusedRef.current?.focus();
    }, 0);
  };

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

  // Modal focus trap & Escape key listener
  useEffect(() => {
    if (!showConfirmModal) return;

    // Focus cancel button on open
    cancelBtnRef.current?.focus();

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirmModal();
        return;
      }

      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleModalKeyDown);
    return () => window.removeEventListener("keydown", handleModalKeyDown);
  }, [showConfirmModal]);

  const handleDecision = async (jobId: string, action: "approve" | "reject") => {
    setProcessingId(jobId);
    setShowConfirmModal(null);
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
            ? `Milestone approved. $${items[selectedIndex]?.job.amount} USD dispatched to ${items[selectedIndex]?.job.freelancerEmail} via PayPal Payouts.`
            : "Milestone rejected. Escrow funds marked for return to client."
        );
        await fetchInbox();
        if (selectedIndex >= items.length - 1) {
          setSelectedIndex(Math.max(0, items.length - 2));
        }
      } else {
        alert(data.error || "Decision failed");
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setProcessingId(null);
      setTimeout(() => {
        lastFocusedRef.current?.focus();
      }, 0);
    }
  };

  // Keyboard navigation shortcuts: J (next), K (prev), A (approve), R (reject)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showConfirmModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if ((e.key === "a" || e.key === "A") && items[selectedIndex]) {
        e.preventDefault();
        openConfirmModal("approve");
      } else if ((e.key === "r" || e.key === "R") && items[selectedIndex]) {
        e.preventDefault();
        openConfirmModal("reject");
      }
    },
    [items, selectedIndex, showConfirmModal]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeItem = items[selectedIndex] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30363D] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Reviewer Triage Inbox
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Triaging as <strong>Alex (Reviewer)</strong>. When color distance &Delta;E falls into the gray zone ([11.5, 16.0]), the Policy Guard routes deliverables here for final authorization.
          </p>
        </div>

        {/* Keyboard Shortcuts Pill & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-[#161B22] border border-[#30363D] px-2.5 py-1 rounded-md">
            <span>Shortcuts:</span>
            <kbd className="bg-[#21262D] px-1 rounded text-slate-300">J</kbd>
            <kbd className="bg-[#21262D] px-1 rounded text-slate-300">K</kbd>
            <span>nav</span>
            <kbd className="bg-[#21262D] px-1 rounded text-emerald-400">A</kbd>
            <span>approve</span>
            <kbd className="bg-[#21262D] px-1 rounded text-rose-400">R</kbd>
            <span>reject</span>
          </div>

          <button
            type="button"
            onClick={fetchInbox}
            className="p-1.5 rounded-lg bg-[#161B22] border border-[#30363D] text-slate-300 hover:text-white transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {/* Two-Pane Triage View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 rounded-xl skeleton-shimmer" />
          <div className="md:col-span-2 h-96 rounded-xl skeleton-shimmer" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Review Queue is Clear</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All submitted deliverables have passed autonomous verification or been resolved by human triage.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-semibold"
          >
            <span>Return to dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Pane: Queue List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 px-1">
              PENDING DELIVERABLES ({items.length})
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.job.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-[#21262D] border-amber-500/80 shadow-md ring-1 ring-amber-500/30"
                        : "bg-[#161B22] border-[#30363D] hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                        Gray Zone
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        ${parseFloat(item.job.amount).toFixed(2)} USD
                      </span>
                    </div>

                    <h4 className="font-semibold text-xs text-white truncate mb-1">
                      {item.job.title}
                    </h4>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Priya ({item.job.freelancerEmail.split("@")[0]})</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {item.job.id.slice(0, 8)}...
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Detailed Inspection & Decision Console */}
          {activeItem && (
            <div className="md:col-span-2 bg-[#161B22] border border-[#30363D] rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-[#30363D] pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">
                      Job #{activeItem.job.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      Needs Human Authorization
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {activeItem.job.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeItem.job.description}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-bold text-xl text-white">
                    ${parseFloat(activeItem.job.amount).toFixed(2)} {activeItem.job.currency}
                  </div>
                  <div className="text-[10px] text-slate-400">Escrow Locked</div>
                </div>
              </div>

              {/* Deliverable Image Preview (Sample Fixture / Upload) */}
              <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4 flex flex-col items-center justify-center space-y-3">
                <div className="max-h-56 max-w-sm rounded-lg overflow-hidden border border-[#30363D] bg-black/40 flex items-center justify-center">
                  <img
                    src="/demo/borderline-color.png"
                    alt="Deliverable"
                    className="max-h-56 object-contain"
                  />
                </div>
                <div className="text-xs text-slate-400 font-mono text-center">
                  1080×1080 px • image/png • Near-miss crimson warm tone (&Delta;E = 11.69)
                </div>
              </div>

              {/* Verdict Reasoning */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">
                  Model Sensor Observation:
                </span>
                <p className="text-xs text-slate-300 font-mono bg-[#0D1117] p-3 rounded-xl border border-[#21262D] leading-relaxed">
                  {activeItem.verdict.reasoning}
                </p>
              </div>

              {/* Dry-Run Consequence Box */}
              <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4 space-y-1.5 text-xs">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Dry-Run Settlement Impact:</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  If you click <strong>Approve</strong>: <strong>${parseFloat(activeItem.job.amount).toFixed(2)} USD</strong> will be released immediately to <strong>{activeItem.job.freelancerEmail}</strong> via PayPal Payouts. The Policy Guard will perform a final verification of the HMAC mandate cap and payee match prior to moving money.
                </p>
                <p className="text-slate-400 text-[11px]">
                  If you click <strong>Reject</strong>: Payout is blocked and escrow funds remain locked for client refund.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link
                  href={`/jobs/${activeItem.job.id}`}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <span>Inspect Full Job Record</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-2.5">
                  <button
                    id="inbox-reject-btn"
                    type="button"
                    onClick={() => openConfirmModal("reject")}
                    disabled={!!processingId}
                    className="bg-[#21262D] hover:bg-[#30363D] text-rose-400 border border-rose-900/60 text-xs font-semibold px-4 py-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    Reject &amp; Refund Escrow
                  </button>

                  <button
                    id="inbox-approve-btn"
                    type="button"
                    onClick={() => openConfirmModal("approve")}
                    disabled={!!processingId}
                    className="bg-[#2EA043] hover:bg-[#238636] text-white text-xs font-bold px-5 py-2 rounded-xl transition-colors shadow-md flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve &amp; Dispatch ${parseFloat(activeItem.job.amount).toFixed(2)} USD</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Irreversible Payouts */}
      {showConfirmModal && activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            ref={modalRef}
            className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 id="modal-title" className="text-base font-bold text-white">
              {showConfirmModal === "approve" ? "Confirm PayPal Payout Release" : "Confirm Deliverable Rejection"}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {showConfirmModal === "approve"
                ? `Are you sure you want to approve this milestone? This will immediately dispatch a live PayPal Payout of $${activeItem.job.amount} USD to ${activeItem.job.freelancerEmail}. This action is irreversible.`
                : `Are you sure you want to reject this deliverable? Escrow funds will not be disbursed.`}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={closeConfirmModal}
                className="px-3.5 py-2 rounded-xl bg-[#21262D] text-slate-300 hover:text-white text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => handleDecision(activeItem.job.id, showConfirmModal)}
                disabled={!!processingId}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  showConfirmModal === "approve"
                    ? "bg-[#2EA043] hover:bg-[#238636]"
                    : "bg-[#DA3633] hover:bg-rose-700"
                }`}
              >
                {processingId ? "Processing..." : showConfirmModal === "approve" ? "Confirm & Pay Out" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
