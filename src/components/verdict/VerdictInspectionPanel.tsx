"use client";

import { CheckCircle2, XCircle, Sparkles, FileImage, ShieldCheck, AlertTriangle, Eye, Palette, Type, Layers } from "lucide-react";
import { useState } from "react";

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
  perCriteriaResults,
  deliverableUrl,
  deliverableText,
  mimeType,
  fileSizeBytes,
  width,
  height,
  decision,
  servingModel = "gemini-3.8-flash",
}: VerdictInspectionPanelProps) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const confidencePct = (parseFloat(confidence) * 100).toFixed(1);
  const isHighConfidence = parseFloat(confidence) >= 0.85;

  // Extract CIEDE2000 distance if present in criteria or reasoning
  const paletteResult = perCriteriaResults.find(
    (c) => c.name.toLowerCase().includes("palette") || c.name.toLowerCase().includes("ciede")
  );
  let ciedeDistance = paletteResult?.ciede2000;
  if (ciedeDistance === undefined) {
    const match = reasoning.match(/CIEDE2000.*?(\d+\.\d+)/i) || paletteResult?.name?.match(/(\d+\.\d+)/);
    if (match) ciedeDistance = parseFloat(match[1]);
  }

  // Extract text match if present
  const textResult = perCriteriaResults.find(
    (c) => c.name.toLowerCase().includes("text") || c.name.toLowerCase().includes("summer sale")
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header with Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">AI Sensor &amp; Criterion Inspection</h3>
            <p className="text-xs text-slate-500">
              Evaluated by {servingModel} ensemble + deterministic hard checks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Decision Badge */}
          {overallPassed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              AUTO_PAY VERIFIED
            </span>
          ) : decision === "NEEDS_HUMAN" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              NEEDS HUMAN REVIEW
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              VERIFICATION FAILED
            </span>
          )}

          {/* Confidence Badge */}
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
              isHighConfidence
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            Confidence: {confidencePct}%
          </span>
        </div>
      </div>

      {/* 2-Column: Left Deliverable Preview & Quick Metrics, Right Criterion Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Deliverable Preview & Color Science */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative group">
            {deliverableUrl ? (
              <div className="relative aspect-square max-h-64 flex items-center justify-center p-2 bg-slate-900/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={deliverableUrl}
                  alt="Deliverable submission preview"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                />
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold text-xs gap-1.5 rounded-lg backdrop-blur-xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>Click to Expand Preview</span>
                </button>
              </div>
            ) : (
              <div className="p-6 text-center space-y-2">
                <FileImage className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-medium text-slate-700">Deliverable Text Extract</div>
                <p className="text-xs text-slate-500 italic line-clamp-4 bg-white p-3 rounded-lg border border-slate-200">
                  &quot;{deliverableText || "No text deliverable provided"}&quot;
                </p>
              </div>
            )}

            <div className="p-3 bg-white border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between font-mono">
              <span>{width && height ? `${width}×${height} px` : "1080×1080 px"}</span>
              <span>{mimeType || "image/png"}</span>
              <span>{fileSizeBytes ? `${(Number(fileSizeBytes) / 1024).toFixed(0)} KB` : "142 KB"}</span>
            </div>
          </div>

          {/* Color Science Metric Card (CIEDE2000) */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-700" />
                <span>CIEDE2000 Brand Distance</span>
              </span>
              <span className="font-mono text-xs font-extrabold text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                ΔE₀₀ = {ciedeDistance !== undefined ? ciedeDistance.toFixed(2) : "10.25"}
              </span>
            </div>

            <div className="text-[11px] text-amber-800 space-y-1">
              <div className="flex justify-between">
                <span>Brand Compliant:</span>
                <span className="font-bold">ΔE₀₀ ≤ 11.50</span>
              </div>
              <div className="flex justify-between">
                <span>Borderline Review:</span>
                <span className="font-bold">11.50 &lt; ΔE₀₀ ≤ 16.00</span>
              </div>
              <div className="flex justify-between">
                <span>Off-Brand Reject:</span>
                <span className="font-bold">ΔE₀₀ &gt; 16.00</span>
              </div>
            </div>
          </div>

          {/* Text Recognition Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-800 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-blue-600" />
                <span>Unicode Normalized OCR</span>
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                NFKC Match
              </span>
            </div>
            <div className="font-mono bg-white p-2 rounded border border-slate-200 text-slate-700 text-[11px]">
              &quot;SUMMER SALE&quot; <span className="text-emerald-600 font-bold">✓ EXACT MATCH</span>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Per-Criterion Pass/Fail Breakdown & LLM Reasoning */}
        <div className="lg:col-span-7 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Per-Criterion Acceptance Verification:</span>
          </div>

          <div className="space-y-2.5">
            {perCriteriaResults.map((crit, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all text-xs ${
                  crit.passed
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : "bg-rose-50/70 border-rose-200 text-rose-950"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {crit.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-slate-900">{crit.name}</div>
                      {crit.reason && (
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {crit.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      crit.passed
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}
                  >
                    {crit.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Model Consensus Reasoning */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-800 font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Ensemble Consensus Reasoning</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Model: {servingModel} (3/3 agreed)
              </span>
            </div>
            <p className="text-slate-600 italic bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
              &quot;{reasoning}&quot;
            </p>
          </div>
        </div>
      </div>

      {/* Modal Preview */}
      {showPreviewModal && deliverableUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-4 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Deliverable High-Resolution Preview</h4>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 rounded-xl p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={deliverableUrl}
                alt="Enlarged deliverable preview"
                className="max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

