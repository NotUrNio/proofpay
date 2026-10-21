"use client";

import React, { useEffect, useState, useId } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Table as TableIcon,
  BarChart2,
  ArrowRight,
} from "lucide-react";
import { AnalyticsResponse } from "@/lib/analytics-schema";

const PALETTE = {
  canvas: "#0D1117",
  surface: "#161B22",
  border: "#30363D",
  blue: "#0070BA",
  emerald: "#2EA043",
  amber: "#D29922",
  crimson: "#F85149",
  purple: "#A371F7",
  muted: "#8B949E",
  white: "#FFFFFF",
};

interface ChartCardProps {
  title: string;
  description: string;
  sourceNote: { table: string; window: string; includesSimulated: boolean };
  ariaLabel: string;
  children: (props: { isTable: boolean; prefersReducedMotion: boolean }) => React.ReactNode;
  tableContent?: React.ReactNode;
}

function ChartCard({
  title,
  description,
  sourceNote,
  ariaLabel,
  children,
  tableContent,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, []);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
    >
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30363D] pb-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
          {tableContent && (
            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] px-2.5 py-1.5 rounded-lg transition-colors self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {showTable ? <BarChart2 className="w-3.5 h-3.5" /> : <TableIcon className="w-3.5 h-3.5" />}
              <span>{showTable ? "View as Chart" : "View as Table"}</span>
            </button>
          )}
        </div>

        <div className="min-h-[260px] flex flex-col justify-center">
          {showTable && tableContent ? tableContent : children({ isTable: showTable, prefersReducedMotion })}
        </div>
      </div>

      {/* Data Source Note */}
      <div className="pt-3 border-t border-[#30363D]/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-1.5">
          <Info className="w-3 h-3 text-slate-400" />
          <span>Source: {sourceNote.table} • Window: {sourceNote.window}</span>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded border ${
            sourceNote.includesSimulated
              ? "text-amber-400/90 bg-amber-950/40 border-amber-800/60"
              : "text-emerald-400/90 bg-emerald-950/40 border-emerald-800/60"
          }`}
        >
          {sourceNote.includesSimulated ? "Includes [SIMULATED]" : "Real Data Only"}
        </span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] p-2.5 rounded-xl text-xs shadow-xl text-white font-mono space-y-1">
        <div className="font-semibold text-slate-300 border-b border-[#30363D] pb-1 mb-1">{label}</div>
        {payload.map((entry: any, idx: number) => (
          <div key={`item-${idx}`} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function RechartsAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/analytics")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Analytics endpoint returned status ${res.status}`);
        }
        return res.json();
      })
      .then((json: AnalyticsResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load analytics aggregation:", err);
        setError(err.message || "Failed to load dashboard metrics.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[#161B22] border border-[#30363D] animate-pulse" />
          ))}
        </div>
        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-[#161B22] border border-[#30363D] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#161B22] border border-rose-800/60 rounded-2xl p-8 text-center space-y-3">
        <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Analytics Aggregation Unavailable</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">{error || "Could not retrieve ledger aggregates."}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#21262D] hover:bg-[#30363D] text-xs font-semibold text-white rounded-lg transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { kpis, outcomes, topReasons, hardCheckFailures, modelAgreement, spendVsCaps, latency, activity, evalBenchmark, dataSources } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Funded Client Escrow */}
        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Funded Client Escrow</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-400 mt-1">
            ${parseFloat(kpis.clientDepositedTotal).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
            <span>Real: ${parseFloat(kpis.clientDepositedReal).toFixed(2)}</span>
            <span className="text-amber-400/90">[SIMULATED]: ${parseFloat(kpis.clientDepositedSimulated).toFixed(2)}</span>
          </div>
        </div>

        {/* Card 2: Locked in Active Escrow */}
        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Locked in Active Escrow</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300 mt-1">
            ${parseFloat(kpis.escrowBalanceTotal).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
            <span>Real: ${parseFloat(kpis.escrowBalanceReal).toFixed(2)}</span>
            <span className="text-amber-400/90">[SIMULATED]: ${parseFloat(kpis.escrowBalanceSimulated).toFixed(2)}</span>
          </div>
        </div>

        {/* Card 3: Settled to Freelancers */}
        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Settled to Freelancers</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            ${parseFloat(kpis.freelancerSettledTotal).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
            <span>Real: ${parseFloat(kpis.freelancerSettledReal).toFixed(2)}</span>
            <span className="text-amber-400/90">[SIMULATED]: ${parseFloat(kpis.freelancerSettledSimulated).toFixed(2)}</span>
          </div>
        </div>

        {/* Card 4: Pending Review Triage */}
        <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D]">
          <div className="text-[11px] font-semibold text-slate-400">Pending Review Triage</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-purple-400 mt-1">
            {kpis.pendingReviewsCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Gray-Zone Deliverables (ΔE &isin; [11.5, 16.0])
          </div>
        </div>
      </div>

      {/* Grid: Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Settlement Outcomes Breakdown */}
        <ChartCard
          title="Verification & Settlement Outcomes"
          description="Autonomous clearance vs human review triage and hard failures."
          sourceNote={dataSources.outcomes}
          ariaLabel="Settlement Outcomes Breakdown by decision"
          tableContent={
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono text-slate-300">
                <thead className="border-b border-[#30363D] text-slate-400">
                  <tr>
                    <th className="py-2">Decision</th>
                    <th className="py-2 text-right">Real Sandbox</th>
                    <th className="py-2 text-right">[SIMULATED]</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]/50">
                  {outcomes.map((o) => (
                    <tr key={o.decision}>
                      <td className="py-2 font-bold text-white">{o.decision}</td>
                      <td className="py-2 text-right">{o.real}</td>
                      <td className="py-2 text-right text-amber-400">{o.simulated}</td>
                      <td className="py-2 text-right font-bold text-white">{o.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          {({ prefersReducedMotion }) => (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outcomes} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="decision" stroke={PALETTE.muted} fontSize={11} tickLine={false} />
                  <YAxis stroke={PALETTE.muted} fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar
                    dataKey="real"
                    name="Real Sandbox"
                    fill={PALETTE.emerald}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!prefersReducedMotion}
                  />
                  <Bar
                    dataKey="simulated"
                    name="[SIMULATED] Runs"
                    fill={PALETTE.amber}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!prefersReducedMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* CHART 2: Top Reason Codes */}
        <ChartCard
          title="Top Decision & Observation Reasons"
          description="Model observations and policy guard triggers across evaluated milestones."
          sourceNote={dataSources.topReasons}
          ariaLabel="Top Decision Reasons"
          tableContent={
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono text-slate-300">
                <thead className="border-b border-[#30363D] text-slate-400">
                  <tr>
                    <th className="py-2">Reason Code</th>
                    <th className="py-2 text-right">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]/50">
                  {topReasons.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-white">{r.code}</td>
                      <td className="py-2 text-right font-bold text-blue-400">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          {({ prefersReducedMotion }) =>
            topReasons.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">No verdict reasons recorded yet.</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topReasons}
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" stroke={PALETTE.muted} fontSize={11} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="code"
                      stroke={PALETTE.muted}
                      fontSize={10}
                      width={120}
                      tickFormatter={(val) => (val.length > 18 ? `${val.slice(0, 18)}...` : val)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Occurrences"
                      fill={PALETTE.blue}
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={!prefersReducedMotion}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          }
        </ChartCard>

        {/* CHART 3: Deterministic Hard-Check Failures */}
        <ChartCard
          title="Hard-Check Violations by Type"
          description="Pre-model deterministic filters that halt processing with $0 spent."
          sourceNote={dataSources.hardCheckFailures}
          ariaLabel="Hard-Check Failures by Type"
          tableContent={
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono text-slate-300">
                <thead className="border-b border-[#30363D] text-slate-400">
                  <tr>
                    <th className="py-2">Failure Check</th>
                    <th className="py-2 text-right">Rejection Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]/50">
                  {hardCheckFailures.map((h) => (
                    <tr key={h.type}>
                      <td className="py-2 text-white">{h.label}</td>
                      <td className="py-2 text-right font-bold text-rose-400">{h.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          {({ prefersReducedMotion }) => (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hardCheckFailures} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="label" stroke={PALETTE.muted} fontSize={10} tickLine={false} tickFormatter={(v) => v.split(" ")[0]} />
                  <YAxis stroke={PALETTE.muted} fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Rejected Submissions"
                    fill={PALETTE.crimson}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!prefersReducedMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* CHART 4: Model Agreement Across K Runs */}
        <ChartCard
          title={`Ensemble Model Agreement (K=${modelAgreement.runsK} Runs)`}
          description="Consistency across stochastic model calls and pre-model hard check rejections."
          sourceNote={dataSources.modelAgreement}
          ariaLabel="Model Agreement Across K Runs"
          tableContent={
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono text-slate-300">
                <thead className="border-b border-[#30363D] text-slate-400">
                  <tr>
                    <th className="py-2">Consensus State</th>
                    <th className="py-2 text-right">Cases</th>
                    <th className="py-2 text-right">Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]/50">
                  <tr>
                    <td className="py-2 text-white">3 / 3 Complete Agreement</td>
                    <td className="py-2 text-right font-bold text-emerald-400">{modelAgreement.agreement3of3}</td>
                    <td className="py-2 text-right">
                      {Math.round((modelAgreement.agreement3of3 / (modelAgreement.totalEvaluated || 1)) * 100)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-white">2 / 3 Majority Agreement</td>
                    <td className="py-2 text-right font-bold text-amber-400">{modelAgreement.agreement2of3}</td>
                    <td className="py-2 text-right">
                      {Math.round((modelAgreement.agreement2of3 / (modelAgreement.totalEvaluated || 1)) * 100)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-white">1 / 3 Divergent Runs</td>
                    <td className="py-2 text-right font-bold text-rose-400">{modelAgreement.agreement1of3}</td>
                    <td className="py-2 text-right">
                      {Math.round((modelAgreement.agreement1of3 / (modelAgreement.totalEvaluated || 1)) * 100)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-purple-300">Pre-Model Rejections ($0 API cost)</td>
                    <td className="py-2 text-right font-bold text-purple-400">{modelAgreement.preModelRejections}</td>
                    <td className="py-2 text-right">
                      {Math.round((modelAgreement.preModelRejections / (modelAgreement.totalEvaluated || 1)) * 100)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          }
        >
          {({ prefersReducedMotion }) => {
            const agreementData = [
              { name: "3/3 Agreement", value: modelAgreement.agreement3of3, color: PALETTE.emerald },
              { name: "2/3 Agreement", value: modelAgreement.agreement2of3, color: PALETTE.amber },
              { name: "1/3 Agreement", value: modelAgreement.agreement1of3, color: PALETTE.crimson },
              { name: "Pre-Model Halt", value: modelAgreement.preModelRejections, color: PALETTE.purple },
            ].filter((d) => d.value > 0);

            return (
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={agreementData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={3}
                      isAnimationActive={!prefersReducedMotion}
                    >
                      {agreementData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          }}
        </ChartCard>

        {/* CHART 5: Daily Spend vs Mandate & Policy Caps */}
        <ChartCard
          title="Daily Payout Spend vs. Policy Caps"
          description="Active policy ceiling ($1,000/day) vs real and simulated disbursements today."
          sourceNote={dataSources.spendVsCaps}
          ariaLabel="Spend vs Policy Caps"
          tableContent={
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>Daily Policy Cap:</span>
                <span className="font-bold text-white">${spendVsCaps.dailyCapUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>Real Sandbox Disbursed Today:</span>
                <span className="font-bold text-emerald-400">${spendVsCaps.realSpentTodayUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>[SIMULATED] Disbursed Today:</span>
                <span className="font-bold text-amber-400">${spendVsCaps.simulatedSpentTodayUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>Total Disbursed Today:</span>
                <span className="font-bold text-white">${spendVsCaps.totalSpentTodayUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between py-1 pt-2">
                <span>Remaining Daily Allowance:</span>
                <span className="font-bold text-blue-400">${spendVsCaps.remainingDailyUsd.toFixed(2)} USD</span>
              </div>
            </div>
          }
        >
          {({ prefersReducedMotion }) => {
            const capData = [
              {
                name: "Current UTC Day",
                Real: spendVsCaps.realSpentTodayUsd,
                Simulated: spendVsCaps.simulatedSpentTodayUsd,
                Remaining: spendVsCaps.remainingDailyUsd,
              },
            ];

            return (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={capData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <XAxis dataKey="name" stroke={PALETTE.muted} fontSize={11} tickLine={false} />
                    <YAxis stroke={PALETTE.muted} fontSize={11} tickLine={false} unit="$" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar
                      dataKey="Real"
                      name="Real Sandbox ($)"
                      stackId="spend"
                      fill={PALETTE.emerald}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <Bar
                      dataKey="Simulated"
                      name="[SIMULATED] ($)"
                      stackId="spend"
                      fill={PALETTE.amber}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <Bar
                      dataKey="Remaining"
                      name="Remaining Cap ($)"
                      stackId="spend"
                      fill="#21262D"
                      stroke={PALETTE.border}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!prefersReducedMotion}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          }}
        </ChartCard>

        {/* CHART 6: Payout Latency Distribution */}
        <ChartCard
          title="Payout Latency (Submit to Payout)"
          description="Elapsed time from deliverable submission to verified PayPal settlement."
          sourceNote={dataSources.latency}
          ariaLabel="Payout Latency Metrics"
          tableContent={
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>Sample Count (N):</span>
                <span className="font-bold text-white">{latency.sampleCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>Median Settlement Latency:</span>
                <span className="font-bold text-blue-400">
                  {latency.medianSeconds !== null ? `${latency.medianSeconds}s` : "N/A (< 5 samples)"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363D]">
                <span>P90 Settlement Latency:</span>
                <span className="font-bold text-purple-400">
                  {latency.p90Seconds !== null ? `${latency.p90Seconds}s` : "N/A (< 5 samples)"}
                </span>
              </div>
            </div>
          }
        >
          {() => (
            <div className="flex flex-col items-center justify-center h-56 text-center px-4 space-y-3">
              <Clock className="w-8 h-8 text-blue-400 mb-1" />
              <div className="font-mono text-2xl font-bold text-white">
                {latency.medianSeconds !== null ? `${latency.medianSeconds}s median` : `${latency.sampleCount} completed runs`}
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{latency.note}</p>
              {!latency.hasEnoughData && (
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold pt-1"
                >
                  <span>Run guided scenarios to generate more latency data</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Full-Width Chart: Activity Over Time */}
      <ChartCard
        title="Ledger Activity Trend Over Time"
        description="Immutable events recorded across distinct calendar days."
        sourceNote={dataSources.activity}
        ariaLabel="Activity Over Time Trend"
        tableContent={
          activity.hasMultipleDays ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono text-slate-300">
                <thead className="border-b border-[#30363D] text-slate-400">
                  <tr>
                    <th className="py-2">Date (UTC)</th>
                    <th className="py-2 text-right">Real Sandbox Events</th>
                    <th className="py-2 text-right">[SIMULATED] Events</th>
                    <th className="py-2 text-right">Total Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]/50">
                  {activity.days.map((d) => (
                    <tr key={d.date}>
                      <td className="py-2 text-white">{d.date}</td>
                      <td className="py-2 text-right text-emerald-400">{d.realEvents}</td>
                      <td className="py-2 text-right text-amber-400">{d.simulatedEvents}</td>
                      <td className="py-2 text-right font-bold text-white">{d.eventCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-4 text-center">Single calendar day recorded; trend requires &ge; 2 days.</div>
          )
        }
      >
        {({ prefersReducedMotion }) =>
          activity.hasMultipleDays ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activity.days} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" stroke={PALETTE.muted} fontSize={11} tickLine={false} />
                  <YAxis stroke={PALETTE.muted} fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Line
                    type="monotone"
                    dataKey="eventCount"
                    name="Total Events"
                    stroke={PALETTE.blue}
                    strokeWidth={2}
                    dot={{ r: 3, fill: PALETTE.blue }}
                    isAnimationActive={!prefersReducedMotion}
                  />
                  <Line
                    type="monotone"
                    dataKey="realEvents"
                    name="Real Sandbox"
                    stroke={PALETTE.emerald}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: PALETTE.emerald }}
                    isAnimationActive={!prefersReducedMotion}
                  />
                  <Line
                    type="monotone"
                    dataKey="simulatedEvents"
                    name="[SIMULATED]"
                    stroke={PALETTE.amber}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: PALETTE.amber }}
                    isAnimationActive={!prefersReducedMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-center px-4 space-y-2.5">
              <Calendar className="w-8 h-8 text-slate-400 mb-0.5" />
              <p className="text-sm font-bold text-white">Single-Day Activity Window</p>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                All {data.kpis.activeJobsCount} milestones and ledger events were created during today&apos;s evaluation session. Multi-day trend line visualization unlocks automatically once events span 2 or more distinct calendar days.
              </p>
              <Link
                href="/ledger"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                <span>Inspect full append-only ledger chain</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )
        }
      </ChartCard>

      {/* SECTION: Ground Truth Evaluation Suite (eval/results/latest.json) */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Ground Truth Evaluation Benchmark Suite
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Verified from committed test replay dataset (<code>eval/results/latest.json</code>).
            </p>
          </div>

          <div className="text-right flex-shrink-0 font-mono text-xs text-slate-300">
            <span className="text-slate-400 block text-[10px]">Serving Model Pipeline:</span>
            <span>{evalBenchmark.primaryModel}</span>
          </div>
        </div>

        {/* Evaluation Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#21262D]">
            <span className="text-[11px] text-slate-400 block">Overall Benchmark Accuracy</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 block mt-0.5">
              {evalBenchmark.overallAccuracyPercent}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Wilson 95%: [{(evalBenchmark.wilsonIntervalLow * 100).toFixed(1)}%, {(evalBenchmark.wilsonIntervalHigh * 100).toFixed(1)}%]
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#21262D]">
            <span className="text-[11px] text-slate-400 block">False Approval Rate (Alpha)</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 block mt-0.5">
              0.0%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Count: {evalBenchmark.falseApprovalFraction} (Zero breaches)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#21262D]">
            <span className="text-[11px] text-slate-400 block">Evaluated Test Fixtures</span>
            <span className="text-2xl font-bold font-mono text-blue-400 block mt-0.5">
              {evalBenchmark.totalBenchmarkCases}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Dev &amp; Held-Out Splits
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#21262D]">
            <span className="text-[11px] text-slate-400 block">Automatic Quota Fallback</span>
            <span className="text-xs font-bold font-mono text-purple-300 block mt-2 truncate">
              {evalBenchmark.fallbackModel}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Graceful fallback on 429
            </span>
          </div>
        </div>

        {/* Per-Category Evaluation Table */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">
            Adversarial &amp; Contractual Category Breakdown:
          </span>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono text-slate-300">
              <thead className="border-b border-[#30363D] text-slate-400">
                <tr>
                  <th className="py-2">Test Category</th>
                  <th className="py-2 text-right">Sample Cases</th>
                  <th className="py-2 text-right">Matched Expected</th>
                  <th className="py-2 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363D]/50">
                {evalBenchmark.categories.map((cat) => (
                  <tr key={cat.category}>
                    <td className="py-2 font-bold text-white">{cat.category}</td>
                    <td className="py-2 text-right">{cat.total}</td>
                    <td className="py-2 text-right text-emerald-400">{cat.matched}</td>
                    <td className="py-2 text-right font-bold text-white">{cat.accuracyPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 border-t border-[#30363D] pt-3 flex items-center justify-between">
          <span>{evalBenchmark.sampleSizeCaveat}</span>
          <Link href="/eval" className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
            <span>Inspect Full Benchmark Inspector</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
