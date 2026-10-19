"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface MoneyFlowData {
  clientDeposited: string;
  escrowBalance: string;
  freelancerSettled: string;
  pendingReviewsCount: number;
  activeJobsCount: number;
  currency: string;
}

export function MoneyFlowStrip() {
  const [data, setData] = useState<MoneyFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const prevValuesRef = useRef<MoneyFlowData | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats/money-flow");
      if (res.ok) {
        const json = await res.json();
        setData((prev) => {
          prevValuesRef.current = prev;
          return json;
        });
      }
    } catch (err) {
      console.error("Failed to load money flow:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#11161D] border-b border-[#30363D] text-slate-300 text-xs min-h-[41px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          {/* Left: Escrow Checkpoint Metrics */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-300">Escrow Ledger</span>
            </div>

            {/* Checkpoint 1: Client Funded */}
            <div className="flex items-center gap-1.5 bg-[#161B22] px-2.5 py-1 rounded border border-[#30363D]">
              <span className="text-slate-400 text-[11px]">Funded by clients:</span>
              {loading || !data ? (
                <span className="inline-block w-14 h-3.5 rounded skeleton-shimmer align-middle" />
              ) : (
                <span className="font-mono font-semibold text-blue-400">
                  ${parseFloat(data.clientDeposited).toFixed(2)}
                </span>
              )}
            </div>

            {/* Checkpoint 2: Held in Escrow */}
            <div className="flex items-center gap-1.5 bg-[#161B22] px-2.5 py-1 rounded border border-[#30363D]">
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="text-slate-400 text-[11px]">Held safely until work is approved:</span>
              {loading || !data ? (
                <span className="inline-block w-14 h-3.5 rounded skeleton-shimmer align-middle" />
              ) : (
                <span className="font-mono font-semibold text-amber-300">
                  ${parseFloat(data.escrowBalance).toFixed(2)}
                </span>
              )}
            </div>

            {/* Checkpoint 3: Paid out instantly */}
            <div className="flex items-center gap-1.5 bg-[#161B22] px-2.5 py-1 rounded border border-[#30363D]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-slate-400 text-[11px]">Paid out instantly:</span>
              {loading || !data ? (
                <span className="inline-block w-14 h-3.5 rounded skeleton-shimmer align-middle" />
              ) : (
                <span className="font-mono font-semibold text-emerald-400">
                  ${parseFloat(data.freelancerSettled).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Right: Human Review queue count if > 0 */}
          {data && data.pendingReviewsCount > 0 && (
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 rounded text-amber-300 text-[11px] font-medium hover:bg-amber-900/60 transition-colors"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>{data.pendingReviewsCount} milestone awaiting human triage</span>
              <ArrowRight className="w-3 h-3 text-amber-400" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
