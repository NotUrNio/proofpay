"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Lock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

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
    <div className="bg-[#11161D] border-b border-[#30363D] text-slate-300 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          {/* Left: Escrow Checkpoint Metrics */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium h-[26px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-300">Escrow Ledger</span>
            </div>

            {/* Checkpoint 1: Client Funded */}
            <div className="flex items-center gap-1.5 bg-[#161B22] px-2.5 h-[26px] rounded border border-[#30363D]">
              <span className="text-slate-400 text-[11px]">Funded by clients:</span>
              {loading || !data ? (
                <span className="inline-block w-14 h-3.5 rounded skeleton-shimmer align-middle" />
              ) : (
                <span className="font-mono font-semibold text-blue-400 inline-block min-w-[3.5rem] text-right">
                  ${parseFloat(data.clientDeposited).toFixed(2)}
                </span>
              )}
            </div>

            {/* Checkpoint 2: Held in Escrow */}
            <div className="flex items-center gap-1.5 bg-[#161B22] px-2.5 h-[26px] rounded border border-[#30363D]">
              <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-slate-400 text-[11px]">Held safely until work is approved:</span>
              {loading || !data ? (
                <span className="inline-block w-14 h-3.5 rounded skeleton-shimmer align-middle" />
              ) : (
                <span className="font-mono font-semibold text-amber-300 inline-block min-w-[3.5rem] text-right">
                  ${parseFloat(data.escrowBalance).toFixed(2)}
                </span>
              )}
            </div>

            {/* Checkpoint 3: Paid out instantly */}
            <div className="flex items-center gap-1.5 bg-[#161B22] px-2.5 h-[26px] rounded border border-[#30363D]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-slate-400 text-[11px]">Paid out instantly:</span>
              {loading || !data ? (
                <span className="inline-block w-14 h-3.5 rounded skeleton-shimmer align-middle" />
              ) : (
                <span className="font-mono font-semibold text-emerald-400 inline-block min-w-[3.5rem] text-right">
                  ${parseFloat(data.freelancerSettled).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Right: Always-present Human Review queue pill (reserves identical height/width before & after hydration at 360px/390px) */}
          <Link
            href="/inbox"
            className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800/80 px-2.5 h-[26px] min-w-[220px] rounded text-amber-300 text-[11px] font-medium hover:bg-amber-900/60 transition-colors"
          >
            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
            {loading || !data ? (
              <span className="inline-block w-40 h-3.5 rounded skeleton-shimmer align-middle" />
            ) : (
              <span>{data.pendingReviewsCount} milestone awaiting human triage</span>
            )}
            <ArrowRight className="w-3 h-3 text-amber-400 ml-auto flex-shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
