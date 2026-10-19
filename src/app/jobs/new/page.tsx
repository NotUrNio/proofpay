"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, Lock, ChevronDown, Check, Sparkles, Sliders } from "lucide-react";

interface Preset {
  id: string;
  name: string;
  title: string;
  description: string;
  aspectRatio: string;
  width: number;
  height: number;
  brandColor: string;
  requiredText: string;
  amount: string;
}

const PRESETS: Preset[] = [
  {
    id: "banner_square",
    name: "Social Media Banner (Square 1:1)",
    title: "Summer Sale Instagram Post",
    description: "1080x1080 PNG promotional banner for summer campaign. Must feature brand blue (#0070BA) and 'Summer Sale'.",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    brandColor: "#0070BA",
    requiredText: "Summer Sale",
    amount: "25.00",
  },
  {
    id: "banner_landscape",
    name: "Campaign Banner (Landscape 16:9)",
    title: "Website Hero Header Banner",
    description: "1200x675 PNG header graphic. Must feature brand blue and required campaign typography.",
    aspectRatio: "16:9",
    width: 1200,
    height: 675,
    brandColor: "#0070BA",
    requiredText: "Summer Sale",
    amount: "50.00",
  },
  {
    id: "story_vertical",
    name: "Story Graphic (Vertical 9:16)",
    title: "Mobile Story Promo",
    description: "1080x1920 PNG promotional visual for mobile stories.",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    brandColor: "#0070BA",
    requiredText: "Summer Sale",
    amount: "35.00",
  },
];

export default function NewJobPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("banner_square");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    title: PRESETS[0].title,
    description: PRESETS[0].description,
    amount: PRESETS[0].amount,
    currency: "USD",
    clientEmail: "alice@proofpay.io",
    freelancerEmail: "priya@proofpay.io",
    aspectRatio: PRESETS[0].aspectRatio,
    width: PRESETS[0].width,
    height: PRESETS[0].height,
    brandColorHex: PRESETS[0].brandColor,
    toleranceDeltaE: 14.0,
    requiredTextSnippet: PRESETS[0].requiredText,
    minConfidence: 0.85,
  });

  const applyPreset = (presetId: string) => {
    const p = PRESETS.find((item) => item.id === presetId);
    if (!p) return;
    setSelectedPreset(presetId);
    setForm((prev) => ({
      ...prev,
      title: p.title,
      description: p.description,
      amount: p.amount,
      aspectRatio: p.aspectRatio,
      width: p.width,
      height: p.height,
      brandColorHex: p.brandColor,
      requiredTextSnippet: p.requiredText,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (typeof document !== "undefined" && !document.cookie.includes("proofpay_role=")) {
        await fetch("/api/auth/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "client" }),
        });
      }
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          clientEmail: form.clientEmail,
          freelancerEmail: form.freelancerEmail,
          amount: parseFloat(form.amount).toFixed(2),
          currency: form.currency,
          scope: form.title.toLowerCase().replace(/\s+/g, "_"),
          policy: {
            allowedAspectRatios: [form.aspectRatio],
            minResolution: { width: Number(form.width), height: Number(form.height) },
            brandGuidelines: {
              primaryColorHex: form.brandColorHex,
              toleranceDeltaE: Number(form.toleranceDeltaE),
              requiredTextSnippets: [form.requiredTextSnippet],
            },
            maxPayoutUsd: parseFloat(form.amount),
            disallowedKeywords: ["free", "crypto"],
            minConfidenceThreshold: Number(form.minConfidence),
          },
        }),
      });
      const data = await res.json();
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      }
    } catch (err) {
      console.error("Failed to create milestone:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to overview</span>
      </Link>

      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Create Milestone Escrow
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Funds will be held safely in PayPal escrow. When the deliverable passes your verification rules, payment dispatches instantly.
          </p>
        </div>

        {/* 3-Step Wizard Navigation */}
        <div className="grid grid-cols-3 gap-2 border-y border-[#30363D] py-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`text-left p-2 rounded-lg transition-colors ${
              step === 1 ? "bg-[#21262D] text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="text-[10px] font-semibold text-blue-400">STEP 1</div>
            <div className="text-xs font-bold">What is being made</div>
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`text-left p-2 rounded-lg transition-colors ${
              step === 2 ? "bg-[#21262D] text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="text-[10px] font-semibold text-blue-400">STEP 2</div>
            <div className="text-xs font-bold">Amount & Payee</div>
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`text-left p-2 rounded-lg transition-colors ${
              step === 3 ? "bg-[#21262D] text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="text-[10px] font-semibold text-blue-400">STEP 3</div>
            <div className="text-xs font-bold">Verification Rules</div>
          </button>
        </div>

        {/* Preset Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Quick Preset:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`text-left p-3 rounded-xl border text-xs transition-all ${
                  selectedPreset === p.id
                    ? "bg-[#21262D] border-blue-500 text-white ring-1 ring-blue-500/40"
                    : "bg-[#0D1117] border-[#30363D] text-slate-300 hover:border-slate-500"
                }`}
              >
                <div className="font-semibold mb-1 truncate">{p.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {p.width}x{p.height} • ${p.amount} USD
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: What is being made */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Milestone Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Deliverable Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  id="jobs-new-step1-next"
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-[#21262D] hover:bg-[#30363D] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span>Continue to Amount & Payee</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Amount & Payee */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Escrow Amount (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.00"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    disabled
                    value={form.currency}
                    className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Freelancer Payee Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.freelancerEmail}
                    onChange={(e) => setForm({ ...form, freelancerEmail: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Client Funding Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.clientEmail}
                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  id="jobs-new-step2-next"
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-[#21262D] hover:bg-[#30363D] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span>Continue to Verification Rules</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Verification Rules */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exact Resolution
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={form.width}
                      onChange={(e) => setForm({ ...form, width: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-white"
                    />
                    <span className="text-slate-400">×</span>
                    <input
                      type="number"
                      value={form.height}
                      onChange={(e) => setForm({ ...form, height: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Brand Color Hex
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.brandColorHex}
                      onChange={(e) => setForm({ ...form, brandColorHex: e.target.value })}
                      className="w-8 h-8 rounded border border-[#30363D] bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.brandColorHex}
                      onChange={(e) => setForm({ ...form, brandColorHex: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Required Text Snippet
                </label>
                <input
                  type="text"
                  value={form.requiredTextSnippet}
                  onChange={(e) => setForm({ ...form, requiredTextSnippet: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Progressive Disclosure: Advanced Settings */}
              <div className="border border-[#30363D] rounded-lg p-3 bg-[#0D1117]">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-300"
                >
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>Advanced Guard Parameters</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      showAdvanced ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#21262D] text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Color Distance Tolerance (DeltaE)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.toleranceDeltaE}
                        onChange={(e) => setForm({ ...form, toleranceDeltaE: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-[#161B22] border border-[#30363D] rounded font-mono text-white"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        DeltaE &lt; 11.5: Pass • 11.5 - 16.0: Human Review • &gt; 16: Reject
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        Minimum Model Confidence
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        max="1.0"
                        value={form.minConfidence}
                        onChange={(e) => setForm({ ...form, minConfidence: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-[#161B22] border border-[#30363D] rounded font-mono text-white"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Default: 0.85
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live Plain-Language Summary Box */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-4 text-xs space-y-2">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Plain-Language Settlement Summary:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              When Priya submits a {form.width}×{form.height} PNG containing &ldquo;{form.requiredTextSnippet}&rdquo; matching {form.brandColorHex} (tolerance &Delta;E &le; {form.toleranceDeltaE}), <strong>${parseFloat(form.amount || "0").toFixed(2)} USD</strong> will be dispatched instantly via PayPal Payouts.
            </p>
            <p className="text-slate-400 text-[11px]">
              If dimensions or file type fail: Rejected with $0 spent. If color is borderline (&Delta;E between 11.5 and 16.0): Routed to Alex in Review Inbox.
            </p>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              id="jobs-new-submit-btn"
              type="submit"
              disabled={submitting}
              className="bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? "Creating Mandate..."
                  : `Fund this milestone ($${parseFloat(form.amount || "0").toFixed(2)} USD)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
