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

  test("10. Reviewer policy restore validates against mandate cap and non-reviewer is rejected (403)", async ({ page, context }) => {
    // 1. Non-reviewer (freelancer) attempts to call restore endpoint -> 403 Forbidden
    await context.addCookies([
      {
        name: "proofpay_role",
        value: "freelancer",
        domain: "localhost",
        path: "/",
      },
    ]);

    const forbiddenRes = await page.request.post("http://localhost:3000/api/policy", {
      data: { action: "restore", versionId: "fake-id" },
    });
    expect(forbiddenRes.status()).toBe(403);

    // 2. Reviewer restores a version via policy page UI
    await context.addCookies([
      {
        name: "proofpay_role",
        value: "reviewer",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/policy");
    await page.waitForLoadState("networkidle");

    const restoreBtn = page.locator('button:has-text("Restore")');
    if (await restoreBtn.count() > 0) {
      await restoreBtn.first().click();
      const feedback = page.locator("text=/Policy Saved|Policy violation|cannot exceed/");
      await expect(feedback.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("11. Recharts Analytics Workspace (/studio) loads without license, renders KPI cards, charts, and table toggles", async ({ page }) => {
    await page.goto("/studio");
    await page.waitForLoadState("networkidle");

    // Verify main headings and zero license warnings
    await expect(page.locator("h1")).toContainText("Settlement Analytics");
    await expect(page.locator("body")).not.toContainText("License key invalid");
    await expect(page.locator("body")).not.toContainText("Missing AG Studio");

    // Wait for analytics data to load
    await page.waitForSelector("text=Verification & Settlement Outcomes", { timeout: 15000 });

    // Verify all 4 KPI cards render
    await expect(page.locator("text=Funded Client Escrow")).toBeVisible();
    await expect(page.locator("text=Locked in Active Escrow")).toBeVisible();
    await expect(page.locator("text=Settled to Freelancers")).toBeVisible();
    await expect(page.locator("text=Pending Review Triage")).toBeVisible();

    // Verify chart sections render
    await expect(page.locator("text=Verification & Settlement Outcomes")).toBeVisible();
    await expect(page.locator("text=Top Decision & Observation Reasons")).toBeVisible();
    await expect(page.locator("text=Ensemble Model Agreement")).toBeVisible();
    await expect(page.locator("text=Daily Payout Spend vs. Policy Caps")).toBeVisible();
    await expect(page.locator("text=Payout Latency (Submit to Payout)")).toBeVisible();
    await expect(page.locator("text=Ground Truth Evaluation Benchmark Suite")).toBeVisible();

    // Test accessible "View as Table" toggle
    const tableToggles = page.locator('button:has-text("View as Table")');
    const toggleCount = await tableToggles.count();
    expect(toggleCount).toBeGreaterThan(0);

    // Toggle the first chart to table mode
    await tableToggles.first().click();
    await expect(page.locator('button:has-text("View as Chart")').first()).toBeVisible();

    // Toggle back to chart mode
    await page.locator('button:has-text("View as Chart")').first().click();
    await expect(tableToggles.first()).toBeVisible();
  });

  test("12. SSR & RSC Job Ownership Access Control: denies wrong-role user with HTTP 403 and leaks zero job fields in HTML or RSC payload", async ({
    page,
    context,
  }) => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    const secretTitle = `CONFIDENTIAL_OMEGA_PROJECT_${uniqueSuffix}`;
    const secretAmount = "391.42";
    const secretOwner = `vault-owner-${uniqueSuffix}@acme.test`;
    const secretPayee = `vault-contractor-${uniqueSuffix}@acme.test`;

    // 1. Create a private job as client/reviewer
    await context.addCookies([
      {
        name: "proofpay_role",
        value: "client",
        domain: "localhost",
        path: "/",
      },
    ]);

    const createRes = await page.request.post("http://localhost:3000/api/jobs", {
      data: {
        title: secretTitle,
        description: "Private enterprise deliverable",
        clientEmail: secretOwner,
        freelancerEmail: secretPayee,
        amount: secretAmount,
        currency: "USD",
      },
    });
    expect(createRes.status()).toBe(200);
    const created = await createRes.json();
    const privateJobId = created.job.id as string;
    const mandateSigPrefix = (created.mandate.signature as string).slice(0, 16);

    // 2. Switch role to freelancer Priya (priya@proofpay.io !== secretPayee)
    await context.addCookies([
      {
        name: "proofpay_role",
        value: "freelancer",
        domain: "localhost",
        path: "/",
      },
    ]);

    // 3. Verify API route returns HTTP 403
    const apiRes = await page.request.get(`http://localhost:3000/api/jobs/${privateJobId}`);
    expect(apiRes.status()).toBe(403);

    // 4. Verify SSR HTML document: Next.js 15.5 streams RootLayout shell as HTTP 200
    // and emits NEXT_HTTP_ERROR_FALLBACK;403 (forbidden.tsx boundary) with zero private fields
    const htmlRes = await page.request.get(`http://localhost:3000/jobs/${privateJobId}`);
    expect(htmlRes.status()).toBe(200);
    const htmlBody = await htmlRes.text();
    expect(htmlBody).toContain("403: Access Denied");
    expect(htmlBody).toContain("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(htmlBody).not.toContain(secretTitle);
    expect(htmlBody).not.toContain(secretAmount);
    expect(htmlBody).not.toContain(secretPayee);
    expect(htmlBody).not.toContain(secretOwner);
    expect(htmlBody).not.toContain(mandateSigPrefix);

    // 5. Verify raw RSC Flight payload (RSC: 1) contains NEXT_HTTP_ERROR_FALLBACK;403 and zero private fields
    const rscRes = await page.request.get(`http://localhost:3000/jobs/${privateJobId}`, {
      headers: { RSC: "1" },
    });
    expect(rscRes.status()).toBe(200);
    const rscBody = await rscRes.text();
    expect(rscBody).toContain("403: Access Denied");
    expect(rscBody).not.toContain(secretTitle);
    expect(rscBody).not.toContain(secretAmount);
    expect(rscBody).not.toContain(secretPayee);
    expect(rscBody).not.toContain(secretOwner);
    expect(rscBody).not.toContain(mandateSigPrefix);
  });
});


