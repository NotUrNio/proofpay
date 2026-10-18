import { test, expect } from "@playwright/test";

test.describe("ProofPay UI Redesign Smoke Tests", () => {
  test.beforeEach(async ({ context }) => {
    // Default to reviewer role so all lab & inbox routes are accessible
    await context.addCookies([
      {
        name: "proofpay_role",
        value: "reviewer",
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("1. Role switcher changes active demo persona", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open Role Switcher dropdown
    const roleButton = page.locator('button[aria-haspopup="listbox"]');
    await expect(roleButton).toBeVisible();
    await roleButton.click();

    // Select Priya (Freelancer)
    const priyaOption = page.locator('button[role="option"]:has-text("Priya")');
    await expect(priyaOption).toBeVisible();
    await priyaOption.click();

    // Verify UI reflects Freelancer perspective
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText("Priya");
  });

  test("2. Guided demo scenario executes live pipeline end-to-end", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Locate the first scenario card (Happy Path)
    const runButton = page.locator('button:has-text("Run Live Scenario")').first();
    await expect(runButton).toBeVisible();
    await runButton.click();

    // Wait for live execution outcome card to appear
    const outcomeCard = page.locator('text=Live Pipeline Outcome:');
    await expect(outcomeCard).toBeVisible({ timeout: 15000 });
  });

  test("3. Deliverable submission flow with pre-flight checklist", async ({ page }) => {
    // Fetch a sample job
    const jobsRes = await page.request.get("http://localhost:3000/api/jobs");
    const jobsData = await jobsRes.json();
    const jobId = jobsData.jobs?.[0]?.id;
    expect(jobId).toBeTruthy();

    await page.goto(`/jobs/${jobId}/submit`);
    await page.waitForLoadState("networkidle");

    // Click sample fixture button
    const sampleBtn = page.locator('button:has-text("Compliant Banner")');
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Verify pre-flight checklist activates
    await expect(page.locator("text=PNG image verified")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Exact 1:1 match")).toBeVisible();

    // Submit deliverable
    const submitBtn = page.locator('button:has-text("Submit Deliverable for Instant Verification")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify outcome appears
    await expect(page.locator("text=Inspect Checkpoint Route")).toBeVisible({ timeout: 15000 });
  });

  test("4. Reviewer inbox triage and dry-run preview", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Check if items exist or empty state
    const body = page.locator("body");
    const hasItems = await page.locator("text=Dry-Run Settlement Impact").count();

    if (hasItems > 0) {
      await expect(page.locator("text=Dry-Run Settlement Impact")).toBeVisible();
      await expect(page.locator('button:has-text("Approve & Dispatch")')).toBeVisible();
      await expect(page.locator('button:has-text("Reject & Refund Escrow")')).toBeVisible();
    } else {
      await expect(body).toContainText("Review Queue is Clear");
    }
  });

  test("5. Policy editor presets and counterfactual replay simulator", async ({ page }) => {
    await page.goto("/policy");
    await page.waitForLoadState("networkidle");

    // Click Cautious preset
    const cautiousBtn = page.locator('button:has-text("Cautious")');
    await expect(cautiousBtn).toBeVisible();
    await cautiousBtn.click();

    // Verify confidence updates to 0.95
    await expect(page.getByText("0.95", { exact: true })).toBeVisible();

    // Run Counterfactual Replay
    const replayBtn = page.locator('button:has-text("Run Replay on Guard")');
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();

    // Verify replay results card
    await expect(page.locator("text=Replay Outcome Comparison")).toBeVisible({ timeout: 10000 });
  });
});
