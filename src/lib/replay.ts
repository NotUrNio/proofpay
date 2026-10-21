export interface ReplayOptions {
  jobTitle?: string | null;
  clientEmail?: string | null;
  fileName?: string | null;
  bodyUseRecordedReplay?: boolean;
  envUseRecordedReplay?: string;
  envDemoUseRecordedReplay?: string;
}

/**
 * Determines whether a deliverable submission should evaluate against recorded model responses.
 * Default is true for bundled demo scenarios unless the reviewer explicitly requests live mode.
 */
export function computeIsRecordedReplay(params: ReplayOptions): boolean {
  const title = params.jobTitle || "";
  const email = params.clientEmail || "";
  const file = params.fileName || "";

  const isBundledDemoJob =
    title.startsWith("Demo:") ||
    email === "alice@proofpay.io" ||
    file.includes("case_01") ||
    file.includes("summer_sale_banner") ||
    file.includes("happy-path") ||
    file.includes("compliant");

  const envRecorded = params.envUseRecordedReplay ?? process.env.USE_RECORDED_REPLAY;
  const envDemoRecorded = params.envDemoUseRecordedReplay ?? process.env.DEMO_USE_RECORDED_REPLAY;

  return (
    params.bodyUseRecordedReplay === true ||
    (params.bodyUseRecordedReplay !== false &&
      (isBundledDemoJob ||
        envRecorded === "true" ||
        envDemoRecorded === "true" ||
        file.includes("replay")))
  );
}

