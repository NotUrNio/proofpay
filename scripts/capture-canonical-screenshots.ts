import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const ALLOWED_EMAIL_DOMAINS = [
  "proofpay.io",
  "example.com",
  "example.test",
  "example.org",
  "example.net",
  "test.com",
  "localhost",
];

function assertEmailPrivacy(text: string, contextUrl: string): void {
  // Regex finding email addresses (including masked emails with asterisks)
  const emailRegex = /([a-zA-Z0-9._%*+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const fullEmail = match[0];
    const username = match[1];
    const domain = match[2].toLowerCase();

    // Masked emails like p***@... or a***@... are valid
    if (username.includes("*") || username.includes("...")) {
      continue;
    }

    // Permitted demo persona / RFC 2606 test domains
    const isAllowedDomain = ALLOWED_EMAIL_DOMAINS.some(
      (d) => domain === d || domain.endsWith("." + d)
    );

    if (!isAllowedDomain) {
      throw new Error(
        `[Privacy Violation] Found unmasked personal email "${fullEmail}" on page ${contextUrl}`
      );
    }
  }
}

async function main() {
  const outputDir = path.resolve(process.cwd(), "docs/screenshots");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Reviewer role ensures full access to all inspector panels and audit views
  await context.addCookies([
    {
      name: "proofpay_role",
      value: "reviewer",
      domain: "localhost",
      path: "/",
    },
  ]);

  const viewports = [
    { label: "1440px", width: 1440, height: 900 },
    { label: "390px", width: 390, height: 844 },
  ];

  const views = [
    {
      name: "01_landing",
      path: "/",
      prepare: async () => {},
    },
    {
      name: "02_guided_demo_outcome",
      path: "/jobs/bf3884d6-3fdf-496d-87db-5dbbe4461443",
      prepare: async () => {},
    },
    {
      name: "03_new_job_step3",
      path: "/jobs/new",
      prepare: async (page: any) => {
        // Advance wizard from step 1 to step 2, then step 3
        const step1Next = page.locator("#jobs-new-step1-next");
        if (await step1Next.isVisible({ timeout: 3000 }).catch(() => false)) {
          await step1Next.click();
          await page.waitForTimeout(400);
        }
        const step2Next = page.locator("#jobs-new-step2-next");
        if (await step2Next.isVisible({ timeout: 3000 }).catch(() => false)) {
          await step2Next.click();
          await page.waitForTimeout(400);
        }
      },
    },
    {
      name: "04_verdict_needs_human",
      path: "/jobs/10c2bab9-02a6-45ab-b652-9552b584769b",
      prepare: async () => {},
    },
    {
      name: "05_inbox",
      path: "/inbox",
      prepare: async () => {},
    },
    {
      name: "06_policy",
      path: "/policy",
      prepare: async () => {},
    },
    {
      name: "07_studio",
      path: "/studio",
      prepare: async () => {},
    },
    {
      name: "08_ledger",
      path: "/ledger",
      prepare: async () => {},
    },
  ];

  console.log("==================================================");
  console.log("Generating Canonical Screenshots into docs/screenshots/");
  console.log("==================================================");

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const view of views) {
      const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
      const url = `${baseUrl}${view.path}`;
      console.log(`Capturing ${view.name} at ${vp.label} (${url})...`);

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(1000);

        if (view.prepare) {
          await view.prepare(page);
          await page.waitForTimeout(500);
        }

        // Privacy check: assert no unmasked or non-whitelisted emails
        const pageText = await page.innerText("body");
        assertEmailPrivacy(pageText, url);

        const filename = `${view.name}_${vp.label}.png`;
        const filepath = path.join(outputDir, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        console.log(`  -> Saved: ${filename}`);
      } catch (err: any) {
        console.error(`  -> Failed ${view.name} at ${vp.label}: ${err.message}`);
        throw err;
      }
    }
    await page.close();
  }

  await browser.close();
  console.log("==================================================");
  console.log("All canonical screenshots successfully generated & verified!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
