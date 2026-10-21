import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

async function main() {
  const outputDir = path.resolve(process.cwd(), "docs/ui/after/states");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.addCookies([
    {
      name: "proofpay_role",
      value: "reviewer",
      domain: "localhost",
      path: "/",
    },
  ]);

  const states = [
    { name: "funded", jobId: "20f829e2-8aff-4bab-8e4b-710c004ffc6d" },
    { name: "paid", jobId: "bf3884d6-3fdf-496d-87db-5dbbe4461443" },
    { name: "needs_human", jobId: "10c2bab9-02a6-45ab-b652-9552b584769b" },
  ];

  const viewports = [
    { label: "360px", width: 360, height: 740 },
    { label: "390px", width: 390, height: 844 },
    { label: "1440px", width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const state of states) {
      const url = `http://localhost:3000/jobs/${state.jobId}`;
      console.log(`Capturing ${state.name} at ${vp.label} (${url})...`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(500);
        const filename = `job_${state.name}_${vp.label}.png`;
        const filepath = path.join(outputDir, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        console.log(`Saved: ${filepath}`);
      } catch (err: any) {
        console.error(`Failed ${state.name} at ${vp.label}:`, err.message);
      }
    }
    await page.close();
  }

  await browser.close();
  console.log("Finished capturing all 3 job state screenshots in docs/ui/after/states!");
}

main().catch(console.error);

