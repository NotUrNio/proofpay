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
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4));
}

async function auditStudio(runs = 5) {
  const url = "http://localhost:3000/studio";
  const label = "studio";
  const outDir = path.resolve(process.cwd(), "docs/ui/after/lighthouse_runs", label);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n========================================`);
  console.log(`Measuring 5-run median for: ${url} (${label})`);
  console.log(`Throttling: Mobile 4G simulated (4x CPU slowdown, 1.6Mbps, 150ms RTT)`);
  console.log(`Viewport: 390x844 (Mobile Emulation)`);
  console.log(`========================================`);

  const metrics: RunMetrics[] = [];

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

    console.log(`  Run ${i}: Perf=${runMetric.performance}, A11y=${runMetric.accessibility}, BestPractices=${runMetric.bestPractices}, SEO=${runMetric.seo}, CLS=${runMetric.cls}, FCP=${runMetric.fcp}s, LCP=${runMetric.lcp}s`);
    metrics.push(runMetric);
  }

  const studioMedian = {
    performance: median(metrics.map((m) => m.performance)),
    accessibility: median(metrics.map((m) => m.accessibility)),
    bestPractices: median(metrics.map((m) => m.bestPractices)),
    seo: median(metrics.map((m) => m.seo)),
    cls: median(metrics.map((m) => m.cls)),
    fcp: median(metrics.map((m) => m.fcp)),
    lcp: median(metrics.map((m) => m.lcp)),
  };

  const targets = {
    performance: ">= 85",
    accessibility: ">= 95",
    cls: "< 0.10",
  };

  const verdicts = {
    performance: {
      target: targets.performance,
      actual: studioMedian.performance,
      pass: studioMedian.performance >= 85,
    },
    accessibility: {
      target: targets.accessibility,
      actual: studioMedian.accessibility,
      pass: studioMedian.accessibility >= 95,
    },
    cls: {
      target: targets.cls,
      actual: studioMedian.cls,
      pass: studioMedian.cls < 0.1,
    },
  };

  const outputReport = {
    timestamp: new Date().toISOString(),
    url,
    throttling: "Mobile 4G simulated (4x CPU slowdown, 1.6Mbps, 150ms RTT)",
    viewport: "390x844 (Mobile Emulation)",
    runsCount: runs,
    targets,
    median: studioMedian,
    verdicts,
    individualRuns: metrics,
  };

  const reportPath = path.resolve(process.cwd(), "docs/ui/after/studio_lighthouse_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(outputReport, null, 2));

  console.log("\n========================================");
  console.log("/STUDIO 5-RUN MEDIAN REPORT");
  console.log("========================================");
  console.log(JSON.stringify(outputReport, null, 2));
}

auditStudio().catch(console.error);
