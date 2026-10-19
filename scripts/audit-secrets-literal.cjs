const fs = require("fs");
const { execSync } = require("child_process");

const envContent = fs.readFileSync(".env", "utf8");
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
];

const envMap = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  envMap[key] = val;
}

const secrets = [];
for (const key of candidateKeys) {
  const val = envMap[key] || process.env[key] || "";
  if (val && val.length >= 4) {
    secrets.push({ key, val });
  } else {
    // Variable is empty/unset in env
    secrets.push({ key, val: "", isUnset: true });
  }
}

console.log(`Loaded ${secrets.length} secret/config variables to check\n`);

const results = [];

for (const { key, val, isUnset } of secrets) {
  if (isUnset || !val) {
    results.push({
      variable: key,
      length: 0,
      status: "UNSET / EMPTY",
      gitHistoryCommits: 0,
      nextMatches: 0,
      docsMatches: 0,
      srcMatches: 0,
    });
    console.log(`Variable: ${key.padEnd(32)} | [UNSET / EMPTY in .env]`);
    continue;
  }

  // 1. Search in git history across all branches using git log -p --all -S
  let gitHistoryCommits = 0;
  try {
    const gitLogOut = execSync(`git log -p --all -S "${val.replace(/"/g, '\\"')}" --oneline`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const commits = gitLogOut.trim().split("\n").filter(Boolean);
    gitHistoryCommits = commits.length;
  } catch (e) {
    gitHistoryCommits = 0;
  }

  // 2. Search in .next directory using grep -rF
  let nextMatches = 0;
  if (fs.existsSync(".next")) {
    try {
      const grepNext = execSync(`grep -rF "${val.replace(/"/g, '\\"')}" .next/ | wc -l`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      nextMatches = parseInt(grepNext.trim(), 10) || 0;
    } catch (e) {
      nextMatches = 0;
    }
  }

  // 3. Search in docs directory using grep -rF
  let docsMatches = 0;
  if (fs.existsSync("docs")) {
    try {
      const grepDocs = execSync(`grep -rF "${val.replace(/"/g, '\\"')}" docs/ | wc -l`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      docsMatches = parseInt(grepDocs.trim(), 10) || 0;
    } catch (e) {
      docsMatches = 0;
    }
  }

  // 4. Search in sources (src) directory using grep -rF
  let srcMatches = 0;
  if (fs.existsSync("src")) {
    try {
      const grepSrc = execSync(`grep -rF "${val.replace(/"/g, '\\"')}" src/ | wc -l`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      srcMatches = parseInt(grepSrc.trim(), 10) || 0;
    } catch (e) {
      srcMatches = 0;
    }
  }

  results.push({
    variable: key,
    length: val.length,
    gitHistoryCommits,
    nextMatches,
    docsMatches,
    srcMatches,
  });

  console.log(
    `Variable: ${key.padEnd(32)} | Git History Commits: ${gitHistoryCommits} | .next matches: ${nextMatches} | docs matches: ${docsMatches} | src matches: ${srcMatches}`
  );
}

fs.writeFileSync("docs/secrets_audit_report.json", JSON.stringify(results, null, 2));
console.log("\nSaved secrets audit report to docs/secrets_audit_report.json");
