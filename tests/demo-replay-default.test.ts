import { describe, it, expect } from "vitest";
import { computeIsRecordedReplay } from "@/lib/replay";

describe("Item 5: Hosted Default for Bundled Guided Scenarios is Recorded Replay", () => {

  it("1. defaults to recorded replay for bundled demo jobs when useRecordedReplay is omitted/unset", () => {
    const result = computeIsRecordedReplay({
      jobTitle: "Demo: Social Media Banner (Summer Sale)",
      clientEmail: "alice@proofpay.io",
      fileName: "summer_sale_banner.png",
      bodyUseRecordedReplay: undefined,
    });
    expect(result).toBe(true);
  });

  it("2. allows reviewer to toggle live mode by explicitly sending useRecordedReplay: false", () => {
    const result = computeIsRecordedReplay({
      jobTitle: "Demo: Social Media Banner (Summer Sale)",
      clientEmail: "alice@proofpay.io",
      fileName: "summer_sale_banner.png",
      bodyUseRecordedReplay: false, // Reviewer toggled live
    });
    expect(result).toBe(false);
  });

  it("3. respects DEMO_USE_RECORDED_REPLAY=true or USE_RECORDED_REPLAY=true even for non-bundled jobs", () => {
    const resultWithDemoEnv = computeIsRecordedReplay({
      jobTitle: "Custom Production Milestone",
      clientEmail: "client@example.com",
      fileName: "deliverable.png",
      envDemoUseRecordedReplay: "true",
    });
    expect(resultWithDemoEnv).toBe(true);

    const resultWithStandardEnv = computeIsRecordedReplay({
      jobTitle: "Custom Production Milestone",
      clientEmail: "client@example.com",
      fileName: "deliverable.png",
      envUseRecordedReplay: "true",
    });
    expect(resultWithStandardEnv).toBe(true);
  });

  it("4. defaults to live for non-bundled, non-demo custom jobs when flags are unset", () => {
    const result = computeIsRecordedReplay({
      jobTitle: "Custom Production Milestone",
      clientEmail: "client@example.com",
      fileName: "deliverable.png",
      bodyUseRecordedReplay: undefined,
    });
    expect(result).toBe(false);
  });
});

