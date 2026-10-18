"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

export default function NewJobPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "Social Media Banner (Summer Sale)",
    description: "1080x1080 PNG promotional banner for summer sale campaign. Must contain SUMMER SALE title and warm coral/gold brand palette.",
    clientEmail: "sandbox-buyer@business.example.com",
    freelancerEmail: "priya-designer@sandbox.paypal.com",
    amount: "50.00",
    currency: "USD",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      }
    } catch (err) {
      console.error("Failed to create job:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Milestone Escrow</h1>
          <p className="text-xs text-slate-500 mt-1">
            Setting up a new milestone automatically creates a cryptographically signed HMAC-SHA256 mandate for payee & cap protection.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Milestone Title
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Deliverable Description & Requirements
            </label>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Client (Funding Buyer) Email
              </label>
              <input
                type="email"
                required
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Freelancer (Payee) Email
              </label>
              <input
                type="email"
                required
                value={form.freelancerEmail}
                onChange={(e) => setForm({ ...form, freelancerEmail: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Milestone Amount
              </label>
              <input
                type="text"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Currency
              </label>
              <input
                type="text"
                disabled
                value={form.currency}
                className="w-full px-3.5 py-2 border border-slate-200 bg-slate-100 rounded-lg text-sm font-bold text-slate-500"
              />
            </div>
          </div>

          {/* Seed Template Acceptance Criteria Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Auto-Configured Acceptance Criteria:</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 pl-5 list-disc">
              <li>Deterministic: Resolution exactly 1080x1080 px (Hard Check)</li>
              <li>Deterministic: File format image/png (Hard Check)</li>
              <li>Deterministic: File size &lt;= 2 MB (Hard Check)</li>
              <li>Deterministic: Contains required text &quot;SUMMER SALE&quot; (Hard Check)</li>
              <li>LLM Rubric: Warm color palette &amp; brand aesthetics (Google Gemini)</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? "Signing Mandate & Creating..." : "Sign Mandate & Create Milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
