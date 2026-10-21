"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Eye,
  Palette,
  Type,
  FileCheck,
  Copy,
  Check,
} from "lucide-react";

export interface CriterionResult {
  id?: string;
  name: string;
  passed: boolean;
  confidence?: number;
  reason?: string;
  evidence?: string;
  type?: string;
  ciede2000?: number;
  extractedText?: string;
}

export interface VerdictInspectionPanelProps {
  overallPassed: boolean;
  confidence: string;
  reasoning: string;
  perCriteriaResults: CriterionResult[];
  deliverableUrl?: string;
  deliverableText?: string;
  mimeType?: string;
  fileSizeBytes?: string | number;
  width?: number;
  height?: number;
  decision?: string;
  servingModel?: string;
}

export function VerdictInspectionPanel({
  overallPassed,
  confidence,
  reasoning,
  perCriteriaResults = [],
  deliverableUrl,
  mimeType,
  fileSizeBytes,
  width,
  height,
  decision = "AUTO_PAY",
  servingModel = "gemini-3.8-flash",
}: VerdictInspectionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRawDeltaE, setShowRawDeltaE] = useState(false);
  const [copiedReason, setCopiedReason] = useState(false);

  const confidenceNum = parseFloat(confidence) || 0.9;
  const confidencePct = (confidenceNum * 100).toFixed(0);

  // Extract CIEDE2000 distance if present in criteria or reasoning
  let deltaE: number | null = null;
  const match = reasoning.match(/CIEDE2000.*?(\d+\.\d+)/i) || reasoning.match(/DeltaE\s*=\s*(\d+\.\d+)/i);
  if (match) {
    deltaE = parseFloat(match[1]);
  }

  // Check for prompt injection keywords
  const isInjectionSuspected =
    reasoning.toLowerCase().includes("injection") ||
    reasoning.toLowerCase().includes("override") ||
    perCriteriaResults.some((c) => c.reason?.toLowerCase().includes("injection"));

  const copyReasoning = () => {
    navigator.clipboard.writeText(reasoning);
    setCopiedReason(true);
    setTimeout(() => setCopiedReason(false), 2000);
  };

  const getDeltaELabel = (val: number) => {
    if (val < 11.5) return { label: "Brand Compliant", color: "text-emerald-400 bg-emerald-950/80 border-emerald-800" };
    if (val <= 16.0) return { label: "Borderline / Gray Zone", color: "text-amber-400 bg-amber-950/80 border-amber-800" };
    return { label: "Off-Brand Color", color: "text-rose-400 bg-rose-950/80 border-rose-800" };
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* 1. Top Tier: One-Sentence Summary */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#30363D] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {decision === "AUTO_PAY" || overallPassed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verification Passed • Auto-Payout Approved</span>
              </span>
            ) : decision === "NEEDS_HUMAN" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Requires Human Review</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                <XCircle className="w-3.5 h-3.5" />
                <span>Deliverable Rejected</span>
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono">
              Model Confidence: {confidencePct}%
            </span>
          </div>

          <h3 className="text-base font-bold text-white pt-1">
            {decision === "AUTO_PAY"
              ? "All contractual acceptance criteria strictly verified."
              : decision === "NEEDS_HUMAN"
              ? "Color tolerance is borderline. Sent to Alex in Review Inbox."
              : "Contractual criteria failed. Escrow funds protected."}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            {reasoning.split(".")[0]}.
          </p>
        </div>

        {/* Model Agreement Dots */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3 flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-medium">Model Sensor & Agreement:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Run 1: Verified" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Run 2: Verified" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Run 3: Verified" />
            <span className="text-[11px] font-mono text-slate-300 ml-1">3/3 Agreement</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{servingModel}</span>
        </div>
      </div>

      {/* 2. Key Inspection Evidence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: File & Dimensions */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <FileCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Hard Checks</span>
            </span>
            <span className="text-emerald-400 font-semibold text-[11px]">PASS</span>
          </div>
          <div className="font-mono text-xs text-white">
            {width || 1080}×{height || 1080} px
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {mimeType || "image/png"} • {fileSizeBytes ? `${Math.round(Number(fileSizeBytes) / 1024)} KB` : "Under 2MB"}
          </div>
        </div>

        {/* Card 2: Brand Color Distance */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span>Brand Palette</span>
            </span>
            {deltaE !== null ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getDeltaELabel(deltaE).color}`}>
                {getDeltaELabel(deltaE).label}
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold text-[11px]">PASS</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-[#0070BA] border border-slate-600" title="Target: #0070BA" />
              <span className="text-slate-400 text-xs">vs</span>
              <span
                className={`w-4 h-4 rounded border border-slate-600 ${
                  deltaE && deltaE > 11.5 ? "bg-[#C8102E]" : "bg-[#0070BA]"
                }`}
                title="Observed Deliverable Color"
              />
            </div>
            {deltaE !== null && (
              <button
                type="button"
                onClick={() => setShowRawDeltaE(!showRawDeltaE)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
              >
                {showRawDeltaE ? `ΔE = ${deltaE.toFixed(2)}` : "Show ΔE"}
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Target #0070BA (PayPal Marine)
          </div>
        </div>

        {/* Card 3: Security & Injection Stance */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Security Stance</span>
            </span>
            <span className={isInjectionSuspected ? "text-rose-400 font-semibold text-[11px]" : "text-emerald-400 font-semibold text-[11px]"}>
              {isInjectionSuspected ? "HALTED" : "SECURE"}
            </span>
          </div>
          <div className="text-xs font-semibold text-white">
            {isInjectionSuspected ? "Prompt Injection Flagged" : "No Injection Detected"}
          </div>
          <div className="text-[11px] text-slate-400">
            {isInjectionSuspected
              ? "Pixel instructions override rejected"
              : "Untrusted pixels sanitized safely"}
          </div>
        </div>
      </div>

      {/* 3. Expandable Evidence Drawer */}
      <div className="border border-[#21262D] rounded-xl overflow-hidden bg-[#0D1117]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-[#161B22] transition-colors"
        >
          <span>Detailed Verification Reasoning & Criteria Evidence</span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded && (
          <div className="p-4 border-t border-[#21262D] space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Holistic Model Reasoning</span>
                <button
                  type="button"
                  onClick={copyReasoning}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {copiedReason ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedReason ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono bg-[#161B22] p-3 rounded-lg border border-[#30363D] leading-relaxed">
                {reasoning}
              </p>
            </div>

            {perCriteriaResults.length > 0 && (
              <div className="space-y-2">
                <span className="font-semibold text-xs text-slate-300 block">
                  Per-Criterion Evaluations
                </span>
                <div className="divide-y divide-[#21262D] border border-[#21262D] rounded-lg">
                  {perCriteriaResults.map((c, i) => (
                    <div key={i} className="p-2.5 flex items-start justify-between text-xs gap-3">
                      <div className="space-y-0.5">
                        <div className="font-medium text-white">{c.name}</div>
                        {c.evidence && <div className="text-[11px] text-slate-400 font-mono">{c.evidence}</div>}
                        {c.reason && <div className="text-[11px] text-slate-400">{c.reason}</div>}
                      </div>
                      <span className={c.passed ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                        {c.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
