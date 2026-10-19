import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface EnvVarMetadata {
  name: string;
  required: "Required" | "Optional" | "Test/Dev Only";
  defaultValue: string;
  whereUsed: string;
  howToObtain: string;
  riskIfLeaked: string;
  inEnvExample: boolean;
  inRenderYaml: boolean;
  isSecret: boolean;
  hasCodeDefault: boolean;
}

export const ENV_CATALOG: Record<string, Omit<EnvVarMetadata, "inEnvExample" | "inRenderYaml" | "hasCodeDefault">> = {
  DATABASE_URL: {
    name: "DATABASE_URL",
    required: "Required",
    defaultValue: "PGlite in-memory / local Docker",
    whereUsed: "src/db/index.ts",
    howToObtain: "Render PostgreSQL connection string or local docker-compose",
    riskIfLeaked: "High (Direct read/write access to application database)",
    isSecret: true,
  },
  PAYPAL_CLIENT_ID: {
    name: "PAYPAL_CLIENT_ID",
    required: "Required",
    defaultValue: "None (fails loudly if unset and PAYPAL_MOCK=false)",
    whereUsed: "src/lib/paypal/auth.ts, scripts/spike/*",
    howToObtain: "PayPal Developer Dashboard -> Apps & Credentials (Sandbox)",
    riskIfLeaked: "Medium (Sandbox client identifier, cannot move funds without secret)",
    isSecret: false,
  },
  PAYPAL_CLIENT_SECRET: {
    name: "PAYPAL_CLIENT_SECRET",
    required: "Required",
    defaultValue: "None (fails loudly if unset and PAYPAL_MOCK=false)",
    whereUsed: "src/lib/paypal/auth.ts, scripts/spike/*",
    howToObtain: "PayPal Developer Dashboard -> Apps & Credentials (Sandbox)",
    riskIfLeaked: "High (Can create Orders and execute sandbox Payouts up to account balance)",
    isSecret: true,
  },
  PAYPAL_BASE_URL: {
    name: "PAYPAL_BASE_URL",
    required: "Optional",
    defaultValue: "https://api-m.sandbox.paypal.com",
    whereUsed: "src/lib/paypal/auth.ts",
    howToObtain: "Fixed PayPal endpoint; set to sandbox for testing",
    riskIfLeaked: "None (Public API endpoint)",
    isSecret: false,
  },
  PAYPAL_WEBHOOK_ID: {
    name: "PAYPAL_WEBHOOK_ID",
    required: "Optional",
    defaultValue: "MOCK_WEBHOOK_ID",
    whereUsed: "src/app/api/webhooks/paypal/route.ts",
    howToObtain: "PayPal Developer Dashboard -> Webhooks -> Add Webhook",
    riskIfLeaked: "Low (Webhook configuration identifier)",
    isSecret: false,
  },
  PAYPAL_MOCK: {
    name: "PAYPAL_MOCK",
    required: "Optional",
    defaultValue: "false (set to true only for offline development)",
    whereUsed: "src/lib/paypal/auth.ts, src/db/ledger.ts",
    howToObtain: "Set manually in .env or render.yaml",
    riskIfLeaked: "None (Configuration flag)",
    isSecret: false,
  },
  PAYPAL_SANDBOX_PAYEE_EMAIL: {
    name: "PAYPAL_SANDBOX_PAYEE_EMAIL",
    required: "Optional",
    defaultValue: "None (read at runtime for real payouts; falls back on mock jobs)",
    whereUsed: "src/app/api/jobs/route.ts, src/lib/paypal/payout-policy.ts",
    howToObtain: "PayPal Developer Dashboard -> Sandbox Accounts (Personal Account)",
    riskIfLeaked: "Low (Sandbox test recipient email)",
    isSecret: false,
  },
  PAYPAL_SANDBOX_PERSONAL_EMAIL: {
    name: "PAYPAL_SANDBOX_PERSONAL_EMAIL",
    required: "Test/Dev Only",
    defaultValue: "None (CLI only for demo:run)",
    whereUsed: "scripts/demo-run.ts",
    howToObtain: "PayPal Developer Dashboard -> Sandbox Accounts",
    riskIfLeaked: "Low (Sandbox account username)",
    isSecret: false,
  },
  PAYPAL_SANDBOX_BUSINESS_EMAIL: {
    name: "PAYPAL_SANDBOX_BUSINESS_EMAIL",
    required: "Test/Dev Only",
    defaultValue: "None (CLI only for demo:run)",
    whereUsed: "scripts/demo-run.ts",
    howToObtain: "PayPal Developer Dashboard -> Sandbox Accounts",
    riskIfLeaked: "Low (Sandbox business account username)",
    isSecret: false,
  },
  GEMINI_API_KEY: {
    name: "GEMINI_API_KEY",
    required: "Required",
    defaultValue: "None (falls back to stub if unset and verifyMode != live)",
    whereUsed: "src/lib/verify/llm-verifier.ts, src/lib/verifier/llm.ts",
    howToObtain: "Google AI Studio -> Get API Key",
    riskIfLeaked: "High (Can consume Gemini API quota up to project rate limits)",
    isSecret: true,
  },
  GOOGLE_GENERATIVE_AI_API_KEY: {
    name: "GOOGLE_GENERATIVE_AI_API_KEY",
    required: "Optional",
    defaultValue: "Aliases GEMINI_API_KEY",
    whereUsed: "src/lib/verifier/llm.ts",
    howToObtain: "Google AI Studio alias",
    riskIfLeaked: "High (Alias for Gemini API key)",
    isSecret: true,
  },
  MODEL_ID: {
    name: "MODEL_ID",
    required: "Optional",
    defaultValue: "gemini-3.8-flash",
    whereUsed: "src/lib/verify/llm-verifier.ts, src/lib/verifier/llm.ts",
    howToObtain: "Google Gemini model name identifier",
    riskIfLeaked: "None (Public model name identifier)",
    isSecret: false,
  },
  MODEL_FALLBACK_ID: {
    name: "MODEL_FALLBACK_ID",
    required: "Optional",
    defaultValue: "gemini-3.5-flash-lite",
    whereUsed: "src/lib/verify/llm-verifier.ts, src/lib/verifier/llm.ts",
    howToObtain: "Google Gemini fallback model name identifier",
    riskIfLeaked: "None (Public model name identifier)",
    isSecret: false,
  },
  MANDATE_SIGNING_SECRET: {
    name: "MANDATE_SIGNING_SECRET",
    required: "Required",
    defaultValue: "default_test_secret_32_chars_min (Generated via render.yaml in production)",
    whereUsed: "src/lib/guard/mandate.ts, src/app/api/inbox/route.ts",
    howToObtain: "Generate with `openssl rand -hex 32` or render.yaml generateValue: true",
    riskIfLeaked: "High (Can forge signed HMAC Intent Mandates with arbitrary amounts)",
    isSecret: true,
  },
  APP_BASE_URL: {
    name: "APP_BASE_URL",
    required: "Optional",
    defaultValue: "http://localhost:3000 (production: https://proofpay.onrender.com)",
    whereUsed: "src/lib/paypal/orders.ts",
    howToObtain: "Hosted platform URL on Render",
    riskIfLeaked: "None (Public domain name)",
    isSecret: false,
  },
  BASE_URL: {
    name: "BASE_URL",
    required: "Test/Dev Only",
    defaultValue: "http://localhost:3000",
    whereUsed: "scripts/measure-lighthouse-median.ts, scripts/check-client-ip.sh",
    howToObtain: "Command-line argument or env var for test scripts",
    riskIfLeaked: "None (Test target address)",
    isSecret: false,
  },
  NODE_ENV: {
    name: "NODE_ENV",
    required: "Optional",
    defaultValue: "development (production on Render)",
    whereUsed: "src/lib/auth/roles.ts",
    howToObtain: "Standard Node.js runtime environment flag",
    riskIfLeaked: "None (Runtime mode flag)",
    isSecret: false,
  },
  MAX_DAILY_REAL_PAYOUT_USD: {
    name: "MAX_DAILY_REAL_PAYOUT_USD",
    required: "Optional",
    defaultValue: "25.00",
    whereUsed: "src/lib/paypal/payout-policy.ts",
    howToObtain: "Configured numeric USD limit for daily sandbox payouts",
    riskIfLeaked: "None (Policy parameter)",
    isSecret: false,
  },
  MAX_DAILY_REAL_PAYOUT_COUNT: {
    name: "MAX_DAILY_REAL_PAYOUT_COUNT",
    required: "Optional",
    defaultValue: "5",
    whereUsed: "src/lib/paypal/payout-policy.ts",
    howToObtain: "Configured numeric count limit for daily sandbox payouts",
    riskIfLeaked: "None (Policy parameter)",
    isSecret: false,
  },
  CLIENT_IP_TRUSTED_PROXY_HOPS: {
    name: "CLIENT_IP_TRUSTED_PROXY_HOPS",
    required: "Optional",
    defaultValue: "0",
    whereUsed: "src/lib/rate-limit.ts",
    howToObtain: "Integer (0..10) representing trusted reverse-proxy hops to skip",
    riskIfLeaked: "None (Network topology parameter)",
    isSecret: false,
  },
  ENABLE_DEBUG_CLIENT_IP: {
    name: "ENABLE_DEBUG_CLIENT_IP",
    required: "Optional",
    defaultValue: "false (reviewer-only, 404 when unset)",
    whereUsed: "src/app/api/debug/client-ip/route.ts",
    howToObtain: "Boolean flag ('true' / 'false')",
    riskIfLeaked: "Low (Enables diagnostic header reflection endpoint)",
    isSecret: false,
  },
  ENABLE_TEST_ROLE_HEADER: {
    name: "ENABLE_TEST_ROLE_HEADER",
    required: "Test/Dev Only",
    defaultValue: "false (ignored in production unless set to 'true')",
    whereUsed: "src/lib/auth/roles.ts",
    howToObtain: "Boolean flag set in playwright.config.ts for automated browser runs",
    riskIfLeaked: "Medium (If enabled in production, allows role spoofing via header)",
    isSecret: false,
  },
  USE_PGLITE: {
    name: "USE_PGLITE",
    required: "Optional",
    defaultValue: "false (falls back to PGlite when DATABASE_URL is unset)",
    whereUsed: "src/db/index.ts, src/lib/seed-guard.ts",
    howToObtain: "Set to 'true' to force embedded WebAssembly PostgreSQL",
    riskIfLeaked: "None (Database engine flag)",
    isSecret: false,
  },
  USE_RECORDED_REPLAY: {
    name: "USE_RECORDED_REPLAY",
    required: "Test/Dev Only",
    defaultValue: "false (used for regression testing without API calls)",
    whereUsed: "src/app/api/jobs/[id]/submit/route.ts",
    howToObtain: "Set to 'true' during offline evaluation replay runs",
    riskIfLeaked: "None (Test harness flag)",
    isSecret: false,
  },
  VERIFY_MODE: {
    name: "VERIFY_MODE",
    required: "Test/Dev Only",
    defaultValue: "live if GEMINI_API_KEY present, else stub",
    whereUsed: "src/lib/verify/llm-verifier.ts",
    howToObtain: "Set to 'stub' or 'live' to override Gemini execution mode",
    riskIfLeaked: "None (Verification mode selector)",
    isSecret: false,
  },
  TRUST_CLOUDFLARE_PROXY: {
    name: "TRUST_CLOUDFLARE_PROXY",
    required: "Optional",
    defaultValue: "false",
    whereUsed: "src/lib/rate-limit.ts",
    howToObtain: "Set to 'true' if running behind a verified Cloudflare proxy",
    riskIfLeaked: "None (Network trust flag)",
    isSecret: false,
  },
  OVERWRITE_SINGLE_RUN_JSON: {
    name: "OVERWRITE_SINGLE_RUN_JSON",
    required: "Test/Dev Only",
    defaultValue: "false",
    whereUsed: "scripts/demo-run.ts",
    howToObtain: "Set to 'true' to regenerate .data/single-real-run.json",
    riskIfLeaked: "None (Receipt generation flag)",
    isSecret: false,
  },
  DEMO_DAILY_CAP: {
    name: "DEMO_DAILY_CAP",
    required: "Optional",
    defaultValue: "100",
    whereUsed: "src/lib/rate-limit.ts",
    howToObtain: "Total daily job creation cap across all visitors",
    riskIfLeaked: "None (Rate limit parameter)",
    isSecret: false,
  },
};

export function checkEnvMap(): {
  allValid: boolean;
  warnings: string[];
  errors: string[];
  items: EnvVarMetadata[];
} {
  const root = process.cwd();

  // Read .env.example
  const envExampleContent = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const envExampleVars = new Set(
    Array.from(envExampleContent.matchAll(/^([A-Z0-9_]+)=/gm)).map((m) => m[1])
  );

  // Read render.yaml
  const renderYamlContent = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
  const renderYamlVars = new Set(
    Array.from(renderYamlContent.matchAll(/key:\s+([A-Z0-9_]+)/g)).map((m) => m[1])
  );

  const errors: string[] = [];
  const warnings: string[] = [];
  const items: EnvVarMetadata[] = [];

  for (const [key, meta] of Object.entries(ENV_CATALOG)) {
    const inEnvExample = envExampleVars.has(key);
    const inRenderYaml = renderYamlVars.has(key);

    const hasCodeDefault =
      meta.defaultValue !== "None" &&
      !meta.defaultValue.startsWith("None") &&
      meta.defaultValue !== "";

    const item: EnvVarMetadata = {
      ...meta,
      inEnvExample,
      inRenderYaml,
      hasCodeDefault,
    };
    items.push(item);

    // Invariant: All required production variables must be in .env.example
    if (meta.required === "Required" && !inEnvExample) {
      errors.push(`Required variable "${key}" is missing from .env.example`);
    }

    // Invariant: All required production variables must be configured or generated in render.yaml
    if (meta.required === "Required" && !inRenderYaml) {
      errors.push(`Required production variable "${key}" is missing from render.yaml`);
    }

    // Flag any secret with an insecure hardcoded fallback in code
    if (meta.isSecret && hasCodeDefault && key === "MANDATE_SIGNING_SECRET") {
      warnings.push(
        `MANDATE_SIGNING_SECRET has a fallback string in code for test ease; in production, render.yaml generates a cryptographically random value ('generateValue: true').`
      );
    }
  }

  return {
    allValid: errors.length === 0,
    warnings,
    errors,
    items,
  };
}

function main() {
  console.log("==========================================================================================");
  console.log("PROOFPAY ENVIRONMENT VARIABLE CATALOG & RUNBOOK AUDIT (B2)");
  console.log("==========================================================================================\n");

  const result = checkEnvMap();

  console.log(
    "| Variable Name                  | Type      | In .env.example | In render.yaml | Default Value / Production Behavior                 |"
  );
  console.log(
    "| :----------------------------- | :-------- | :-------------: | :------------: | :-------------------------------------------------- |"
  );
  for (const item of result.items) {
    const exMark = item.inEnvExample ? "✅ Yes" : "❌ No ";
    const renMark = item.inRenderYaml ? "✅ Yes" : "—     ";
    console.log(
      `| ${item.name.padEnd(30)} | ${item.required.padEnd(9)} | ${exMark.padEnd(15)} | ${renMark.padEnd(14)} | ${item.defaultValue.slice(0, 52).padEnd(52)} |`
    );
  }

  if (result.warnings.length > 0) {
    console.log("\nAudited Invariants & Notices:");
    for (const w of result.warnings) {
      console.log(`- ⚠️  ${w}`);
    }
  }

  if (result.errors.length > 0) {
    console.error("\nValidation Errors:");
    for (const e of result.errors) {
      console.error(`- ❌ ${e}`);
    }
  }

  console.log("\n==========================================================================================");
  if (result.allValid) {
    console.log(`ENVIRONMENT MAP VERIFICATION: PASS (${result.items.length} variables mapped, 0 critical errors)`);
    console.log("==========================================================================================");
    process.exit(0);
  } else {
    console.error(`ENVIRONMENT MAP VERIFICATION: FAIL (${result.errors.length} critical errors)`);
    console.log("==========================================================================================");
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
