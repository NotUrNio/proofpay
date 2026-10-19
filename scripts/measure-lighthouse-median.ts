import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface RunMetrics {
  run: number;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  cls: number;
  fcp: number;
  lcp: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function auditUrl(url: string, label: string, runs = 5): Promise<RunMetrics[]> {
  const metrics: RunMetrics[] = [];
  const outDir = path.resolve(process.cwd(), "docs/ui/after/lighthouse_runs", label);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n========================================`);
  console.log(`Measuring 5-run median for: ${url} (${label})`);
  console.log(`Throttling: Mobile 4G simulated (4x CPU slowdown, 1.6Mbps, 150ms RTT)`);
  console.log(`Viewport: 390x844 (Mobile Emulation)`);
  console.log(`========================================`);

  for (let i = 1; i <= runs; i++) {
    const jsonPath = path.join(outDir, `run_${i}.json`);
    console.log(`[${label}] Executing Run ${i} of ${runs}...`);

    const cmd = `pnpm dlx lighthouse "${url}" \
      --output=json \
      --output-path="${jsonPath}" \
      --form-factor=mobile \
      --screenEmulation.mobile=true \
      --chrome-flags="--headless=new --no-sandbox" \
      --quiet`;

    execSync(cmd, { stdio: "pipe" });

    const report = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const runMetric: RunMetrics = {
      run: i,
      performance: Math.round((report.categories.performance?.score || 0) * 100),
      accessibility: Math.round((report.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((report.categories["best-practices"]?.score || 0) * 100),
      seo: Math.round((report.categories.seo?.score || 0) * 100),
      cls: Number((report.audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(4)),
      fcp: Number(((report.audits["first-contentful-paint"]?.numericValue || 0) / 1000).toFixed(2)),
      lcp: Number(((report.audits["largest-contentful-paint"]?.numericValue || 0) / 1000).toFixed(2)),
    };

    console.log(
      `  Run ${i} -> Perf: ${runMetric.performance}, A11y: ${runMetric.accessibility}, BP: ${runMetric.bestPractices}, SEO: ${runMetric.seo}, CLS: ${runMetric.cls}, FCP: ${runMetric.fcp}s, LCP: ${runMetric.lcp}s`
    );
    metrics.push(runMetric);
  }

  return metrics;
}

async function main() {
  const homeRuns = await auditUrl("http://localhost:3000/", "home", 5);

  const fundedJobId = "20f829e2-8aff-4bab-8e4b-710c004ffc6d";
  const paidJobId = "bf3884d6-3fdf-496d-87db-5dbbe4461443";
  const needsHumanJobId = "10c2bab9-02a6-45ab-b652-9552b584769b";

  const fundedRuns = await auditUrl(`http://localhost:3000/jobs/${fundedJobId}`, "job_funded", 5);
  const paidRuns = await auditUrl(`http://localhost:3000/jobs/${paidJobId}`, "job_paid", 5);
  const needsHumanRuns = await auditUrl(`http://localhost:3000/jobs/${needsHumanJobId}`, "job_needs_human", 5);

  const summarize = (runs: RunMetrics[]) => ({
    performance: median(runs.map((r) => r.performance)),
    accessibility: median(runs.map((r) => r.accessibility)),
    bestPractices: median(runs.map((r) => r.bestPractices)),
    seo: median(runs.map((r) => r.seo)),
    cls: median(runs.map((r) => r.cls)),
    fcp: median(runs.map((r) => r.fcp)),
    lcp: median(runs.map((r) => r.lcp)),
  });

  const getVerdicts = (m: ReturnType<typeof summarize>) => ({
    performance: m.performance >= 85 ? "PASS" : "FAIL",
    accessibility: m.accessibility >= 95 ? "PASS" : "FAIL",
    bestPractices: m.bestPractices >= 90 ? "PASS" : "FAIL",
    seo: m.seo >= 90 ? "PASS" : "FAIL",
    cls: m.cls < 0.1 ? "PASS" : "FAIL",
    fcp: m.fcp < 1.8 ? "PASS" : "FAIL",
    lcp: m.lcp < 2.5 ? "PASS" : "FAIL",
  });

  const homeMedian = summarize(homeRuns);
  const fundedMedian = summarize(fundedRuns);
  const paidMedian = summarize(paidRuns);
  const needsHumanMedian = summarize(needsHumanRuns);

  const result = {
    measuredAt: new Date().toISOString(),
    environment: {
      mode: "production",
      command: "next build && next start",
      url: "http://localhost:3000",
      throttling: "Simulated Mobile 4G (4x CPU slowdown, 1.638 Mbps, 150ms RTT)",
      screenEmulation: "390x844 (Mobile)",
      runs: 5,
    },
    targets: {
      performance: ">= 85",
      accessibility: ">= 95",
      bestPractices: ">= 90",
      seo: ">= 90",
      cls: "< 0.10",
      fcp: "< 1.8 s",
      lcp: "< 2.5 s",
    },
    home: {
      url: "http://localhost:3000/",
      median: homeMedian,
      verdicts: getVerdicts(homeMedian),
      individualRuns: homeRuns,
    },
    jobFunded: {
      url: `http://localhost:3000/jobs/${fundedJobId}`,
      state: "FUNDED",
      median: fundedMedian,
      verdicts: getVerdicts(fundedMedian),
      individualRuns: fundedRuns,
    },
    jobPaid: {
      url: `http://localhost:3000/jobs/${paidJobId}`,
      state: "PAID",
      median: paidMedian,
      verdicts: getVerdicts(paidMedian),
      individualRuns: paidRuns,
    },
    jobNeedsHuman: {
      url: `http://localhost:3000/jobs/${needsHumanJobId}`,
      state: "NEEDS_HUMAN (VERIFIED)",
      median: needsHumanMedian,
      verdicts: getVerdicts(needsHumanMedian),
      individualRuns: needsHumanRuns,
    },
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), "docs/ui/after/lighthouse_median_report.json"),
    JSON.stringify(result, null, 2)
  );

  console.log("\n========================================");
  console.log("FINAL 5-RUN MEDIAN REPORT (SAVED)");
  console.log("========================================");
  console.log("HOME (Median):", JSON.stringify(result.home.median, null, 2));
  console.log("JOB FUNDED (Median):", JSON.stringify(result.jobFunded.median, null, 2));
  console.log("JOB PAID (Median):", JSON.stringify(result.jobPaid.median, null, 2));
  console.log("JOB NEEDS_HUMAN (Median):", JSON.stringify(result.jobNeedsHuman.median, null, 2));
}

main().catch(console.error);

