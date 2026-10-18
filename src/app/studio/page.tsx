"use client";

import React, { useEffect, useState } from "react";
import { AgStudioEmbed } from "@/components/studio/AgStudioEmbed";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Lock,
  DollarSign,
  TrendingUp,
  Activity,
  Layers,
  Building2,
  Clock,
  ShieldCheck,
  AlertTriangle,
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
        if (data.clientDeposited !== undefined) {
          setStats(data);
        }
      })
      .catch((err) => console.error("Stats load error:", err));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30363D] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              AG Studio Analytics Workspace
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Interactive analytical canvas backed by AG Studio, visualizing milestone velocity, escrow spend, and payout latency.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg border border-[#30363D] bg-[#161B22]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
        </Link>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Funded Client Escrow</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-400 mt-1">
            ${stats ? parseFloat(stats.clientDeposited).toFixed(2) : "0.00"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">PayPal Orders v2 Total</div>
        </div>

        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Locked in Active Escrow</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300 mt-1">
            ${stats ? parseFloat(stats.escrowBalance).toFixed(2) : "0.00"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Awaiting Deliverable Check</div>
        </div>

        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Settled to Freelancers</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            ${stats ? parseFloat(stats.freelancerSettled).toFixed(2) : "0.00"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">PayPal Payouts Dispatched</div>
        </div>

        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Pending Review Triage</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-purple-400 mt-1">
            {stats ? stats.pendingReviewsCount : 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Gray-Zone Deliverables</div>
        </div>
      </div>

      {/* License Notice & Fallback Info */}
      <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            AG Studio Community Workspace active. All chart visualizations, pivot tables, and data sources are connected to PostgreSQL.
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
          ag-studio v3.0.0
        </span>
      </div>

      {/* Embedded AG Studio Canvas */}
      <div className="rounded-2xl border border-[#30363D] overflow-hidden bg-[#161B22] p-1">
        <AgStudioEmbed />
      </div>
    </div>
  );
}
