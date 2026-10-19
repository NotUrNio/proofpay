/**
 * Hosted Smoke Verification Suite for ProofPay.
 * Runs non-destructive read-only probes against any hosted deployment or local server.
 *
 * Usage: npx tsx scripts/hosted-smoke.ts <BASE_URL> [--run-demo]
 * Example: npx tsx scripts/hosted-smoke.ts http://localhost:3000
 */

interface CheckResult {
  check: string;
  target: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

const SECRET_PATTERNS = [
  /PAYPAL_CLIENT_SECRET/i,
  /BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY/,
  /[a-zA-Z0-9_-]{20,}:[a-zA-Z0-9_-]{40,}/, // Basic auth token in URL
  /sandbox-password/i,
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(baseUrl: string, maxWaitMs = 90000): Promise<boolean> {
  const start = Date.now();
  console.log(`Pinging ${baseUrl} (allowing up to ${maxWaitMs / 1000}s for Render cold start)...`);

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${baseUrl}/`, { method: "HEAD", headers: { Connection: "close" } });
      if (res.status >= 200 && res.status < 500) {
        console.log(`Server responded with HTTP ${res.status} in ${((Date.now() - start) / 1000).toFixed(1)}s.`);
        return true;
      }
    } catch {
      // Retrying
    }
    await sleep(2500);
  }
  return false;
}

export async function runHostedSmoke(baseUrl: string, runDemo = false) {
  const normBase = baseUrl.replace(/\/+$/, "");
  const results: CheckResult[] = [];

  console.log("================================================================================");
  console.log(`ProofPay Hosted Smoke Probe: ${normBase}`);
  console.log("================================================================================\n");

  const isUp = await waitForServer(normBase, 90000);
  if (!isUp) {
    console.error(`\nFAILED: Server at ${normBase} did not become healthy within 90s.`);
    process.exit(1);
  }

  // 1. Read-Only Core Routes Return HTTP 200
  const readOnlyRoutes = ["/", "/studio", "/ledger", "/api/stats/analytics"];
  for (const route of readOnlyRoutes) {
    try {
      const res = await fetch(`${normBase}${route}`, {
        headers: {
          Cookie: "proofpay_role=client",
          "User-Agent": "ProofPay-Hosted-Smoke/1.0",
        },
      });
      const text = await res.text();
      const hasSecret = SECRET_PATTERNS.some((p) => p.test(text));

      results.push({
        check: "Read-only route availability",
        target: `GET ${route}`,
        expected: "HTTP 200 (no secrets)",
        actual: `HTTP ${res.status}${hasSecret ? " [SECRET DETECTED!]" : ""}`,
        passed: res.status === 200 && !hasSecret,
      });
    } catch (err: any) {
      results.push({
        check: "Read-only route availability",
        target: `GET ${route}`,
        expected: "HTTP 200",
        actual: `Error: ${err.message}`,
        passed: false,
      });
    }
  }

  // 2. Mutating Routes Return HTTP 403 Without Role Cookie
  const mutatingRoutes = [
    { method: "POST", path: "/api/jobs", body: { title: "Probe", amount: "5.00" } },
    { method: "POST", path: "/api/inbox", body: { jobId: "fake", action: "approve" } },
    { method: "POST", path: "/api/policy", body: { action: "restore" } },
  ];

  for (const mut of mutatingRoutes) {
    try {
      const res = await fetch(`${normBase}${mut.path}`, {
        method: mut.method,
        headers: {
          "Content-Type": "application/json",
          // Intentionally omitting Cookie header
        },
        body: JSON.stringify(mut.body),
      });

      results.push({
        check: "Cookie-less mutation rejection",
        target: `${mut.method} ${mut.path}`,
        expected: "HTTP 403",
        actual: `HTTP ${res.status}`,
        passed: res.status === 403,
      });
    } catch (err: any) {
      results.push({
        check: "Cookie-less mutation rejection",
        target: `${mut.method} ${mut.path}`,
        expected: "HTTP 403",
        actual: `Error: ${err.message}`,
        passed: false,
      });
    }
  }

  // 3. x-proofpay-role header is ignored in production
  try {
    const res = await fetch(`${normBase}/api/policy`, {
      headers: {
        "x-proofpay-role": "reviewer", // Header without cookie
      },
    });
    // In production without ENABLE_TEST_ROLE_HEADER, this should return 403
    const isIgnored = res.status === 403;
    results.push({
      check: "x-proofpay-role header ignored without cookie",
      target: "GET /api/policy (x-proofpay-role: reviewer)",
      expected: "HTTP 403",
      actual: `HTTP ${res.status}`,
      passed: isIgnored,
      notes: isIgnored ? "Header correctly ignored" : "Header was honored (expected in test mode only)",
    });
  } catch (err: any) {
    results.push({
      check: "x-proofpay-role header ignored",
      target: "GET /api/policy",
      expected: "HTTP 403",
      actual: `Error: ${err.message}`,
      passed: false,
    });
  }

  // 4. /api/debug/client-ip returns 404 when ENABLE_DEBUG_CLIENT_IP is unset/false
  try {
    const res = await fetch(`${normBase}/api/debug/client-ip`, {
      headers: {
        Cookie: "proofpay_role=reviewer",
      },
    });
    const expectEnabled = process.env.ENABLE_DEBUG_CLIENT_IP === "true";
    const isExpected = expectEnabled ? res.status === 200 : res.status === 404;
    results.push({
      check: expectEnabled ? "Debug client-ip route active when enabled" : "Debug client-ip route default closed",
      target: "GET /api/debug/client-ip",
      expected: expectEnabled ? "HTTP 200" : "HTTP 404",
      actual: `HTTP ${res.status}`,
      passed: isExpected,
      notes: isExpected
        ? (expectEnabled ? "Debug route active for diagnostics" : "Route disabled by default")
        : (expectEnabled ? `Expected 200, got ${res.status}` : "Route was accessible when it should be closed"),
    });
  } catch (err: any) {
    results.push({
      check: "Debug client-ip route check",
      target: "GET /api/debug/client-ip",
      expected: "HTTP 404",
      actual: `Error: ${err.message}`,
      passed: false,
    });
  }

  // 5. Secret-like strings probe across HTML and API responses
  try {
    const homeRes = await fetch(`${normBase}/`);
    const homeHtml = await homeRes.text();
    const leakedPatterns = SECRET_PATTERNS.filter((p) => p.test(homeHtml));

    results.push({
      check: "Secret-like strings absence",
      target: "GET / (HTML source)",
      expected: "0 leaked secret patterns",
      actual: `${leakedPatterns.length} detected`,
      passed: leakedPatterns.length === 0,
    });
  } catch (err: any) {
    results.push({
      check: "Secret leak probe",
      target: "GET /",
      expected: "0 leaked patterns",
      actual: `Error: ${err.message}`,
      passed: false,
    });
  }

  // 6. Optional Guided Scenario Replay (--run-demo)
  if (runDemo) {
    try {
      const createRes = await fetch(`${normBase}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "proofpay_role=client",
        },
        body: JSON.stringify({
          title: "Smoke Test Autonomous Banner",
          description: "Automated smoke validation of guided demo pipeline",
          amount: "5.00",
          currency: "USD",
          payeeEmail: "priya@proofpay.io",
        }),
      });
      const createData = await createRes.json();
      const jobId = createData.job?.id;

      let submitStatus = 0;
      let hasVerdict = false;

      if (jobId) {
        const submitRes = await fetch(`${normBase}/api/jobs/${jobId}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: "proofpay_role=freelancer",
          },
          body: JSON.stringify({
            fileBase64:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            fileName: "smoke_banner.png",
            mimeType: "image/png",
            fileSizeBytes: 100,
            width: 1080,
            height: 1080,
            useRecordedReplay: true,
          }),
        });
        submitStatus = submitRes.status;
        const submitData = await submitRes.json();
        hasVerdict = Boolean(submitData.verdict || submitData.decision || submitData.success);
      }

      const passed = Boolean(jobId) && submitStatus === 200 && hasVerdict;
      results.push({
        check: "Guided Demo Flow (--run-demo)",
        target: "POST /api/jobs -> /api/jobs/[id]/submit",
        expected: "HTTP 200 with recorded replay verdict",
        actual: `jobId: ${Boolean(jobId)}, submit: ${submitStatus}, verdict: ${hasVerdict}`,
        passed,
      });
    } catch (err: any) {
      results.push({
        check: "Guided Demo Replay",
        target: "POST /api/jobs -> /api/jobs/[id]/submit",
        expected: "HTTP 200",
        actual: `Error: ${err.message}`,
        passed: false,
      });
    }
  }

  // Print Formatted PASS/FAIL Table
  console.log("\n================================================================================");
  console.log("                       HOSTED SMOKE TEST RESULTS TABLE                          ");
  console.log("================================================================================");
  console.log(
    "| Status | Check                                   | Target                          | Actual                |"
  );
  console.log(
    "| :---:  | :-------------------------------------- | :------------------------------ | :-------------------- |"
  );

  let allPassed = true;
  for (const r of results) {
    const badge = r.passed ? "PASS" : "FAIL";
    if (!r.passed) allPassed = false;
    const checkCol = r.check.padEnd(39).slice(0, 39);
    const targetCol = r.target.padEnd(31).slice(0, 31);
    const actualCol = r.actual.padEnd(21).slice(0, 21);
    console.log(`|  ${badge}  | ${checkCol} | ${targetCol} | ${actualCol} |`);
  }
  console.log("================================================================================\n");

  if (!allPassed) {
    console.error("One or more smoke checks failed.");
    process.exit(1);
  } else {
    console.log("All hosted smoke checks passed successfully!");
  }
}

if (process.argv[1]?.endsWith("hosted-smoke.ts")) {
  const urlArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const url = urlArg || process.env.BASE_URL || "http://localhost:3000";
  const runDemo = process.argv.includes("--run-demo");
  runHostedSmoke(url, runDemo)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
