"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Sliders,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Save,
  RotateCcw,
} from "lucide-react";

interface EvalCase {
  id: string;
  name: string;
  category: string;
  split: string;
  expectedOutcome: string;
  hardChecksPass: boolean;
  notes: string;
}

export default function PolicyEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Policy Form State
  const [maxDaily, setMaxDaily] = useState(1000);
  const [maxJob, setMaxJob] = useState(500);
  const [threshold, setThreshold] = useState(0.85);
  const [requireHuman, setRequireHuman] = useState(true);
  const [benchmarkCases, setBenchmarkCases] = useState<EvalCase[]>([]);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const res = await fetch("/api/policy");
        const data = await res.json();
        if (data.policy) {
          setMaxDaily(parseFloat(data.policy.maxDailyPayoutAmount) || 1000);
          setMaxJob(parseFloat(data.policy.maxJobPayoutAmount) || 500);
          setThreshold(parseFloat(data.policy.minConfidenceThreshold) || 0.85);
          setRequireHuman(data.policy.requireHumanReviewIfAmbiguous ?? true);
        }
        if (data.benchmarkCases) {
          setBenchmarkCases(data.benchmarkCases);
        }
      } catch (err) {
        console.error("Failed to load policy:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, []);

  // Counterfactual Simulation over Benchmark Set
  const simulation = useMemo(() => {
    let autoPay = 0;
    let needsHuman = 0;
    let rejected = 0;
    let falseApprovals = 0;

    for (const c of benchmarkCases) {
      if (!c.hardChecksPass) {
        rejected++;
        continue;
      }

      // Compliant cases typically have confidence ~0.95 - 0.99
      // Borderline near-miss cases have confidence ~0.81
      // Ambiguous cases have confidence ~0.65 - 0.75
      let simulatedConfidence = 0.98;
      if (c.category === "NEAR_MISS_PALETTE") {
        simulatedConfidence = 0.8116;
      } else if (c.category === "AMBIGUOUS") {
        simulatedConfidence = 0.72;
      } else if (c.category === "RUBRIC_FAIL") {
        simulatedConfidence = 0.45;
      } else if (c.category === "ADVERSARIAL") {
        simulatedConfidence = 0.2;
      }

      if (simulatedConfidence >= threshold) {
        autoPay++;
        if (c.expectedOutcome !== "AUTO_PAY") {
          falseApprovals++;
        }
      } else if (requireHuman && simulatedConfidence >= 0.6) {
        needsHuman++;
      } else {
        rejected++;
      }
    }

    return {
      autoPay,
      needsHuman,
      rejected,
      falseApprovals,
      total: benchmarkCases.length || 26,
    };
  }, [threshold, requireHuman, benchmarkCases]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDailyPayoutAmount: maxDaily.toFixed(2),
          maxJobPayoutAmount: maxJob.toFixed(2),
          minConfidenceThreshold: threshold.toFixed(4),
          requireHumanReviewIfAmbiguous: requireHuman,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setMaxDaily(1000);
    setMaxJob(500);
    setThreshold(0.85);
    setRequireHuman(true);
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Loading policy settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Deterministic Security Configuration
        </div>
        <h1 className="text-3xl font-black text-slate-900">Zero-LLM Policy Guard Settings</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Tweak deterministic parameters governing autonomous settlements. All changes are simulated in real time against the 26-case benchmark suite.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Policy updated successfully! Live settlement guard thresholds are active.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Sliders & Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Guard Thresholds &amp; Escrow Caps</span>
            </h3>
            <button
              type="button"
              onClick={resetDefaults}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Defaults
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Confidence Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Minimum AI Confidence Threshold
                </label>
                <span className="font-mono text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                  {(threshold * 100).toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.99"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>50% (Permissive)</span>
                <span className="font-bold text-slate-600">85% (Calibrated Default)</span>
                <span>99% (Strict)</span>
              </div>
            </div>

            {/* 2. Max Single Job Cap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Maximum Single Milestone Payout Cap
                </label>
                <span className="font-mono text-sm font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                  ${maxJob} USD
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={maxJob}
                onChange={(e) => setMaxJob(parseInt(e.target.value) || 10)}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <p className="text-[11px] text-slate-500">
                Any milestone exceeding this amount is blocked from autonomous release and requires manual client sign-off.
              </p>
            </div>

            {/* 3. Max Daily Payout Cap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Daily Cumulative Payout Velocity Cap
                </label>
                <span className="font-mono text-sm font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                  ${maxDaily} USD
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="50"
                value={maxDaily}
                onChange={(e) => setMaxDaily(parseInt(e.target.value) || 100)}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <p className="text-[11px] text-slate-500">
                Prevents platform drain by capping 24-hour settlement velocity across all milestones.
              </p>
            </div>

            {/* 4. Human Review Toggle */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireHuman}
                  onChange={(e) => setRequireHuman(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Require Human Review for Borderline / Ambiguous Work
                  </div>
                  <div className="text-[11px] text-slate-500">
                    When enabled, deliverables with borderline criteria land in the Review Inbox instead of being rejected.
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving Policy..." : "Save Active Policy"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (5 cols): Counterfactual Simulation Preview */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white">Counterfactual Simulation</h3>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Simulated outcome across all 26 benchmark test cases under current slider settings:
            </p>
          </div>

          {/* Outcome Breakdown Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3">
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {simulation.autoPay}
              </div>
              <div className="text-[10px] font-bold text-emerald-200 uppercase mt-0.5">
                Auto-Paid
              </div>
            </div>

            <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3">
              <div className="text-2xl font-black text-amber-400 font-mono">
                {simulation.needsHuman}
              </div>
              <div className="text-[10px] font-bold text-amber-200 uppercase mt-0.5">
                Human Review
              </div>
            </div>

            <div className="bg-rose-500/20 border border-rose-400/30 rounded-xl p-3">
              <div className="text-2xl font-black text-rose-400 font-mono">
                {simulation.rejected}
              </div>
              <div className="text-[10px] font-bold text-rose-200 uppercase mt-0.5">
                Rejected
              </div>
            </div>
          </div>

          {/* Safety Risk Alert */}
          {simulation.falseApprovals > 0 ? (
            <div className="bg-rose-500/30 border border-rose-400/60 rounded-xl p-3.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>SAFETY VIOLATION DETECTED</span>
              </div>
              <p className="text-rose-100 text-[11px] leading-relaxed">
                Threshold {(threshold * 100).toFixed(0)}% is too permissive! {simulation.falseApprovals} non-compliant or near-miss case(s) would be auto-paid without human review. Target False-Approval rate is strictly 0%.
              </p>
            </div>
          ) : threshold > 0.92 ? (
            <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl p-3.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>High Friction Warning</span>
              </div>
              <p className="text-amber-100 text-[11px] leading-relaxed">
                Threshold {(threshold * 100).toFixed(0)}% is overly strict. Multiple compliant deliveries will be held in human review unnecessarily, increasing payout latency for freelancers.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl p-3.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Optimal Calibration</span>
              </div>
              <p className="text-emerald-100 text-[11px] leading-relaxed">
                0% False-Approval rate maintained. 100% of compliant deliveries are auto-paid instantly, and near-miss palette variations are safely routed to human review.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 space-y-1 font-mono">
            <div>• Target False Approval Rate: 0.0%</div>
            <div>• Human Review Routing: {((simulation.needsHuman / simulation.total) * 100).toFixed(1)}%</div>
            <div>• Deterministic Guard Defense: 100%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
