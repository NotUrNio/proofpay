import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import EvalPage from "../src/app/eval/page";

describe("/eval Page & Benchmark Data Integrity", () => {
  const root = process.cwd();
  const latestPath = path.join(root, "eval/results/latest.json");
  const casesPath = path.join(root, "eval/cases.json");

  it("1. validates that latest.json records non-empty observedOutcome for every case", () => {
    expect(fs.existsSync(latestPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
    expect(Array.isArray(data.cases)).toBe(true);
    expect(data.cases.length).toBe(28);

    for (const c of data.cases) {
      expect(c.id).toBeDefined();
      expect(typeof c.observedOutcome).toBe("string");
      expect(c.observedOutcome.length).toBeGreaterThan(0);
      expect(["AUTO_PAY", "NEEDS_HUMAN", "REJECT"]).toContain(c.observedOutcome);
      expect(typeof c.match).toBe("boolean");
      expect(c.match).toBe(true);
    }
  });

  it("2. confirms PASS-row count equals accuracy numerator on cards", () => {
    const data = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
    const passCount = data.cases.filter((c: any) => c.match === true).length;
    expect(passCount).toBe(28);
    expect(data.sampleSize.total).toBe(28);
    expect(data.accuracy.overall).toBe(1);
  });

  it("3. validates false-approval (0/22) and human-review (6/28) row counts match summary", () => {
    const data = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
    const falseApprovals = data.cases.filter(
      (c: any) => c.expectedOutcome !== "AUTO_PAY" && c.observedOutcome === "AUTO_PAY"
    );
    expect(falseApprovals.length).toBe(0);
    expect(data.safetyMetrics.falseApprovalCount).toBe("0/22");

    const humanReviews = data.cases.filter((c: any) => c.observedOutcome === "NEEDS_HUMAN");
    expect(humanReviews.length).toBe(6);
    expect(data.safetyMetrics.humanReviewCount).toBe("6/28");
  });

  it("4. establishes true split: cases.json and latest.json both confirm 13 Dev and 15 Held-Out", () => {
    const cases = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf-8"));

    const casesDev = cases.filter((c: any) => c.split === "dev").length;
    const casesHeld = cases.filter((c: any) => c.split === "held_out").length;
    expect(casesDev).toBe(13);
    expect(casesHeld).toBe(15);
    expect(cases.length).toBe(28);

    const latestDev = latest.cases.filter((c: any) => c.split === "dev").length;
    const latestHeld = latest.cases.filter((c: any) => c.split === "held_out").length;
    expect(latestDev).toBe(13);
    expect(latestHeld).toBe(15);
    expect(latest.sampleSize.dev).toBe(13);
    expect(latest.sampleSize.heldOut).toBe(15);
    expect(latest.sampleSize.total).toBe(28);
  });

  it("5. confirms servingModels breakdown: 14 primary, 8 fallback, 6 pre-model deterministic rejections", () => {
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
    expect(latest.servingModels["gemini-3.8-flash"]).toBe(14);
    expect(latest.servingModels["gemini-3.5-flash-lite"]).toBe(8);

    const modelCalled = latest.cases.filter((c: any) => c.modelCalled === true).length;
    const preModelRejected = latest.cases.filter((c: any) => c.modelCalled === false).length;
    expect(modelCalled).toBe(22);
    expect(preModelRejected).toBe(6);
    expect(modelCalled + preModelRejected).toBe(28);
    expect(latest.verifyMode).toBe("replay");
  });

  it("6. renders /eval page and verifies zero blank outcomes, zero incorrect FAIL rows, and dynamic split counts", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(EvalPage));

    // Must show true split
    expect(html).toContain("13 Dev / 15 Held-Out");
    expect(html).toContain("13 / 13 Fixtures");
    expect(html).toContain("15 / 15 Fixtures");
    expect(html).toContain("28 / 28 Fixtures");

    // Must show serving models attribution
    expect(html).toContain("Serving: 14 gemini-3.8-flash (primary) + 8 gemini-3.5-flash-lite (fallback)");
    expect(html).toContain("6 rejected by deterministic checks before model call");
    expect(html).toContain("Mode: replay (offline replay)");

    // Must NOT contain hardcoded 14 Dev / 14 Held-Out
    expect(html).not.toContain("14 Dev / 14 Held-Out");

    // Every single case row must show its actual outcome and PASS
    const actualMatches = html.match(/Actual:\s*(AUTO_PAY|NEEDS_HUMAN|REJECT)/g);
    expect(actualMatches?.length).toBe(28);
    expect(html).not.toContain("Actual: no recorded result");
    expect(html).not.toContain("no recorded result");

    const passMatches = html.match(/>PASS</g);
    expect(passMatches?.length).toBe(28);
    expect(html).not.toContain(">FAIL<");
  });

  it("7. proves rendered page contains no typed numbers by injecting a mock fixture with different counts", () => {
    const mockData = {
      timestamp: "2026-10-19T00:00:00Z",
      verifyMode: "replay",
      modelId: "gemini-3.8-flash",
      sampleSize: { total: 10, dev: 4, heldOut: 6 },
      servingModels: { "gemini-3.8-flash": 6, "gemini-3.5-flash-lite": 2 },
      accuracy: {
        overall: 0.9,
        dev: 1.0,
        heldOut: 0.8333,
        wilson95Interval: { low: 0.5958, high: 0.9821 },
        wilson95DevInterval: { low: 0.5101, high: 1.0 },
        wilson95HeldOutInterval: { low: 0.4365, high: 0.9699 },
      },
      safetyMetrics: {
        falseApprovalRate: 0,
        falseApprovalCount: "0/8",
      },
      cases: [
        { id: "case_01", name: "Mock 1", split: "dev", expectedOutcome: "AUTO_PAY", observedOutcome: "AUTO_PAY", match: true },
        { id: "case_02", name: "Mock 2", split: "dev", expectedOutcome: "AUTO_PAY", observedOutcome: "AUTO_PAY", match: true },
        { id: "case_03", name: "Mock 3", split: "dev", expectedOutcome: "REJECT", observedOutcome: "REJECT", match: true },
        { id: "case_04", name: "Mock 4", split: "dev", expectedOutcome: "NEEDS_HUMAN", observedOutcome: "NEEDS_HUMAN", match: true },
        { id: "case_05", name: "Mock 5", split: "held_out", expectedOutcome: "AUTO_PAY", observedOutcome: "AUTO_PAY", match: true },
        { id: "case_06", name: "Mock 6", split: "held_out", expectedOutcome: "AUTO_PAY", observedOutcome: "AUTO_PAY", match: true },
        { id: "case_07", name: "Mock 7", split: "held_out", expectedOutcome: "AUTO_PAY", observedOutcome: "AUTO_PAY", match: true },
        { id: "case_08", name: "Mock 8", split: "held_out", expectedOutcome: "AUTO_PAY", observedOutcome: "AUTO_PAY", match: true },
        { id: "case_09", name: "Mock 9", split: "held_out", expectedOutcome: "REJECT", observedOutcome: "REJECT", match: true },
        { id: "case_10", name: "Mock 10", split: "held_out", expectedOutcome: "AUTO_PAY", observedOutcome: "REJECT", match: false },
      ],
    };

    // Temporarily spy on fs.readFileSync
    const originalReadFileSync = fs.readFileSync;
    const spy = (p: any, opts: any) => {
      if (typeof p === "string" && p.includes("latest.json")) {
        return JSON.stringify(mockData);
      }
      return originalReadFileSync(p, opts);
    };

    (fs as any).readFileSync = spy;

    try {
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(EvalPage));

      // Assert that mock numbers appear dynamically and no original numbers are hardcoded
      expect(html).toContain("4 Dev / 6 Held-Out");
      expect(html).toContain("9 / 10 Fixtures");
      expect(html).toContain("4 / 4 Fixtures");
      expect(html).toContain("5 / 6 Fixtures");
      expect(html).toContain("Serving: 6 gemini-3.8-flash (primary) + 2 gemini-3.5-flash-lite (fallback)");
      expect(html).toContain("2 rejected by deterministic checks before model call");
      expect(html).toContain("Target: 0% (0/8 false approvals)");
      expect(html).toContain(">FAIL<"); // Case 10 failed
    } finally {
      (fs as any).readFileSync = originalReadFileSync;
    }
  });
});

