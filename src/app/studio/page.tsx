"use client";

import React, { useEffect, useState } from "react";
import { AgStudioEmbed } from "@/components/studio/AgStudioEmbed";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Activity,
  Layers,
  Building2,
  Clock,
} from "lucide-react";

interface StudioStats {
  clientDeposited: string;
  escrowBalance: string;
  freelancerSettled: string;
  activeJobsCount: number;
  pendingReviewsCount: number;
}

export default function StudioPage() {
  const [stats, setStats] = useState<StudioStats | null>(null);

  useEffect(() => {
    fetch("/api/stats/money-flow")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data);
        }
      })
      .catch((err) => console.error("Stats load error:", err));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1.5 px-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to ProofPay
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>ProofPay • AG Studio Analytics &amp; Ledger Workspace</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-full font-mono font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>AG Studio Enterprise Trial Active</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Analytics Headline & Metrics Cards */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-black text-slate-50 tracking-tight">
              Platform Settlement Intelligence &amp; Multi-Grid Analytics
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Explore live escrow settlements, AI consensus metrics, and cryptographic ledger event provenance. Powered by the official AG Grid + PayPal boilerplate with embedded AG Studio workspace.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Client Escrow Deposits</span>
              </div>
              <div className="text-2xl font-black text-blue-400 font-mono">
                ${stats ? stats.clientDeposited : "..."} USD
              </div>
              <div className="text-[11px] text-slate-500">PayPal Orders v2 Captures</div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Locked in Escrow</span>
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                ${stats ? stats.escrowBalance : "..."} USD
              </div>
              <div className="text-[11px] text-slate-500">Awaiting deliverable verification</div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant Payouts Settled</span>
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${stats ? stats.freelancerSettled : "..."} USD
              </div>
              <div className="text-[11px] text-slate-500">Direct to Priya via PayPal Payouts</div>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>Benchmark Precision</span>
              </div>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                100.0%
              </div>
              <div className="text-[11px] text-slate-500">0% False Approvals (Wilson 95% CI)</div>
            </div>
          </div>
        </div>

        {/* AG Studio Embedded Workspace Canvas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Embedded AG Studio Interactive Canvas</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Wrapper: ag-studio-react v3.0.0
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl">
            <AgStudioEmbed className="h-[650px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
