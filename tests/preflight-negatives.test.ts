import { describe, it, expect } from "vitest";
import { validateMarkdownLinks, validateRenderYaml } from "../scripts/preflight";
import { checkEnvMap } from "../scripts/check-env-map";
import { execSync } from "child_process";

// If preflight is actively running, skip this test file to prevent nested test runs
const isPreflight = process.env.PREFLIGHT_RUNNING === "1";

describe.skipIf(isPreflight)(
  "Preflight Check Negative Tests (Failure Injection on Seeded Bad Inputs)",
  () => {
    // 1. Negative Test: Markdown Link Integrity Check (pure function, no child process)
    it(
      "1. markdown link check fails when seeded with a broken relative link",
      () => {
        const badInput = [
          {
            file: "README.md",
            content:
              "# ProofPay\nSee our [Broken Spec](docs/non-existent-architecture-file-999.md) for details.",
          },
        ];

        const result = validateMarkdownLinks(badInput);
        expect(result.passed).toBe(false);
        expect(result.brokenCount).toBe(1);
        expect(result.brokenLinks[0]).toContain(
          "non-existent-architecture-file-999.md"
        );
        expect(result.details).toContain("1 broken links found");
      },
      15000
    );

    // 2. Negative Test: Environment Variable Map Check (pure function, no child process)
    it(
      "2. env-map check fails when a required variable is missing from .env.example or render.yaml",
      () => {
        // Seed bad .env.example content missing DATABASE_URL
        const badEnvExample =
          "PAYPAL_CLIENT_ID=test_id\nPAYPAL_CLIENT_SECRET=test_secret\n";
        const goodRenderYaml =
          "services:\n  - envVars:\n      - key: DATABASE_URL\n";

        const result = checkEnvMap({
          envExampleContent: badEnvExample,
          renderYamlContent: goodRenderYaml,
        });

        expect(result.allValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const hasMissingDbErr = result.errors.some((err) =>
          err.includes('Required variable "DATABASE_URL" is missing from .env.example')
        );
        expect(hasMissingDbErr).toBe(true);
      },
      15000
    );

    // 3. Negative Test: Render.yaml Deployment Specification Check (pure function, no child process)
    it(
      "3. render.yaml check fails when seeded with autoDeploy=true or demo:seed in startCommand",
      () => {
        // Bad yaml #1: autoDeploy is true
        const badYamlAutoDeploy = `
services:
  - type: web
    autoDeploy: true
    startCommand: pnpm start
    healthCheckPath: /api/health
`;
        const res1 = validateRenderYaml(badYamlAutoDeploy);
        expect(res1.passed).toBe(false);
        expect(res1.reasons).toContain(
          "autoDeploy is set to true without consent"
        );

        // Bad yaml #2: startCommand invokes demo:seed
        const badYamlSeedInStart = `
services:
  - type: web
    autoDeploy: false
    startCommand: pnpm demo:seed && pnpm start
    healthCheckPath: /api/health
`;
        const res2 = validateRenderYaml(badYamlSeedInStart);
        expect(res2.passed).toBe(false);
        expect(res2.reasons).toContain("startCommand invokes demo:seed");

        // Bad yaml #3: healthCheckPath is wrong
        const badYamlWrongHealth = `
services:
  - type: web
    autoDeploy: false
    startCommand: pnpm start
    healthCheckPath: /some/unsupported/path
`;
        const res3 = validateRenderYaml(badYamlWrongHealth);
        expect(res3.passed).toBe(false);
        expect(res3.reasons).toContain("healthCheckPath is not '/api/health'");
      },
      15000
    );

    // 4. Negative Test: Preflight Recursion Guard Check
    it(
      "4. recursion guard triggers and halts when PREFLIGHT_RUNNING=1",
      () => {
        let failedAsExpected = false;
        let errorOutput = "";

        try {
          execSync("pnpm tsx scripts/preflight.ts", {
            cwd: process.cwd(),
            env: { ...process.env, PREFLIGHT_RUNNING: "1" },
            stdio: "pipe",
            encoding: "utf8",
            timeout: 10000,
          });
        } catch (err: any) {
          failedAsExpected = true;
          errorOutput = (err.stdout || "") + (err.stderr || "");
        }

        expect(failedAsExpected).toBe(true);
        expect(errorOutput).toContain("PREFLIGHT_RUNNING=1 is already set");
        expect(errorOutput).toContain("Recursive preflight execution blocked");
      },
      15000
    );
  }
);
