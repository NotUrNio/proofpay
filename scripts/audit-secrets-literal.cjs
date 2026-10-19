const fs = require("fs");
const { execFileSync } = require("child_process");

const envContent = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const candidateKeys = [
  "DATABASE_URL",
  "PAYPAL_WEBHOOK_ID",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "MANDATE_SIGNING_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "AG_STUDIO_LICENSE_KEY",
  "PAYPAL_SANDBOX_BUSINESS_EMAIL",
  "PAYPAL_SANDBOX_PERSONAL_EMAIL",
  "OLD_SANDBOX_PASSWORD",
];

let oldPass = "";
try {
  const content = execFileSync("git", ["show", "6ac5a18:scripts/demo-run.ts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const m = content.match(/Password:\s+([^\s]+)/);
  if (m) oldPass = m[1];
} catch (e) {}

const UNSET_REASONS = {
  DATABASE_URL:
    "Unset in local .env because local development and tests use embedded PGlite (.data/pglite); hosted Postgres connection string only exists in Render's managed environment.",
  PAYPAL_WEBHOOK_ID:
    "Not defined in local .env; webhook verification ID is only provisioned during live tunnel/hosted webhook registration.",
  GOOGLE_GENERATIVE_AI_API_KEY:
    "Not defined in local .env; this repo uses GEMINI_API_KEY instead.",
  AG_STUDIO_LICENSE_KEY:
    "Empty in local .env (length 0); AG Studio was replaced with MIT-licensed Recharts.",
  OLD_SANDBOX_PASSWORD:
    "Historical password rotated and removed in 6ac5a18.",
};

const envMap = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  envMap[key] = val;
}
if (oldPass) {
  envMap["OLD_SANDBOX_PASSWORD"] = oldPass;
}

function countFixedStringInDir(val, dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const out = execFileSync("grep", ["-rF", val, dirPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

// Retrieve untracked files
let untrackedFiles = [];
try {
  untrackedFiles = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .trim()
    .split("\n")
    .filter(Boolean);
} catch {}

const checkedVariables = [];
const uncheckedVariables = [];
let hasLeakViolation = false;

for (const key of candidateKeys) {
  const val = envMap[key] || process.env[key] || "";
  if (!val || val.length < 4) {
    const entry = {
      variable: key,
      length: val ? val.length : 0,
      status: "UNCHECKED_UNSET_IN_ENV",
      reason:
        UNSET_REASONS[key] ||
        "Variable is unset or empty in local .env, so no literal value exists in memory to grep for.",
      gitHistoryCommits: null,
      nextMatches: null,
      docsMatches: null,
      srcMatches: null,
      scriptsMatches: null,
      untrackedMatches: null,
    };
    uncheckedVariables.push(entry);
    console.log(
      `Variable: ${key.padEnd(32)} | STATUS: UNCHECKED (unset/empty in .env)`
    );
    continue;
  }

  let gitHistoryCommits = 0;
  try {
    const out = execFileSync("git", ["log", "--all", "-S", val, "--format=%H"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    gitHistoryCommits = out.trim().split("\n").filter(Boolean).length;
  } catch {
    gitHistoryCommits = 0;
  }

  const nextMatches = countFixedStringInDir(val, ".next");
  const docsMatches = countFixedStringInDir(val, "docs");
  const srcMatches = countFixedStringInDir(val, "src");
  const scriptsMatches = countFixedStringInDir(val, "scripts");

  // Check untracked files
  let untrackedMatches = 0;
  for (const uFile of untrackedFiles) {
    if (fs.existsSync(uFile) && fs.statSync(uFile).isFile()) {
      try {
        const uText = fs.readFileSync(uFile, "utf8");
        if (uText.includes(val)) {
          untrackedMatches++;
        }
      } catch {}
    }
  }

  if (nextMatches > 0 || docsMatches > 0 || srcMatches > 0 || scriptsMatches > 0 || untrackedMatches > 0) {
    hasLeakViolation = true;
  }

  const entry = {
    variable: key,
    length: val.length,
    status: "CHECKED",
    gitHistoryCommits,
    nextMatches,
    docsMatches,
    srcMatches,
    scriptsMatches,
    untrackedMatches,
  };
  checkedVariables.push(entry);

  console.log(
    `Variable: ${key.padEnd(32)} | len=${String(val.length).padEnd(3)} | Git History Commits (-S): ${gitHistoryCommits} | .next: ${nextMatches} | docs: ${docsMatches} | src: ${srcMatches} | scripts: ${scriptsMatches} | untracked: ${untrackedMatches}`
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  checkedCount: checkedVariables.length,
  uncheckedCount: uncheckedVariables.length,
  checkedVariables,
  uncheckedVariables,
};

fs.writeFileSync("docs/secrets_audit_report.json", JSON.stringify(report, null, 2));
console.log("\nSaved secrets audit report to docs/secrets_audit_report.json");

if (hasLeakViolation) {
  console.error("\nFATAL ERROR: Secret value leak detected in .next, docs, src, scripts, or untracked files!");
  process.exit(1);
}
