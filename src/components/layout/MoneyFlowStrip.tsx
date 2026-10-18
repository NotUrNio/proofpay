"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, Shield, ArrowRight, RefreshCw, AlertCircle, Sparkles, Building2, UserCheck } from "lucide-react";

interface MoneyFlowData {
  clientDeposited: string;
  escrowBalance: string;
  freelancerSettled: string;
  pendingReviewsCount: number;
  activeJobsCount: number;
  currency: string;
  businessAccount: string;
  freelancerAccount: string;
}

export function MoneyFlowStrip() {
  const [data, setData] = useState<MoneyFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats/money-flow");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load money flow:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white shadow-inner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Left: Escrow Money Flow Counters */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                PayPal Escrow Ledger:
              </span>
            </div>

            {/* 1. Client Deposits */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Client Funded:</span>
              <span className="font-mono font-bold text-blue-300">
                ${data ? data.clientDeposited : "..."} USD
              </span>
            </div>

            {/* 2. Platform Escrow Balance */}
            <div className="flex items-center gap-1.5 bg-indigo-950/80 px-2.5 py-1 rounded-md border border-indigo-700/60">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-indigo-200">In Platform Escrow:</span>
              <span className="font-mono font-bold text-amber-400">
                ${data ? data.escrowBalance : "..."} USD
              </span>
            </div>

            {/* 3. Freelancer Settled */}
            <div className="flex items-center gap-1.5 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-700/60">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-200">Settled to Priya:</span>
              <span className="font-mono font-bold text-emerald-400">
                ${data ? data.freelancerSettled : "..."} USD
              </span>
            </div>
          </div>

          {/* Right: Review Queue Badge & Quick Navigation */}
          <div className="flex items-center gap-3">
            {data && data.pendingReviewsCount > 0 && (
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded-full text-[11px] transition-colors shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5 text-slate-950" />
                <span>{data.pendingReviewsCount} Review Queue</span>
              </Link>
            )}

            <Link
              href="/policy"
              className="text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
            >
              Policy Rules
            </Link>

            <Link
              href="/inbox"
              className="text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
            >
              Review Inbox
            </Link>

            <Link
              href="/studio"
              className="text-indigo-300 hover:text-indigo-200 text-[11px] font-medium transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>AG Studio</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
