import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

async function capture() {
  const outDir = path.resolve(process.cwd(), "docs/ui/after/studio");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    {
      name: "proofpay_role",
      value: "reviewer",
      domain: "localhost",
      path: "/",
    },
  ]);

  const viewports = [
    { width: 360, height: 800, name: "studio_360px.png" },
    { width: 390, height: 844, name: "studio_390px.png" },
    { width: 1440, height: 900, name: "studio_1440px.png" },
  ];

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:3000/studio", { waitUntil: "networkidle" });
    await page.waitForSelector("text=Verification & Settlement Outcomes", { timeout: 15000 });

    const screenshotPath = path.join(outDir, vp.name);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Captured ${vp.name} (${vp.width}x${vp.height}) -> ${screenshotPath}`);
    await page.close();
  }

  await browser.close();
}

capture().catch(console.error);
