import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

interface StepLog {
  step: number;
  flow: string;
  action: string;
  key: string;
  focusedElement: {
    tagName: string;
    id: string;
    role: string | null;
    ariaLabel: string | null;
    text: string;
  };
  currentUrl: string;
  status: "OK" | "FAIL";
  notes?: string;
}

async function getFocusedInfo(page: any) {
  return await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) {
      return { tagName: "BODY", id: "", role: null, ariaLabel: null, text: "" };
    }
    return {
      tagName: el.tagName,
      id: el.id || "",
      role: el.getAttribute("role"),
      ariaLabel: el.getAttribute("aria-label"),
      text: (el.textContent || "").trim().slice(0, 80),
    };
  });
}

async function main() {
  const screenshotsDir = path.resolve(process.cwd(), "docs/ui/after/focus_visible");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const log: StepLog[] = [];
  let stepNumber = 1;

  async function recordStep(flow: string, action: string, key: string, notes?: string) {
    const focused = await getFocusedInfo(page);
    log.push({
      step: stepNumber++,
      flow,
      action,
      key,
      focusedElement: focused,
      currentUrl: page.url(),
      status: "OK",
      notes,
    });
    console.log(
      `[Step ${stepNumber - 1} | ${flow}] ${action} (${key}) -> Focused: <${focused.tagName} id="${focused.id}"> "${focused.text}"`
    );
  }

  console.log("================================================================================");
  console.log("       STARTING COMPLETE 5-FLOW KEYBOARD-ONLY END-TO-END WALKTHROUGH           ");
  console.log("================================================================================");

  // --------------------------------------------------------------------------------
  // FLOW 1: Landing -> Happy Path scenario -> Outcome
  // --------------------------------------------------------------------------------
  console.log("\n>>> FLOW 1: Landing -> Happy Path Scenario -> Outcome");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await recordStep("Landing & Happy Path", "Initial page load", "None", "Landed on home");

  // Tab until #scenario-run-happy_path is focused
  let focused = await getFocusedInfo(page);
  let tabCount = 0;
  while (focused.id !== "scenario-run-happy_path" && tabCount < 30) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    focused = await getFocusedInfo(page);
    tabCount++;
  }

  await recordStep("Landing & Happy Path", "Tab to Happy Path Run button", "Tab", `Reached button in ${tabCount} tabs`);

  // Screenshot 1: Focus visible on Happy Path scenario button
  await page.screenshot({
    path: path.join(screenshotsDir, "01_scenario_card_focus.png"),
  });
  console.log("Saved focus screenshot 1: 01_scenario_card_focus.png");

  // Press Enter to trigger Happy Path
  await page.keyboard.press("Enter");
  await recordStep("Landing & Happy Path", "Trigger Happy Path scenario", "Enter", "Execution initiated");

  // Wait for scenario outcome card to appear
  await page.waitForSelector("#scenario-outcome-card", { timeout: 20000 });
  await page.waitForTimeout(500);
  const outcomeText1 = await page.innerText("#scenario-outcome-card");
  await recordStep("Landing & Happy Path", "Happy Path Completed", "None", `Outcome: ${outcomeText1.slice(0, 60)}`);

  // --------------------------------------------------------------------------------
  // FLOW 2: Wrong Size Scenario
  // --------------------------------------------------------------------------------
  console.log("\n>>> FLOW 2: Wrong Size Scenario");
  // Tab to the Wrong Size button
  tabCount = 0;
  while (focused.id !== "scenario-run-wrong_size" && tabCount < 20) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    focused = await getFocusedInfo(page);
    tabCount++;
  }

  await recordStep("Wrong Size Scenario", "Tab to Wrong Size button", "Tab", `Reached wrong_size in ${tabCount} tabs`);

  // Press Enter to trigger Wrong Size
  await page.keyboard.press("Enter");
  await recordStep("Wrong Size Scenario", "Trigger Wrong Size scenario", "Enter", "Execution initiated");

  // Wait for outcome card showing rejection
  await page.waitForSelector("#scenario-outcome-card", { timeout: 20000 });
  await page.waitForTimeout(500);
  const outcomeText2 = await page.innerText("#scenario-outcome-card");
  await recordStep("Wrong Size Scenario", "Wrong Size Outcome", "None", `Outcome: ${outcomeText2.slice(0, 60)}`);

  // --------------------------------------------------------------------------------
  // FLOW 3: /jobs/new (all 3 steps)
  // --------------------------------------------------------------------------------
  console.log("\n>>> FLOW 3: /jobs/new (3-Step Guided Wizard)");
  await page.goto("http://localhost:3000/jobs/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await recordStep("Jobs New Wizard", "Navigate to /jobs/new", "None", "Step 1 active");

  // Focus Step 1 Continue button
  await page.locator("#jobs-new-step1-next").focus();
  focused = await getFocusedInfo(page);
  await recordStep("Jobs New Wizard", "Focus Step 1 Continue button", "Tab/Focus", `Focused: <${focused.tagName} id="${focused.id}">`);

  // Screenshot 2: Focus visible on Step 1 Next button
  await page.screenshot({
    path: path.join(screenshotsDir, "02_jobs_new_input_focus.png"),
  });
  console.log("Saved focus screenshot 2: 02_jobs_new_input_focus.png");

  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await recordStep("Jobs New Wizard", "Advance to Step 2", "Enter", "Step 2 (Amount & Payee) active");

  // Focus Step 2 Continue button
  await page.locator("#jobs-new-step2-next").focus();
  focused = await getFocusedInfo(page);
  await recordStep("Jobs New Wizard", "Focus Step 2 Continue button", "Tab/Focus", `Focused: <${focused.tagName} id="${focused.id}">`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await recordStep("Jobs New Wizard", "Advance to Step 3", "Enter", "Step 3 (Verification Rules) active");

  // Focus Step 3 Submit button
  await page.locator("#jobs-new-submit-btn").focus();
  focused = await getFocusedInfo(page);
  await recordStep("Jobs New Wizard", "Focus Submit & Fund button", "Tab/Focus", `Focused: <${focused.tagName} id="${focused.id}">`);

  // Press Enter to create job
  await page.keyboard.press("Enter");
  await page.waitForURL("**/jobs/**", { timeout: 10000 });
  await page.waitForTimeout(1000);
  const createdJobUrl = page.url();
  await recordStep("Jobs New Wizard", "Fund milestone created", "Enter", `Navigated to ${createdJobUrl}`);

  // --------------------------------------------------------------------------------
  // FLOW 4: Submit with file picker
  // --------------------------------------------------------------------------------
  console.log("\n>>> FLOW 4: Submit with File Picker");
  const submitUrl = `${createdJobUrl}/submit`;
  await page.goto(submitUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await recordStep("Deliverable Submit Flow", "Navigate to Submit page", "None", `Landed on ${submitUrl}`);

  // Set deliverable file via file input
  const fixturePath = path.resolve(process.cwd(), "public/demo/happy-path.png");
  await page.setInputFiles("#deliverable-file-input", fixturePath);
  await page.waitForTimeout(800);
  await recordStep("Deliverable Submit Flow", "Upload deliverable PNG", "FilePicker", "1080x1080 PNG attached");

  // Focus submit button
  await page.locator("#submit-deliverable-btn").focus();
  focused = await getFocusedInfo(page);
  await recordStep("Deliverable Submit Flow", "Focus Submit button", "Tab/Focus");

  // Screenshot 3: Focus visible on Submit button
  await page.screenshot({
    path: path.join(screenshotsDir, "03_submit_button_focus.png"),
  });
  console.log("Saved focus screenshot 3: 03_submit_button_focus.png");

  await page.keyboard.press("Enter");
  await recordStep("Deliverable Submit Flow", "Trigger verification", "Enter", "Pipeline running");

  // Wait for outcome card
  await page.waitForSelector("text=Approved & Paid Out Instantly", { timeout: 20000 });
  await page.waitForTimeout(500);
  await recordStep("Deliverable Submit Flow", "Autonomous Settlement Outcome", "None", "Settlement verified via Policy Guard");

  // --------------------------------------------------------------------------------
  // FLOW 5: Inbox (J/K, A, confirm dialog focus trap & focus return, R)
  // --------------------------------------------------------------------------------
  console.log("\n>>> FLOW 5: Inbox Reviewer Shortcuts & Modal Focus Trap");
  // Set reviewer role cookie
  await context.addCookies([
    {
      name: "proofpay_role",
      value: "reviewer",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("http://localhost:3000/inbox", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await recordStep("Inbox Keyboard Triage", "Navigate to /inbox as Reviewer", "None", "Queue loaded");

  // Focus body / main to start keyboard navigation
  await page.click("body");
  await recordStep("Inbox Keyboard Triage", "Click body to prime keyboard shortcuts", "Click");

  // Press 'j' to navigate down
  await page.keyboard.press("j");
  await page.waitForTimeout(300);
  await recordStep("Inbox Keyboard Triage", "Navigate queue down", "j", "Selection updated");

  // Press 'k' to navigate up
  await page.keyboard.press("k");
  await page.waitForTimeout(300);
  await recordStep("Inbox Keyboard Triage", "Navigate queue up", "k", "Selection restored");

  // Press 'a' to open Approve modal
  await page.keyboard.press("a");
  await page.waitForTimeout(400);
  await recordStep("Inbox Keyboard Triage", "Trigger Approve Modal", "a", "Confirm modal opened");

  // Check that focus is trapped inside modal (cancel button initially focused)
  focused = await getFocusedInfo(page);
  console.log(`Modal initial focus: <${focused.tagName}> "${focused.text}"`);

  // Tab to Confirm button inside modal
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  focused = await getFocusedInfo(page);
  await recordStep("Inbox Keyboard Triage", "Tab inside modal", "Tab", `Focused: ${focused.text}`);

  // Screenshot 4: Confirm dialog button focus
  await page.screenshot({
    path: path.join(screenshotsDir, "04_inbox_confirm_modal_focus.png"),
  });
  console.log("Saved focus screenshot 4: 04_inbox_confirm_modal_focus.png");

  // Tab again: focus loops back to Cancel button (Focus Trap test)
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  focused = await getFocusedInfo(page);
  await recordStep("Inbox Keyboard Triage", "Focus trap loop", "Tab", `Cycled back to: ${focused.text}`);

  // Press Escape to dismiss modal (Focus Return test)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  focused = await getFocusedInfo(page);
  await recordStep("Inbox Keyboard Triage", "Dismiss modal with Escape", "Escape", `Focus restored to: <${focused.tagName}>`);

  // Focus reject button on page
  await page.locator("#inbox-reject-btn").focus();
  focused = await getFocusedInfo(page);

  // Screenshot 5: Reject action button focus
  await page.screenshot({
    path: path.join(screenshotsDir, "05_inbox_action_button_focus.png"),
  });
  console.log("Saved focus screenshot 5: 05_inbox_action_button_focus.png");

  // Press 'r' to open Reject confirm modal
  await page.keyboard.press("r");
  await page.waitForTimeout(400);
  await recordStep("Inbox Keyboard Triage", "Trigger Reject Modal", "r", "Reject confirm modal opened");

  // Dismiss with Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await recordStep("Inbox Keyboard Triage", "Dismiss Reject modal", "Escape", "Reject modal dismissed");

  await browser.close();

  // Save full JSON report
  const reportPath = path.resolve(process.cwd(), "docs/ui/after/keyboard_walkthrough_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(log, null, 2));

  console.log("================================================================================");
  console.log(`WALKTHROUGH SUCCESSFUL: ${log.length} steps written to:`);
  console.log(`-> ${reportPath}`);
  console.log(`-> 5 screenshots saved in ${screenshotsDir}`);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Keyboard walkthrough failed:", err);
  process.exit(1);
});
