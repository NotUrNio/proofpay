import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface RunMetrics {
  run: number;
  width: number;
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
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4));
}

async function auditUrl(
  url: string,
  label: string,
  runs = 5,
  width = 390,
  height = 844
): Promise<RunMetrics[]> {
  const metrics: RunMetrics[] = [];
  const outDir = path.resolve(process.cwd(), "docs/ui/after/lighthouse_runs", label);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n========================================`);
  console.log(`Measuring ${runs}-run median for: ${url} (${label} @ ${width}x${height})`);
  console.log(`========================================`);

  for (let i = 1; i <= runs; i++) {
    const jsonPath = path.join(outDir, `run_${i}.json`);
    const cmd = `pnpm dlx lighthouse "${url}" \
      --output=json \
      --output-path="${jsonPath}" \
      --form-factor=mobile \
      --screenEmulation.mobile=true \
      --screenEmulation.width=${width} \
      --screenEmulation.height=${height} \
      --chrome-flags="--headless=new --no-sandbox" \
      --quiet`;

    execSync(cmd, { stdio: "pipe" });

    const report = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const runMetric: RunMetrics = {
      run: i,
      width,
      performance: Math.round((report.categories.performance?.score || 0) * 100),
      accessibility: Math.round((report.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((report.categories["best-practices"]?.score || 0) * 100),
      seo: Math.round((report.categories.seo?.score || 0) * 100),
      cls: Number((report.audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(4)),
      fcp: Number(((report.audits["first-contentful-paint"]?.numericValue || 0) / 1000).toFixed(2)),
      lcp: Number(((report.audits["largest-contentful-paint"]?.numericValue || 0) / 1000).toFixed(2)),
    };

    console.log(
      `  [${label} @ ${width}px] Run ${i}/${runs} -> Perf: ${runMetric.performance}, A11y: ${runMetric.accessibility}, BP: ${runMetric.bestPractices}, SEO: ${runMetric.seo}, CLS: ${runMetric.cls}, FCP: ${runMetric.fcp}s, LCP: ${runMetric.lcp}s`
    );
    metrics.push(runMetric);
  }

  return metrics;
}

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
  seo: m.seo === 100 ? "PASS" : "FAIL",
  cls: m.cls < 0.1 ? "PASS" : "FAIL",
  fcp: m.fcp < 1.8 ? "PASS" : "FAIL",
  lcp: m.lcp < 2.5 ? "PASS" : "FAIL",
});

async function main() {
  const fundedJobId = "20f829e2-8aff-4bab-8e4b-710c004ffc6d";

  // 5-run mobile (390x844) medians on /, /jobs/[id], and /studio
  const homeRuns390 = await auditUrl("http://localhost:3000/", "home", 5, 390, 844);
  const jobRuns390 = await auditUrl(`http://localhost:3000/jobs/${fundedJobId}`, "job_funded", 5, 390, 844);
  const studioRuns390 = await auditUrl("http://localhost:3000/studio", "studio", 5, 390, 844);

  // Additional 360x800 viewport CLS verification on /, /jobs/[id], and /studio
  const homeRuns360 = await auditUrl("http://localhost:3000/", "home_360", 3, 360, 800);
  const jobRuns360 = await auditUrl(`http://localhost:3000/jobs/${fundedJobId}`, "job_funded_360", 3, 360, 800);
  const studioRuns360 = await auditUrl("http://localhost:3000/studio", "studio_360", 3, 360, 800);

  const homeMedian = summarize(homeRuns390);
  const jobMedian = summarize(jobRuns390);
  const studioMedian = summarize(studioRuns390);

  const home360Median = summarize(homeRuns360);
  const job360Median = summarize(jobRuns360);
  const studio360Median = summarize(studioRuns360);

  const result = {
    measuredAt: new Date().toISOString(),
    environment: {
      mode: "production",
      command: "pnpm build && pnpm start",
      url: "http://localhost:3000",
      throttling: "Simulated Mobile 4G (4x CPU slowdown, 1.638 Mbps, 150ms RTT)",
      viewports: ["390x844 (5-run median)", "360x800 (3-run median CLS check)"],
    },
    targets: {
      performance: ">= 85",
      accessibility: ">= 95",
      bestPractices: ">= 90",
      seo: "100",
      cls: "< 0.10",
      fcp: "< 1.8 s",
      lcp: "< 2.5 s",
    },
    home: {
      url: "http://localhost:3000/",
      median390: homeMedian,
      median360: home360Median,
      verdicts: getVerdicts(homeMedian),
      individualRuns390: homeRuns390,
      individualRuns360: homeRuns360,
    },
    jobFunded: {
      url: `http://localhost:3000/jobs/${fundedJobId}`,
      state: "FUNDED",
      median390: jobMedian,
      median360: job360Median,
      verdicts: getVerdicts(jobMedian),
      individualRuns390: jobRuns390,
      individualRuns360: jobRuns360,
    },
    studio: {
      url: "http://localhost:3000/studio",
      median390: studioMedian,
      median360: studio360Median,
      verdicts: getVerdicts(studioMedian),
      individualRuns390: studioRuns390,
      individualRuns360: studioRuns360,
    },
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), "docs/ui/after/lighthouse_median_report.json"),
    JSON.stringify(result, null, 2)
  );
  fs.writeFileSync(
    path.resolve(process.cwd(), "docs/ui/after/studio_lighthouse_report.json"),
    JSON.stringify(result.studio, null, 2)
  );

  console.log("\n========================================");
  console.log("FINAL LIGHTHOUSE MEDIAN REPORT (SAVED)");
  console.log("========================================");
  console.log("HOME (390px Median):", JSON.stringify(homeMedian));
  console.log("HOME (360px Median):", JSON.stringify(home360Median));
  console.log("JOB (390px Median): ", JSON.stringify(jobMedian));
  console.log("JOB (360px Median): ", JSON.stringify(job360Median));
  console.log("STUDIO (390px Med): ", JSON.stringify(studioMedian));
  console.log("STUDIO (360px Med): ", JSON.stringify(studio360Median));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
