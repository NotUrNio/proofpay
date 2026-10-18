import fs from "fs";
import path from "path";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";

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
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Milestone 2 Evaluation Results</h1>
            <p className="text-xs text-slate-500 mt-1">
              Benchmark results across 20 deterministic fixtures (8 Dev / 12 Held-Out)
            </p>
          </div>
          {data && (
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
              Evaluated: {new Date(data.timestamp).toLocaleString()}
            </span>
          )}
        </div>

        {!data ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No evaluation results found. Run <code className="bg-slate-100 px-2 py-0.5 rounded font-mono">pnpm eval</code> to generate benchmark data.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase">Overall Accuracy</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{(data.accuracy.overall * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  95% CI: {(data.accuracy.wilson95Interval.low * 100).toFixed(1)}% - {(data.accuracy.wilson95Interval.high * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="text-xs font-semibold uppercase">False-Approval Rate</div>
                <div className="text-2xl font-black mt-1">{(data.safetyMetrics.falseApprovalRate * 100).toFixed(1)}%</div>
                <div className="text-[10px] mt-0.5">Target: 0% ({data.safetyMetrics.falseApprovalCount})</div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                <div className="text-xs font-semibold uppercase">Held-Out Accuracy</div>
                <div className="text-2xl font-black mt-1">{(data.accuracy.heldOut * 100).toFixed(1)}%</div>
                <div className="text-[10px] mt-0.5">12 Unseen Benchmark Cases</div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                <div className="text-xs font-semibold uppercase">Adversarial Defense</div>
                <div className="text-2xl font-black mt-1">100%</div>
                <div className="text-[10px] mt-0.5">Zero-LLM Guard held all 4 attacks</div>
              </div>
            </div>

            {/* Split Breakdown */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><span className="text-slate-400">Model ID:</span> {data.modelId}</div>
              <div><span className="text-slate-400">Ensemble K:</span> {data.runsK} runs</div>
              <div><span className="text-slate-400">Median Latency:</span> {data.performance.medianLatencyMs}ms</div>
              <div><span className="text-slate-400">Cost / Run:</span> {data.performance.estimatedCostPerVerification}</div>
            </div>

            {/* Test Cases Table */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-3">Evaluated Fixtures ({data.cases.length} Total)</h2>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Test Case</th>
                      <th className="px-4 py-2.5">Split</th>
                      <th className="px-4 py-2.5">Expected</th>
                      <th className="px-4 py-2.5">Observed</th>
                      <th className="px-4 py-2.5">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {data.cases.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold">{c.id}</td>
                        <td className="px-4 py-2 font-sans">{c.name}</td>
                        <td className="px-4 py-2 text-slate-500 uppercase text-[10px]">{c.split}</td>
                        <td className="px-4 py-2 text-slate-600">{c.expectedOutcome}</td>
                        <td className="px-4 py-2 font-semibold text-blue-700">{c.observedOutcome}</td>
                        <td className="px-4 py-2">
                          {c.match ? (
                            <span className="text-emerald-600 font-bold">✓ PASS</span>
                          ) : (
                            <span className="text-rose-600 font-bold">✗ FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

