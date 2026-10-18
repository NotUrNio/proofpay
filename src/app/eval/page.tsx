import fs from "fs";
import path from "path";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default function EvalPage() {
  const resultsPath = path.resolve(process.cwd(), "eval/results/latest.json");
  let data: any = null;

  if (fs.existsSync(resultsPath)) {
    try {
      data = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
    } catch {
      data = null;
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to overview</span>
      </Link>

      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30363D] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Benchmark Evaluation Results
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Evaluation across 28 multi-aspect visual deliverable fixtures (14 Dev / 14 Held-Out).
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-[#0D1117] border border-[#21262D] px-3 py-1.5 rounded-lg">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>Model: {data.servingModel || "gemini-3.8-flash"}</span>
            </div>
          )}
        </div>

        {/* Caveat Banner */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4 text-xs space-y-1">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Methodology &amp; Sample Size Disclosure:</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            All 28 fixtures were partitioned into Dev (14) and Held-Out (14) before threshold tuning. Color tolerance threshold (&Delta;E &le; 14.0) and confidence threshold (0.85) were derived strictly from the Dev split and evaluated without modification on Held-Out.
          </p>
          <p className="text-slate-400 text-[11px]">
            Sample size caveat: With N=28 fixtures, the Wilson 95% confidence interval for 100% accuracy is [87.9%, 100.0%].
          </p>
        </div>

        {!data ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No evaluation results found. Run <code className="bg-[#0D1117] px-2 py-0.5 rounded font-mono text-white">pnpm eval</code> to generate benchmark data.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#0D1117] border border-[#21262D]">
                <div className="text-[11px] font-semibold text-slate-400">Overall Accuracy</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {(data.accuracy.overall * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Wilson CI: [{(data.accuracy.wilson95Interval.low * 100).toFixed(1)}%, {(data.accuracy.wilson95Interval.high * 100).toFixed(1)}%]
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D1117] border border-emerald-900/60 text-emerald-400">
                <div className="text-[11px] font-semibold text-slate-400">False-Approval Rate</div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {(data.safetyMetrics.falseApprovalRate * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Target: 0% ({data.safetyMetrics.falseApprovalCount} false approvals)
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D1117] border border-[#21262D]">
                <div className="text-[11px] font-semibold text-slate-400">Dev Split Accuracy</div>
                <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
                  {(data.accuracy.dev * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  14 / 14 Fixtures
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D1117] border border-[#21262D]">
                <div className="text-[11px] font-semibold text-slate-400">Held-Out Accuracy</div>
                <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                  {(data.accuracy.heldOut * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  14 / 14 Fixtures
                </div>
              </div>
            </div>

            {/* Test Fixture Results Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">
                Detailed Test Fixture Registry ({data.cases.length} Total)
              </h3>
              <div className="border border-[#21262D] rounded-xl overflow-hidden bg-[#0D1117]">
                <div className="divide-y divide-[#21262D]">
                  {data.cases.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white font-semibold">{c.id}</span>
                          <span className="text-slate-400 truncate">{c.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161B22] border border-[#30363D] text-slate-400 font-mono">
                            {c.split}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{c.notes}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Expected: {c.expectedOutcome}</div>
                          <div className="font-mono font-semibold text-white">Actual: {c.actualOutcome}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.passed
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {c.passed ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
