import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("Gitleaks Canary Detection Test (tests/gitleaks-canary.test.ts)", () => {
  const root = process.cwd();
  const canaryFile = path.join(root, "scripts/canary-leak-test.ts");

  it("triggers scripts-password-or-secret-assignment rule on fake password assignment and cleans up", () => {
    // 1. Write temporary canary file in scripts/
    fs.writeFileSync(
      canaryFile,
      '// Automated canary test\nconst leaked_password = "canary_super_secret_value_12345";\n',
      "utf8"
    );

    let failedAsExpected = false;
    let failureOutput = "";

    try {
      // 2. Run gitleaks detect on scripts directory
      execSync(
        "gitleaks detect --no-git --source scripts/ --config .gitleaks.toml --verbose",
        {
          cwd: root,
          stdio: "pipe",
          encoding: "utf8",
        }
      );
    } catch (err: any) {
      failedAsExpected = true;
      failureOutput = (err.stdout || "") + (err.stderr || "");
    } finally {
      // 3. Guaranteed cleanup of the temporary canary file
      if (fs.existsSync(canaryFile)) {
        fs.unlinkSync(canaryFile);
      }
    }

    // 4. Assert that gitleaks caught the fake password assignment with exit code 1
    expect(failedAsExpected).toBe(true);
    expect(failureOutput).toContain("scripts-password-or-secret-assignment");
    expect(failureOutput).toContain("canary-leak-test.ts");
    expect(fs.existsSync(canaryFile)).toBe(false);
  });
});

