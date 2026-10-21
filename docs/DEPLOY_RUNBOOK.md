# ProofPay Deployment & Operations Runbook

> **Target Platform**: Render Cloud (Web Service + Managed PostgreSQL)  
> **Blueprint**: [`render.yaml`](../render.yaml)  
> **Target Production URL**: `https://proofpay-68qi.onrender.com`  
> **Production Branch**: `main` (Render Web Service tracks `main`)

---

## 📋 Table of Contents
1. [Pre-Deployment Verification (`pnpm preflight`)](#1-pre-deployment-verification)
2. [Pre-Flight Compliance & Secret Rotation Checklist](#2-pre-flight-compliance--secret-rotation-checklist)
3. [Branch Merge & Deployment via Render Dashboard](#3-branch-merge--deployment-via-render-dashboard)
4. [Post-Deploy Smoke Test (`hosted-smoke.ts`)](#4-post-deploy-smoke-test)
5. [Client IP & Proxy Trust Inspection (Laptop vs. Phone)](#5-client-ip--proxy-trust-inspection-laptop-vs-phone)
6. [Hosted Performance & Lighthouse Audit](#6-hosted-performance--lighthouse-audit)
7. [Live Sandbox `demo:run` & PayPal ID Reconciliation](#7-live-sandbox-demorun--paypal-id-reconciliation)
8. [Live `/eval` Page Verification](#8-live-eval-page-verification)
9. [Demo State Restoration (`POST /api/demo/reset`)](#9-demo-state-restoration)
1. [Step 0: Hackathon Submission Rules & Freeze Gate](#0-step-0-hackathon-submission-rules--freeze-gate)
2. [Pre-Deployment Verification (`pnpm preflight`)](#1-pre-deployment-verification)
3. [Pre-Flight Compliance & Secret Rotation Checklist](#2-pre-flight-compliance--secret-rotation-checklist)
4. [Branch Merge & Deployment via Render Dashboard](#3-branch-merge--deployment-via-render-dashboard)
5. [Post-Deploy Smoke Test (`hosted-smoke.ts`)](#4-post-deploy-smoke-test)
6. [Client IP & Proxy Trust Inspection (Laptop vs. Phone)](#5-client-ip--proxy-trust-inspection-laptop-vs-phone)
7. [Hosted Performance & Lighthouse Audit](#6-hosted-performance--lighthouse-audit)
8. [Live Sandbox `demo:run` & PayPal ID Reconciliation](#7-live-sandbox-demorun--paypal-id-reconciliation)
9. [Live `/eval` Page Verification](#8-live-eval-page-verification)
10. [Demo State Restoration (`POST /api/demo/reset`)](#9-demo-state-restoration)
11. [Rollback & Disaster Recovery](#10-rollback--disaster-recovery)
12. [Managed PostgreSQL 30-Day Free Tier Notice](#11-managed-postgresql-30-day-free-tier-notice)

---

## 0. Step 0: Hackathon Submission Rules & Freeze Gate

> [!CAUTION]
> **MANDATORY GATE**: Check the hackathon's rules on edits after the submission deadline. If changes are frozen, stop; `v1.0.0-submission` stays live.  
> Only proceed with deploying `main` if the hackathon rules explicitly allow post-deadline repository maintenance or if the evaluation window has closed.

---

## 1. Pre-Deployment Verification

Before merging to `main` or triggering deployment, execute the 11-step automated preflight suite locally:

```bash
pnpm preflight
```

The preflight runner executes:
1. TypeScript compilation (`pnpm tsc --noEmit`)
2. Next.js ESLint (`pnpm lint`)
3. Vitest unit & integration test suites
4. Next.js production build (`pnpm build`)
5. Gitleaks full-history static secrets scanner (`gitleaks detect` with canary check)
6. Literal secrets & commits audit
7. Git-tracked cited files check
8. Relative markdown link resolution check across all documentation
9. Environment variable catalog & `render.yaml` map check
10. Documentation claims vs. code invariants verification (`scripts/check-claims.ts`)
11. Render deployment specification verification (`healthCheckPath: /api/health`, `autoDeploy: false`, no remote seeding)

> [!IMPORTANT]
> **GO / NO-GO Gate**: Do NOT proceed with merging or deployment if `pnpm preflight` reports any `NO-GO` step.

---

## 2. Pre-Flight Compliance & Secret Rotation Checklist

Before triggering production deployment, perform these operator-only checks:

1. **Rotate Sandbox Password & Confirm Old Password Fails**:
   - In [PayPal Developer Dashboard](https://developer.paypal.com/dashboard) $\to$ **Sandbox Accounts**, select your Sandbox Personal Buyer account.
   - Click **Manage Account** $\to$ change the account password.
   - Test authentication with the **old** password (e.g. via PayPal sandbox login or curl) and confirm it fails with an authentication error.
2. **Hackathon Rules Compliance Check**:
   - Verify project complies with PayPal AI Hackathon submission criteria.
   - Verify MIT License is present in `LICENSE`.
   - Verify no proprietary API keys or confidential credentials are committed in repository history.
3. **Repository Visibility Check**:
   - In GitHub repository settings $\to$ **General** $\to$ **Danger Zone** $\to$ verify **Repository visibility** is set to **Public** (or shared with hackathon judges).
4. **Devpost Text & Disclosure Check**:
   - Review Devpost submission text against `DEVPOST.md`.
   - Confirm accurate model attribution (`gemini-3.8-flash` primary vision, `gemini-3.5-flash-lite` quota fallback).
   - Confirm sample size attribution (28 cases: 13 Dev / 15 Held-Out, 0/22 false approvals, $0.00035 / run).
   - Confirm prominent disclosure of simulated guided demo runs vs. real PayPal sandbox receipts.

---

## 3. Branch Merge & Deployment via Render Dashboard

Render's Web Service tracks the `main` branch. Clicking **"Deploy latest commit"** on Render deploys the latest commit of the service's linked branch (`main`). Therefore, you must merge `ui-redesign` into `main` before deploying.

### Step 1: Merge `ui-redesign` into `main` (No Fast-Forward)
```bash
# Ensure working tree is clean
git checkout main
git pull origin main
git merge --no-ff ui-redesign -m "Merge branch 'ui-redesign' into main"
git push origin main
```

### Step 2: Set Manually Configured Variables in Render Dashboard
In the [Render Dashboard](https://dashboard.render.com) $\to$ `proofpay` Web Service $\to$ **Environment**:

| Variable Name | Status | Production Value / Instruction |
| :--- | :---: | :--- |
| `PAYPAL_CLIENT_ID` | Required | PayPal Developer Sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | Required | PayPal Developer Sandbox app client secret |
| `PAYPAL_WEBHOOK_ID` | Required | PayPal Sandbox webhook listener ID |
| `GEMINI_API_KEY` | Required | Google AI Studio API key (`AIza...`) |
| `PAYPAL_SANDBOX_PAYEE_EMAIL` | Required | Dedicated recipient Sandbox PayPal email |
| `CLIENT_IP_TRUSTED_PROXY_HOPS` | Config | `0` (or `1` if behind Render reverse proxy) |
| `ENABLE_DEBUG_CLIENT_IP` | Temporary | Set `"true"` for post-deploy check, then set `"false"` |
| `ENABLE_DEMO_RESET` | Temporary | Set `"true"` for hosted Lighthouse, then set `"false"` |

> [!NOTE]
> `DATABASE_URL` is automatically linked from `proofpay-db`. `MANDATE_SIGNING_SECRET` is automatically generated by Render.

### Step 3: Verify Auto-Deploy Setting in Render Dashboard
1. In the `proofpay` Web Service, click **Settings** $\to$ scroll down to **Build & Deploy**.
2. Locate the **Auto-Deploy** setting: verify that it is explicitly toggled to **"No"**.
   *(Note: For dashboard-created web services, the Dashboard UI setting overrides `render.yaml`. Confirming "No" ensures no accidental deploys occur on push).*

### Step 4: Trigger Manual Deploy
1. In the `proofpay` Web Service, click **Manual Deploy** $\to$ **Deploy latest commit**.
2. Render builds the service using `pnpm install && pnpm build` and starts with `pnpm start`.
3. Verify Render logs show: `[Bootstrap] Seeding 3 bundled demo jobs for judging...` and `[Bootstrap] Complete`.

---

## 4. Post-Deploy Smoke Test

Once Render reports **Deploy live**, run the automated post-deployment smoke test:

```bash
pnpm tsx scripts/hosted-smoke.ts https://proofpay-68qi.onrender.com
```

> [!CAUTION]
> **CRITICAL RESTRICTION**: `hosted-smoke.ts` **must NOT use `--run-demo` against the hosted URL**.  
> `--run-demo` attempts to submit deliverables and mutate escrow state. Running it against the hosted environment will pollute the judging demo milestone states. Always run `hosted-smoke.ts` without `--run-demo` against the live URL.

### What `hosted-smoke.ts` Verifies (10/10 PASS):
- Cold start retry handling (up to 90s for free-tier spin-up)
- Read-only routes return HTTP 200 (`/`, `/studio`, `/ledger`, `/policy`, `/chaos`, `/inbox`, `/api/jobs`)
- Unauthenticated mutation routes return HTTP 403
- Role header bypass attempt (`x-proofpay-role`) is ignored in production
- Zero sensitive credentials leaked in API responses
- Canonical bundled demo jobs are verified present

---

## 5. Client IP & Proxy Trust Inspection (Laptop vs. Phone)

Verify client IP resolution using the diagnostic endpoint:

1. In Render Dashboard $\to$ Environment, temporarily set:
   ```text
   ENABLE_DEBUG_CLIENT_IP="true"
   ```
2. Run diagnostic script against hosted URL:
   ```bash
   ./scripts/check-client-ip.sh https://proofpay-68qi.onrender.com
   ```
3. **Laptop vs. Phone Verification**:
   - Access `https://proofpay-68qi.onrender.com/api/debug/client-ip` from your **laptop** (Wi-Fi). Note the `derivedIp`.
   - Access `https://proofpay-68qi.onrender.com/api/debug/client-ip` from your **mobile phone** (Cellular data). Note the `derivedIp`.
   - **Verification Requirement**: Confirm that the two requests yield **two distinct public IP addresses**. This confirms that the rate limiter does not collapse all visitors into a single reverse-proxy IP bucket.
   - If Render's internal proxy IP appears as `derivedIp`, set `CLIENT_IP_TRUSTED_PROXY_HOPS=1` in the dashboard and re-verify.
4. **Restore 404 Security**:
   - In Render Dashboard, remove or set `ENABLE_DEBUG_CLIENT_IP="false"`.
   - Confirm `curl -s -o /dev/null -w "%{http_code}" https://proofpay-68qi.onrender.com/api/debug/client-ip` returns **404**.

---

## 6. Hosted Performance & Lighthouse Audit

1. In Render Dashboard $\to$ Environment, temporarily set:
   ```text
   ENABLE_DEMO_RESET="true"
   ```
   *(Required because the Lighthouse test runner resets demo state to pristine before measuring jobs in funded/paid/needs-human states).*
2. Execute the 5-run median Lighthouse runner against hosted production:
   ```bash
   BASE_URL=https://proofpay-68qi.onrender.com pnpm tsx scripts/measure-lighthouse-median.ts
   ```
3. Verify that 5-run median scores across `/`, `/studio`, and `/jobs/:id` meet targets (Performance $\ge 85$, Accessibility $\ge 95$, Best Practices $\ge 90$, SEO = 100, CLS < 0.10).
4. In Render Dashboard, remove or set `ENABLE_DEMO_RESET="false"` to restore 404 security on the reset route.

---

## 7. Live Sandbox `demo:run` & PayPal ID Reconciliation

After credentials are confirmed and rotated, execute a live real-world payment run:

```bash
pnpm demo:run
```

### Reconciliation Steps:
1. When prompted in the console, open the PayPal Sandbox Approval URL.
2. Log into your Sandbox Buyer account and approve the $5.00 escrow funding.
3. Observe terminal output:
   - Order captured (`Capture ID: 4GP...`)
   - AI verifier executed (`Decision: AUTO_PAY`)
   - Instant PayPal Payout released (`Payout Batch ID: CPM...`, `Payout Item ID: A7P...`)
   - Audit ledger verified (`Ledger Chain Status: VALID`)
4. Open the [PayPal Developer Sandbox Dashboard](https://developer.paypal.com/dashboard) $\to$ **Activity**:
   - Confirm the Capture transaction ID matches the console output.
   - Confirm the Payout Batch transaction ID matches the console output.
5. Visit `https://proofpay-68qi.onrender.com/ledger`:
   - Confirm the newly generated payment IDs appear in the append-only ledger audit trail.

---

## 8. Live `/eval` Page Verification

Open `https://proofpay-68qi.onrender.com/eval` in your browser:

1. **Headline Copy**: Verify the prominent text displays:
   > *"Results replayed from recorded model responses (offline); 28 author-written cases; interval shows uncertainty."*
2. **Serving Model Breakdown Card**:
   - Primary Vision (`gemini-3.8-flash`): **14 cases**
   - Quota Fallback (`gemini-3.5-flash-lite`): **8 cases**
   - Deterministic Pre-Model Checks: **6 cases**
3. **Fixture Registry**:
   - Verify all 28 rows display green `PASS` badges with accurate actual observed outcomes.
   - Confirm 0 occurrences of false `FAIL` or blank outcomes.

---

## 9. Demo State Restoration

When evaluators test the Human Review queue (`/inbox`) and approve the near-miss milestone (`10c2bab9-...`), its state changes to `PAID` in the hosted database.

To restore demo jobs back to their pristine judging states without deleting any append-only ledger rows:

```bash
# Set ENABLE_DEMO_RESET=true in Render Dashboard, then run:
curl -X POST https://proofpay-68qi.onrender.com/api/demo/reset \
  -H "Cookie: proofpay_role=reviewer"
```

This resets:
- Job `10c2bab9-...` $\to$ `VERIFIED` (pending review in `/inbox`)
- Job `20f829e2-...` $\to$ `FUNDED` (awaiting deliverable)
- Job `bf3884d6-...` $\to$ `PAID` (completed autonomous payout)
- Appends an immutable `DEMO_STATE_RESET` ledger event while preserving all audit rows.

> [!IMPORTANT]
> **MANDATORY SECURITY REMINDER**: Always set `ENABLE_DEMO_RESET="false"` and `ENABLE_DEBUG_CLIENT_IP="false"` (or remove them) in the Render Dashboard after use to restore HTTP 404 security on both endpoints.

---

## 10. Rollback & Disaster Recovery

If an issue occurs in production:

### Recommended Rollback Path:
1. In the **Render Dashboard** $\to$ **Events** tab.
2. Locate the previous successful deployment.
3. Click the three dots $\dots$ $\to$ **Rollback to this deploy**.
4. Render immediately switches live traffic back to the prior container image without rebuilding.

### Git Revert:
```bash
git checkout main
git pull origin main
git revert -m 1 <merge-commit-sha>
git push origin main
```
Then trigger manual deploy in Render dashboard.

---

## 11. Managed PostgreSQL 30-Day Free Tier Notice

> [!WARNING]
> Render's free tier PostgreSQL databases automatically expire **30 days after creation**.
> 
> To maintain the deployment beyond 30 days:
> - Upgrade `proofpay-db` to the **Starter** tier ($7/mo), OR:
> - Create a new free database instance, update `DATABASE_URL` in the web service, and the service will automatically re-bootstrap demo rows on boot via `ensureHostedBootstrap()`.
