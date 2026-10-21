"use client";

import { CheckCircle2, Clock, DollarSign, Shield, Sparkles, AlertTriangle, ArrowRight, Upload, Lock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { maskEmail } from "@/lib/ledger-display";

export interface PipelineStageProps {
  status: string; // CREATED, FUNDED, SUBMITTED, VERIFYING, VERIFIED, PAID, SETTLED, MANUAL_REVIEW, REJECTED
  orderId?: string;
  captureId?: string;
  payoutId?: string;
  payoutBatchId?: string;
  confidence?: string;
  amount: string;
  currency: string;
  freelancerEmail: string;
  fileName?: string;
  guardDecision?: string; // AUTO_PAY | NEEDS_HUMAN | REJECT
  jobId: string;
}

export function LivePipelineBoard({
  status,
  orderId,
  captureId,
  payoutId,
  payoutBatchId,
  confidence,
  amount,
  currency,
  freelancerEmail,
  fileName,
  guardDecision,
  jobId,
}: PipelineStageProps) {
  // Determine active stage (1 to 5)
  // 1: FUNDED
  // 2: SUBMITTED
  // 3: VERIFYING
  // 4: GUARD
  // 5: PAID / SETTLED
  const isCreated = status === "CREATED";
  const isFunded = ["FUNDED", "SUBMITTED", "VERIFYING", "VERIFIED", "PAID", "SETTLED", "MANUAL_REVIEW"].includes(status);
  const isSubmitted = ["SUBMITTED", "VERIFYING", "VERIFIED", "PAID", "SETTLED", "MANUAL_REVIEW"].includes(status);
  const isVerifying = ["VERIFYING", "VERIFIED", "PAID", "SETTLED", "MANUAL_REVIEW"].includes(status);
  const isGuard = ["VERIFIED", "PAID", "SETTLED", "MANUAL_REVIEW"].includes(status);
  const isPaid = ["PAID", "SETTLED"].includes(status);
  const isManualReview = status === "MANUAL_REVIEW" || (status === "VERIFIED" && guardDecision === "NEEDS_HUMAN");

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
            <h2 className="text-base font-bold text-slate-900">Autonomous Escrow Pipeline</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            End-to-end execution: PayPal Escrow Capture → AI Sensor → Policy Guard → Instant Payout
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Settled &amp; Paid Out (${amount} {currency})
            </span>
          ) : isManualReview ? (
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              In Human Review Queue
            </Link>
          ) : isVerifying && !isGuard ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Sensor Evaluating...
            </span>
          ) : isFunded && !isSubmitted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Funded • Awaiting Deliverable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
              <Clock className="w-4 h-4 text-slate-500" />
              Pending Client Escrow
            </span>
          )}
        </div>
      </div>

      {/* 5-Step Visual Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Step 1: Funded */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isFunded
              ? "bg-blue-50/80 border-blue-200 shadow-sm"
              : isCreated
              ? "bg-white border-blue-400 ring-2 ring-blue-100"
              : "bg-slate-50 border-slate-200 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-blue-900">1. Client Escrow</span>
            {isFunded ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            )}
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900">
              {isFunded ? "PayPal Captured" : "Awaiting Payment"}
            </div>
            {captureId && (
              <div className="font-mono text-[10px] text-blue-700 truncate" title={captureId}>
                Cap: {captureId}
              </div>
            )}
            <div className="font-bold text-slate-800 text-[11px]">${amount} {currency}</div>
          </div>
        </div>

        {/* Step 2: Submitted */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isSubmitted
              ? "bg-purple-50/80 border-purple-200 shadow-sm"
              : isFunded
              ? "bg-white border-purple-400 ring-2 ring-purple-100"
              : "bg-slate-50 border-slate-200 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-purple-900">2. Deliverable</span>
            {isSubmitted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : isFunded ? (
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900">
              {isSubmitted ? "Asset Ingested" : "Priya Uploading"}
            </div>
            {fileName ? (
              <div className="font-mono text-[10px] text-purple-700 truncate" title={fileName}>
                {fileName}
              </div>
            ) : isFunded ? (
              <Link
                href={`/jobs/${jobId}/submit`}
                className="text-[10px] text-purple-600 font-bold hover:underline inline-flex items-center gap-1"
              >
                <span>Upload work</span> &rarr;
              </Link>
            ) : (
              <div className="text-[10px] text-slate-400">Waiting for escrow</div>
            )}
          </div>
        </div>

        {/* Step 3: Verifying */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isGuard
              ? "bg-indigo-50/80 border-indigo-200 shadow-sm"
              : isSubmitted
              ? "bg-white border-indigo-400 ring-2 ring-indigo-100"
              : "bg-slate-50 border-slate-200 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-indigo-900">3. AI Verification</span>
            {isGuard ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : isSubmitted ? (
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900">
              {isGuard ? "Verdict Reached" : isSubmitted ? "K=3 Ensemble" : "Pending Submit"}
            </div>
            {confidence && (
              <div className="font-mono text-[10px] text-indigo-700 font-bold">
                Confidence: {(parseFloat(confidence) * 100).toFixed(1)}%
              </div>
            )}
            <div className="text-[10px] text-slate-500">Multimodal Rubrics + Hard Checks</div>
          </div>
        </div>

        {/* Step 4: Policy Guard */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isPaid
              ? "bg-emerald-50/80 border-emerald-200 shadow-sm"
              : isManualReview
              ? "bg-amber-50/90 border-amber-300 ring-2 ring-amber-100"
              : isGuard
              ? "bg-white border-emerald-400 ring-2 ring-emerald-100"
              : "bg-slate-50 border-slate-200 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-slate-900">4. Policy Guard</span>
            {isPaid ? (
              <Shield className="w-4 h-4 text-emerald-600" />
            ) : isManualReview ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : isGuard ? (
              <Shield className="w-4 h-4 text-emerald-500 animate-pulse" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900">
              {isPaid
                ? "AUTO_PAY Approved"
                : isManualReview
                ? "NEEDS_HUMAN"
                : isGuard
                ? "Evaluating Mandate"
                : "Zero-LLM Guard"}
            </div>
            <div className="text-[10px] text-slate-500">Pure TypeScript Security</div>
          </div>
        </div>

        {/* Step 5: Instant Payout */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isPaid
              ? "bg-emerald-100 border-emerald-300 text-emerald-950 shadow-sm"
              : isManualReview
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-slate-50 border-slate-200 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className={isPaid ? "text-emerald-950" : "text-slate-700"}>5. Instant Payout</span>
            {isPaid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : isManualReview ? (
              <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded font-mono font-bold">Review</span>
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <div className="text-xs space-y-1">
            <div className="font-bold">
              {isPaid ? "PayPal Payout Sent" : isManualReview ? "Pending Sign-off" : "Instant Release"}
            </div>
            {payoutId && (
              <div className="font-mono text-[10px] text-emerald-800 truncate" title={payoutId}>
                ID: {payoutId}
              </div>
            )}
            <div className="text-[10px] text-slate-600 truncate">{maskEmail(freelancerEmail)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
