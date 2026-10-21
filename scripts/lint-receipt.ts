#!/usr/bin/env tsx
import fs from "fs";
import path from "path";

export interface LintResult {
  valid: boolean;
  errors: string[];
}

export function lintReceipt(filePath: string): LintResult {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    return {
      valid: false,
      errors: [`Receipt file not found: ${resolved}`],
    };
  }

  const rawText = fs.readFileSync(resolved, "utf8");
  const errors: string[] = [];

  // 1. Check for token or authorization strings
  const forbiddenPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: "Bearer Token", pattern: /bearer\s+[a-zA-Z0-9_\-\.]{10,}/i },
    { name: "OAuth Access Token", pattern: /"access_token"\s*:\s*"[^"]+"/i },
    { name: "Refresh Token", pattern: /"refresh_token"\s*:\s*"[^"]+"/i },
    { name: "Client Secret", pattern: /"client_secret"\s*:\s*"[^"]+"/i },
    { name: "PayPal Token Prefix (A21AA)", pattern: /A21AA[a-zA-Z0-9_\-]{20,}/ },
    { name: "Google API Key (AIza)", pattern: /AIza[a-zA-Z0-9_\-]{30,}/ },
    { name: "Basic Auth Header", pattern: /basic\s+[a-zA-Z0-9+/=]{16,}/i },
    { name: "Authorization Header", pattern: /"authorization"\s*:\s*"[^"]+"/i },
  ];

  for (const { name, pattern } of forbiddenPatterns) {
    if (pattern.test(rawText)) {
      errors.push(`Forbidden secret or credential string detected: ${name}`);
    }
  }

  // 2. Check email domains
  const emailRegex = /([a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/g;
  const allowedDomainSuffixes = [
    "example.com",
    "proofpay.io",
    "sandbox.paypal.com",
  ];

  const emailMatches = Array.from(rawText.matchAll(emailRegex));
  for (const match of emailMatches) {
    const fullEmail = match[1];
    const domain = match[2].toLowerCase();
    const isAllowed = allowedDomainSuffixes.some(
      (allowed) => domain === allowed || domain.endsWith("." + allowed)
    );
    if (!isAllowed) {
      errors.push(
        `Non-sandbox email domain detected: "${fullEmail}" (domain "${domain}" is not in sandbox allowlist: ${allowedDomainSuffixes.join(", ")})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function main() {
  const target = process.argv[2] || "eval/results/single-real-run.json";
  console.log("================================================================================");
  console.log(`ProofPay Receipt Linting: ${target}`);
  console.log("================================================================================");

  const result = lintReceipt(target);
  if (result.valid) {
    console.log("✅ LINT PASSED: Zero forbidden tokens, credentials, or non-sandbox emails found.");
    console.log("================================================================================");
    process.exit(0);
  } else {
    console.error("❌ LINT FAILED: The following security/privacy violations were detected:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    console.log("================================================================================");
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith("lint-receipt.ts")) {
  main();
}

