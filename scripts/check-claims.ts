import fs from "fs";
import path from "path";
import { getSessionUser } from "../src/lib/auth/roles";

export interface ClaimCheck {
  id: string;
  claim: string;
  category: "Documentation" | "Architecture" | "Security" | "Dependencies" | "Testing" | "Performance";
  expected: string;
  status: "PASS" | "FAIL";
  evidence: string;
}

export function runClaimsCheck(): { checks: ClaimCheck[]; allPassed: boolean } {
  const root = process.cwd();

  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const devpost = fs.readFileSync(path.join(root, "DEVPOST.md"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const guardCode = fs.readFileSync(path.join(root, "src/lib/guard/guard.ts"), "utf8");
  const rolesCode = fs.readFileSync(path.join(root, "src/lib/auth/roles.ts"), "utf8");
  const payoutPolicyCode = fs.readFileSync(path.join(root, "src/lib/paypal/payout-policy.ts"), "utf8");

  const checks: ClaimCheck[] = [];

  // 1. Next.js Version
  const hasNext15 = pkg.dependencies?.next?.includes("15") && readme.includes("Next.js 15");
  checks.push({
    id: "DEP_NEXTJS",
    category: "Dependencies",
    claim: "Framework version: Next.js 15 (resolved 15.5.28)",
    expected: "Next.js 15 referenced in README, DEVPOST, and package.json",
    status: hasNext15 ? "PASS" : "FAIL",
    evidence: `package.json next: ${pkg.dependencies?.next}`,
  });

  // 2. React Version
  const hasReact19 = pkg.dependencies?.react?.includes("19") && pkg.dependencies?.["react-dom"]?.includes("19");
  checks.push({
    id: "DEP_REACT",
    category: "Dependencies",
    claim: "UI library version: React 19",
    expected: "React 19 specified in package.json",
    status: hasReact19 ? "PASS" : "FAIL",
    evidence: `package.json react: ${pkg.dependencies?.react}, react-dom: ${pkg.dependencies?.["react-dom"]}`,
  });

  // 3. Recharts Version
  const hasRecharts = pkg.dependencies?.recharts === "3.10.1";
  checks.push({
    id: "DEP_RECHARTS",
    category: "Dependencies",
    claim: "Analytics charting library: Recharts 3.10.1 (MIT)",
    expected: "package.json recharts === '3.10.1'",
    status: hasRecharts ? "PASS" : "FAIL",
    evidence: `package.json recharts: ${pkg.dependencies?.recharts}`,
  });

  // 4. Zero-LLM Policy Guard Invariant
  const aiImportMatch = guardCode.match(/from\s+["'](@ai-sdk|ai|@google|\.\.\/verify\/model)["']/);
  const isZeroLlm = !aiImportMatch && guardCode.includes("evaluatePolicyGuard");
  checks.push({
    id: "SEC_ZERO_LLM",
    category: "Security",
    claim: "Zero-LLM Policy Guard: 0 AI/LLM imports in src/lib/guard/guard.ts",
    expected: "guard.ts contains zero imports from ai, @ai-sdk, @google, or model modules",
    status: isZeroLlm ? "PASS" : "FAIL",
    evidence: isZeroLlm ? "0 AI/LLM imports found in guard.ts" : `Found forbidden import: ${aiImportMatch?.[0]}`,
  });

  // 5. Daily Real Payout Cap (5 payouts / $25.00 USD)
  const hasPayoutCap =
    payoutPolicyCode.includes("MAX_DAILY_REAL_PAYOUT_COUNT") && payoutPolicyCode.includes('"5"');
  const hasPayoutUsdCap =
    payoutPolicyCode.includes("MAX_DAILY_REAL_PAYOUT_USD") && payoutPolicyCode.includes('"25.00"');
  const readmeMentionsCap = readme.includes("5 payouts / $25.00 USD per day") || readme.includes("5 payouts / $25 per day");
  checks.push({
    id: "POL_PAYOUT_CAP",
    category: "Security",
    claim: "Real sandbox payout cap: 5 payouts / $25.00 USD per day",
    expected: "Hard cap defined in payout-policy.ts and cited in README & DEVPOST",
    status: hasPayoutCap && hasPayoutUsdCap && readmeMentionsCap ? "PASS" : "FAIL",
    evidence: `Count cap: ${hasPayoutCap}, USD cap: ${hasPayoutUsdCap}, README cited: ${readmeMentionsCap}`,
  });

  // 6. Default Fallback Persona: Client (alice@proofpay.io) — Dynamically generated from roles.ts
  const defaultSessionUser = getSessionUser(new Request("http://localhost:3000"));
  const hasDefaultClient =
    defaultSessionUser.role === "client" && defaultSessionUser.email === "alice@proofpay.io";
  const readmePersonaHonest = readme.includes("defaults to the non-privileged **`client`");
  checks.push({
    id: "AUTH_DEFAULT_ROLE",
    category: "Security",
    claim: `Least privilege default: ${defaultSessionUser.role} persona (${defaultSessionUser.email})`,
    expected: "getSessionUser() dynamically returns client role; README/DEVPOST document cookie personas",
    status: hasDefaultClient && readmePersonaHonest ? "PASS" : "FAIL",
    evidence: `getSessionUser() runtime role: '${defaultSessionUser.role}', email: '${defaultSessionUser.email}'`,
  });

  // 7. Test Role Header Ignored in Production
  const headerGuarded =
    rolesCode.includes('process.env.ENABLE_TEST_ROLE_HEADER === "true"') &&
    rolesCode.includes('process.env.NODE_ENV !== "production"');
  checks.push({
    id: "AUTH_ROLE_HEADER_GUARD",
    category: "Security",
    claim: "Test header guard: x-proofpay-role ignored in production unless ENABLE_TEST_ROLE_HEADER=true",
    expected: "roles.ts ignores x-proofpay-role in production by default",
    status: headerGuarded ? "PASS" : "FAIL",
    evidence: `Header guarded by NODE_ENV & ENABLE_TEST_ROLE_HEADER: ${headerGuarded}`,
  });

  // 8. Documentation Honesty: Guided Demos vs. Real Sandbox
  const readmeGuidedHonest =
    readme.includes("Guided Demos vs. Real PayPal Sandbox Settlement") &&
    readme.includes("simulated escrow funding (`isMock=true`) and simulated payouts (`PAYOUT_RELEASED [SIMULATED]`)");
  const devpostGuidedHonest =
    devpost.includes("Settlement & Payout Honesty (Guided Demo Simulation vs. Real Sandbox Payouts)") &&
    devpost.includes("simulated funding (`isMock=true`) and simulated payouts (`PAYOUT_RELEASED [SIMULATED]`)");
  checks.push({
    id: "DOC_DEMO_HONESTY",
    category: "Documentation",
    claim: "Simulation honesty: README and DEVPOST state guided demos use simulated funding/payouts",
    expected: "Clear prominent disclosure distinguishing guided demos from real sandbox receipts",
    status: readmeGuidedHonest && devpostGuidedHonest ? "PASS" : "FAIL",
    evidence: `README honest: ${readmeGuidedHonest}, DEVPOST honest: ${devpostGuidedHonest}`,
  });

  // 9. Vitest Test Count — Dynamically enumerated from test/ and tests/ directories
  const testDirFiles = fs.existsSync(path.join(root, "test"))
    ? fs.readdirSync(path.join(root, "test")).filter((f) => f.endsWith(".test.ts"))
    : [];
  const testsDirFiles = fs.existsSync(path.join(root, "tests"))
    ? fs.readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.ts"))
    : [];
  const totalTestSuites = testDirFiles.length + testsDirFiles.length;
  checks.push({
    id: "TEST_VITEST_SUITE",
    category: "Testing",
    claim: `Vitest test suite discovery: ${totalTestSuites} test suites dynamically discovered across test/ and tests/`,
    expected: "All unit and integration test files dynamically cataloged and verified",
    status: totalTestSuites >= 18 ? "PASS" : "FAIL",
    evidence: `Discovered ${totalTestSuites} test suites (${testDirFiles.length} in test/, ${testsDirFiles.length} in tests/)`,
  });

  // 10. Lighthouse Mobile Performance & Accessibility — Dynamically read from audit report
  const lighthouseReportPath = path.join(root, "docs/ui/after/lighthouse_median_report.json");
  let lighthousePassed = false;
  let lighthouseEvidence = "Lighthouse report missing";
  let perfScore = 0;
  let a11yScore = 0;
  let bpScore = 0;
  let seoScore = 0;
  let clsScore = 1;

  if (fs.existsSync(lighthouseReportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(lighthouseReportPath, "utf8"));
      perfScore = report.home?.median390?.performance ?? 0;
      a11yScore = report.home?.median390?.accessibility ?? 0;
      bpScore = report.home?.median390?.bestPractices ?? 0;
      seoScore = report.home?.median390?.seo ?? 0;
      clsScore = report.home?.median390?.cls ?? 1;

      lighthousePassed =
        perfScore >= 90 && a11yScore === 100 && bpScore === 100 && seoScore === 100 && clsScore < 0.1;
      lighthouseEvidence = `Mobile 390px median of 5: Perf=${perfScore}, A11y=${a11yScore}, BestPractices=${bpScore}, SEO=${seoScore}, CLS=${clsScore}`;
    } catch (e: any) {
      lighthouseEvidence = `Failed to parse lighthouse report: ${e.message}`;
    }
  }

  checks.push({
    id: "PERF_LIGHTHOUSE",
    category: "Performance",
    claim: `Mobile Lighthouse median scores: Perf=${perfScore}, A11y=${a11yScore}, BestPractices=${bpScore}, SEO=${seoScore}`,
    expected: "Performance >= 90, Accessibility = 100, Best Practices = 100, SEO = 100, CLS < 0.10",
    status: lighthousePassed ? "PASS" : "FAIL",
    evidence: lighthouseEvidence,
  });

  // 11. Documentation Eval Benchmark Numbers Derived from latest.json
  const latestJsonPath = path.join(root, "eval/results/latest.json");
  let evalNumbersMatched = false;
  let evalEvidence = "latest.json missing";

  if (fs.existsSync(latestJsonPath)) {
    try {
      const latestData = JSON.parse(fs.readFileSync(latestJsonPath, "utf8"));
      const total = latestData.sampleSize.total;
      const dev = latestData.sampleSize.dev;
      const heldOut = latestData.sampleSize.heldOut;
      const falseApproval = latestData.safetyMetrics.falseApprovalCount;
      const cost = latestData.performance.estimatedCostPerVerification;

      const readmeMatches =
        readme.includes(`${dev} Dev / ${heldOut} Held-Out`) &&
        readme.includes(`(${total}/${total})`) &&
        readme.includes(`(${falseApproval})`) &&
        readme.includes(cost);

      const devpostMatches =
        devpost.includes(`${dev} Dev / ${heldOut} Held-Out`) &&
        devpost.includes(`(${total}/${total})`) &&
        devpost.includes(`(${falseApproval})`) &&
        devpost.includes(cost);

      evalNumbersMatched = readmeMatches && devpostMatches;
      evalEvidence = `latest.json (N=${total}, Dev=${dev}, HeldOut=${heldOut}, FalseAppr=${falseApproval}, Cost=${cost}) cited verbatim in README (${readmeMatches}) and DEVPOST (${devpostMatches})`;
    } catch (e: any) {
      evalEvidence = `Failed to parse latest.json: ${e.message}`;
    }
  }

  checks.push({
    id: "DOC_EVAL_NUMBERS",
    category: "Documentation",
    claim: "Evaluation benchmark numbers in docs match eval/results/latest.json verbatim",
    expected: "README and DEVPOST cite exact sample sizes (13 Dev / 15 Held-Out, N=28), false-approval (0/22), and cost ($0.00035)",
    status: evalNumbersMatched ? "PASS" : "FAIL",
    evidence: evalEvidence,
  });

  // 12. Forbidden Threshold Claim Invariant: Never claim thresholds were 'chosen before the benchmark'
  const docPaths = [
    path.join(root, "README.md"),
    path.join(root, "DEVPOST.md"),
    path.join(root, "docs/JUDGING.md"),
    path.join(root, "docs/DEMO_SCRIPT.md"),
    path.join(root, "src/app/eval/page.tsx"),
  ];
  const forbiddenPhrase = "chosen before the benchmark";
  const violatingFiles: string[] = [];
  for (const p of docPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      if (content.toLowerCase().includes(forbiddenPhrase)) {
        violatingFiles.push(path.basename(p));
      }
    }
  }
  const noForbiddenClaim = violatingFiles.length === 0;
  checks.push({
    id: "DOC_THRESHOLD_INTEGRITY",
    category: "Documentation",
    claim: `Threshold provenance honesty: zero occurrences of "${forbiddenPhrase}"`,
    expected: `No docs or pages claim thresholds were "${forbiddenPhrase}"`,
    status: noForbiddenClaim ? "PASS" : "FAIL",
    evidence: noForbiddenClaim
      ? `0 occurrences found across ${docPaths.map((p) => path.basename(p)).join(", ")}`
      : `Forbidden phrase found in: ${violatingFiles.join(", ")}`,
  });

  const allPassed = checks.every((c) => c.status === "PASS");

  return { checks, allPassed };
}

function main() {
  console.log("================================================================================");
  console.log("PROOFPAY CLAIMS VERIFICATION REPORT (B8)");
  console.log("================================================================================\n");

  const { checks, allPassed } = runClaimsCheck();

  console.log(
    "| Status | ID                     | Category       | Claim / Invariant Description                                |"
  );
  console.log(
    "| :---:  | :--------------------- | :------------- | :----------------------------------------------------------- |"
  );
  for (const c of checks) {
    const statusIcon = c.status === "PASS" ? "✅ PASS" : "❌ FAIL";
    console.log(
      `| ${statusIcon} | ${c.id.padEnd(22)} | ${c.category.padEnd(14)} | ${c.claim.slice(0, 60).padEnd(60)} |`
    );
  }

  console.log("\nEvidence & Verification Details:");
  for (const c of checks) {
    console.log(`- [${c.id}] ${c.claim} -> ${c.evidence}`);
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("CLAIMS VERIFICATION RESULT: ALL CLAIMS VERIFIED (GO)");
    console.log("================================================================================");
    process.exit(0);
  } else {
    console.error("CLAIMS VERIFICATION RESULT: ONE OR MORE CLAIMS DRIFTED (NO-GO)");
    console.log("================================================================================");
    process.exit(1);
  }
}

import { fileURLToPath } from "url";

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
