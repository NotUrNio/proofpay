import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

async function main() {
  const outputDir = path.resolve(process.cwd(), "docs/ui/before");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Set reviewer role cookie so all pages (/inbox, /policy, /chaos, /studio) are accessible
  await context.addCookies([
    {
      name: "proofpay_role",
      value: "reviewer",
      domain: "localhost",
      path: "/",
    },
  ]);

  // Fetch job ID from local API
  const jobsRes = await fetch("http://localhost:3000/api/jobs");
  const jobsJson = await jobsRes.json();
  const sampleJobId = jobsJson.jobs?.[0]?.id || "aba8ffbc-2005-41c9-9f24-632e7d3f56bb";

  const routes = [
    { name: "01_home", path: "/" },
    { name: "02_jobs_new", path: "/jobs/new" },
    { name: "03_job_details", path: `/jobs/${sampleJobId}` },
    { name: "04_job_submit", path: `/jobs/${sampleJobId}/submit` },
    { name: "05_inbox", path: "/inbox" },
    { name: "06_policy", path: "/policy" },
    { name: "07_chaos", path: "/chaos" },
    { name: "08_studio", path: "/studio" },
    { name: "09_eval", path: "/eval" },
  ];

  const viewports = [
    { label: "390px", width: 390, height: 844 },
    { label: "1440px", width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of routes) {
      const url = `http://localhost:3000${route.path}`;
      console.log(`Capturing ${route.name} at ${vp.label} (${url})...`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        // Small wait for client components / charts to settle
        await page.waitForTimeout(1000);
        const filename = `${route.name}_${vp.label}.png`;
        const filepath = path.join(outputDir, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        console.log(`Saved: ${filepath}`);
      } catch (err: any) {
        console.error(`Failed ${route.name} at ${vp.label}:`, err.message);
      }
    }
    await page.close();
  }

  await browser.close();
  console.log("Finished capturing all before screenshots in docs/ui/before!");
}

main().catch(console.error);
