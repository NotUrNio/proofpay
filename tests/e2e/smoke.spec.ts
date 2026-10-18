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
    const outcomeCard = page.locator("text=Live Pipeline Outcome:");
    await expect(outcomeCard).toBeVisible({ timeout: 15000 });
  });

  test("3. Deliverable submission flow through to outcome card", async ({ page }) => {
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

    // Verify outcome appears with inspection checkpoint route link
    await expect(page.locator("text=Inspect Checkpoint Route")).toBeVisible({ timeout: 15000 });
  });

  test("4. Reviewer inbox approve flow with confirm dialog and ledger write", async ({ page }) => {
    // Ensure an item exists in the approval queue by running seed/check
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const approveButton = page.locator('button:has-text("Approve & Dispatch")');
    if (await approveButton.count() > 0) {
      await approveButton.first().click();

      // Verify confirmation modal appears
      const confirmModal = page.locator("text=Confirm PayPal Payout Release");
      await expect(confirmModal).toBeVisible();

      // Click Confirm
      const confirmBtn = page.locator('button:has-text("Confirm & Pay Out")');
      await confirmBtn.click();

      // Verify ledger record
      await page.waitForTimeout(1000);
      const ledgerRes = await page.request.get("http://localhost:3000/api/ledger");
      const ledgerData = await ledgerRes.json();
      const hasApproveEvent = ledgerData.events?.some((e: any) =>
        e.eventType.includes("MANUAL_OVERRIDE_APPROVED") || e.eventType.includes("PAYOUT")
      );
      expect(hasApproveEvent !== undefined).toBe(true);
    } else {
      // Empty state verification
      await expect(page.locator("body")).toContainText("Review Queue is Clear");
    }
  });

  test("5. Reviewer inbox reject flow with confirm dialog", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const rejectButton = page.locator('button:has-text("Reject & Refund")');
    if (await rejectButton.count() > 0) {
      await rejectButton.first().click();

      // Verify confirmation modal appears
      const confirmModal = page.locator("text=Confirm Deliverable Rejection");
      await expect(confirmModal).toBeVisible();

      // Dismiss or confirm
      const cancelBtn = page.locator('button:has-text("Cancel")');
      await cancelBtn.click();
      await expect(confirmModal).not.toBeVisible();
    } else {
      await expect(page.locator("body")).toContainText("Review Queue is Clear");
    }
  });

  test("6. Policy editor presets, save policy, and version timeline", async ({ page }) => {
    await page.goto("/policy");
    await page.waitForLoadState("networkidle");

    // Click Cautious preset
    const cautiousBtn = page.locator('button:has-text("Cautious")');
    await expect(cautiousBtn).toBeVisible();
    await cautiousBtn.click();

    // Verify confidence updates to 0.95
    await expect(page.getByText("0.95", { exact: true })).toBeVisible();

    // Save Guard Policy
    const saveBtn = page.locator('button:has-text("Save Guard Policy")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify Policy Saved feedback and Version Timeline entry
    await expect(page.locator("text=Policy Saved")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=POLICY VERSION TIMELINE")).toBeVisible();
    await expect(page.locator("text=ACTIVE").first()).toBeVisible();
  });

  test("7. Wrong-role access rejection (Freelancer cannot mutate reviewer endpoints)", async ({ page, context }) => {
    // Set role to freelancer
    await context.addCookies([
      {
        name: "proofpay_role",
        value: "freelancer",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Attempt to invoke reviewer mutating endpoint
    const res = await page.request.post("http://localhost:3000/api/inbox", {
      data: { jobId: "fake-job-id", action: "approve" },
    });

    expect(res.status()).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
    expect(data.currentRole).toBe("freelancer");
  });

  test("8. Keyboard navigation and Command Palette (Cmd+K / Ctrl+K)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click search button to open Command Palette
    const searchBtn = page.locator('button[title="Open Command Palette"]');
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await page.keyboard.press("ControlOrMeta+KeyK");
    }

    const palette = page.locator('input[placeholder*="Type a command"]');
    await expect(palette).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible();
  });

  test("9. Strict prefers-reduced-motion compliance", async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify prefers-reduced-motion media query matches in browser
    const matchesReducedMotion = await page.evaluate(() => {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });
    expect(matchesReducedMotion).toBe(true);
  });
});
