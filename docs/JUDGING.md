# ProofPay — Hackathon Evaluator & Judging Guide

> **Project**: ProofPay (Autonomous AI-Verified Milestone Escrow & Instant Payouts)  
> **Repository**: [https://github.com/nityam/proofpay](https://github.com/nityam/proofpay)  
> **Hosted Deployment**: `https://proofpay.onrender.com` *(Render deployment ready via `render.yaml`)*

---

## ⚡ 5-Minute Evaluation Path (Quickest Way to Judge)

Follow this step-by-step path to experience the complete ProofPay workflow in under 5 minutes:

### Step 1: Log in with Seeded Demo Accounts (Role Switcher)
ProofPay uses role-based access control with pre-seeded demo accounts. In the top-right navigation bar, click the **Role Switcher** badge to instantly swap perspectives:
- **Client**: `alice@proofpay.io` (Can fund escrow jobs, create mandates)
- **Freelancer**: `priya@proofpay.io` (Can submit deliverable files for AI verification)
- **Reviewer**: `reviewer@proofpay.io` (Can access Human Review `/inbox`, Policy Editor `/policy`, Chaos Testing `/chaos`, and AG Studio `/studio`)

### Step 2: The Autonomous Happy Path (Instant Payout)
1. Switch to **Client** (`alice@proofpay.io`).
2. Go to **Dashboard** (`/`) and view the seeded job: *"Summer Sale Banner (Milestone 1)"*. Notice it is already funded into PayPal escrow.
3. Switch to **Freelancer** (`priya@proofpay.io`).
4. Click **"Submit Work"** (`/jobs/[id]/submit`).
5. Upload the compliant fixture: `eval/fixtures/case_01_compliant_warm_grid.png`.
6. Click **"Verify & Release Payout"**.
7. Watch the verification pipeline in real time:
   - **Hard Checks (6ms)**: Dimensions (1080x1080), size (66 KB $\le$ 2MB), magic bytes, metadata sanitized.
   - **Multimodal AI Sensor**: $K=3$ Google Gemini ensemble confirms brand palette and required keyword `"SUMMER SALE"`.
   - **Zero-LLM Policy Guard**: Pure TypeScript invariants validate signed cap, payee match, and confidence.
   - **Instant Payout**: PayPal Payouts REST API executes immediately with idempotent `sender_batch_id`.

### Step 3: Adversarial Prompt Injection Defense Drill
1. While still on `/jobs/[id]/submit`, upload an adversarial fixture: `eval/fixtures/case_17_adversarial_visible_injection.png` (or `case_19_adversarial_metadata_chunk.png`).
2. Click **"Verify & Release Payout"**.
3. Observe how ProofPay intercepts the attack:
   - Metadata chunks containing prompt injections are stripped in memory.
   - The Gemini sensor flags `injection_suspected: true`.
   - The Policy Guard raises `RULE_NO_INJECTION_SUSPECTED` and halts payout execution.
   - **Zero PayPal calls made; $0.00 moved**.

### Step 4: Human Review & PayPal Refund
1. Switch to **Reviewer** (`reviewer@proofpay.io`).
2. Navigate to `/inbox` (**Human Review Queue**).
3. View the gray-zone deliverable ($\Delta E_{00} \in [11.5, 16.0]$). See how ProofPay penalizes borderline confidence and honestly routes subjective work to humans instead of hallucinating approval.
4. Click **"Reject & Refund Escrow"**. ProofPay calls PayPal Payments v2 (`POST /v2/payments/captures/{id}/refund`) to refund the client's escrow payment, logging the refund ID to the audit ledger.

### Step 5: Real PayPal Idempotency & Negative Testing Drills
1. Navigate to `/chaos` (**Chaos Negative Testing Panel**).
2. Run **Drill 3: Real Idempotency Proof**:
   - ProofPay sends duplicate requests with identical `PayPal-Request-Id` (Orders v2) and identical `sender_batch_id` (Payouts v1).
   - Shows live PayPal response: Orders returns the existing order resource; Payouts rejects with HTTP 400 `USER_BUSINESS_ERROR: Batch with given sender_batch_id already exists`.
3. Run **Drill 1: Duplicate Invoice ID** (Orders v2 duplicate rejection).
4. Run **Drill 4: Webhook Replay** (Network duplicate delivery deduplication).

### Step 6: Immutable Hash Chain & AG Studio
1. Open terminal and run:
   ```bash
   pnpm ledger:verify
   ```
   Output: walks the SHA-256 hash chain and confirms 0 broken rows.
2. Visit `/studio` to view **AG Studio** embedded directly in the app, introspecting the visual workflow canvas and runtime ledger feed.

---

## 🛠️ How to Run Locally from Clean Clone

### 1. Prerequisites
- **Node.js** 20+ (Node v26 verified)
- **pnpm** (or `npm`)
- **Docker** (for local PostgreSQL database)

### 2. Setup Commands
```bash
# Clone the repository
git clone https://github.com/nityam/proofpay.git
cd proofpay

# Install dependencies
pnpm install

# Configure environment template
cp .env.example .env
```

### 3. Start Database & Seed Demo Data
```bash
# Start local PostgreSQL container
docker compose up -d

# Push Drizzle schema to PostgreSQL
pnpm db:push

# Seed demo accounts, mandates, jobs, and ledger history in one command
pnpm demo:seed
```

### 4. Start Next.js Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔬 How to Reproduce Benchmark Eval (Offline & Live)

ProofPay includes a 28-fixture deterministic benchmark evaluation harness with committed offline response cache.

### Offline Reproduction (Zero API Key Needed):
Anyone can reproduce the exact benchmark results offline in under 500ms without an API key or incurring quota:
```bash
pnpm eval
```
**Expected Output**:
```text
================================================================================
                       BENCHMARK EVALUATION RESULTS TABLE                       
================================================================================
Overall Accuracy (28):   100.0% [95% CI: 87.9% - 100.0%]
Dev Split Accuracy (13): 100.0% [95% CI: 77.2% - 100.0%]
Held-Out Accuracy (15):  100.0% [95% CI: 79.6% - 100.0%]
FALSE-APPROVAL Rate:     0.0% (0/22) [TARGET: 0%]
FALSE-REJECTION Rate:    0.0% (0/6)
Human Review Route Rate: 21.4% (6/28)
Median Latency:          16 ms
Tokens (In / Out / Tot): 31824 / 8468 / 40292
Avg Cost / Verification: $0.00035 (Total: $0.00985)
--------------------------------------------------------------------------------
Adversarial Injection Defense Drill (4 cases):
  - Cases Seen by Model: 3/4 (1 stopped pre-model by hard/metadata checks)
  - Model Fooled Rate:   0% (0/3)
  - Outcome Changed:     0% [TARGET: 0%]
  - Guard Held Rate:     100.0% (Zero-LLM Guard held firm on all injections)
================================================================================
```

### Live Reproduction (with Gemini API Key):
```bash
pnpm eval:live
```
Calls Google Gemini in real time with $K=3$ ensemble verification across all 28 fixtures.

---

## 🧪 Automated Test Suite Verification

Run the entire vitest test suite:
```bash
pnpm test
```
**Test Results**: 8 test suites, 54 tests, **100% passing**:
1. `test/e2e-slice.test.ts`: End-to-end autonomous escrow happy path from clean DB to payout and ledger verification.
2. `test/guard.test.ts`: Zero-LLM Policy Guard deterministic safety rules and transaction invariants.
3. `test/mandate.test.ts`: HMAC-SHA256 signed mandate validation, parameter caps, and expiration checks.
4. `test/ledger.test.ts`: Immutable database trigger enforcement (UPDATE/DELETE/TRUNCATE blocked) + SHA-256 hash chaining.
5. `test/m2-verification.test.ts`: Boundary tests (2MB size limits, 1080x1080 dimensions, polyglot containers, acTL chunk rejection).
6. `test/m4-chaos-replay.test.ts`: PayPal negative testing headers, simulation codes, idempotency drills, and counterfactual replay engine.
7. `test/m4-step0-security.test.ts`: Access control, role enforcement, bundle secret leak prevention, client-side isolation.
8. `test/paypal.test.ts`: Real PayPal sandbox OAuth token caching and API request formatting.

---

## 📂 Key Architecture Files for Judges to Review

| Component | File Path | Why It Matters |
| :--- | :--- | :--- |
| **Pure TypeScript Policy Guard** | [`src/lib/guard/guard.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/guard/guard.ts) | **ZERO AI imports**. Pure deterministic code that protects money even if LLM is compromised. |
| **Signed Escrow Mandate** | [`src/lib/guard/mandate.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/guard/mandate.ts) | Cryptographic HMAC-SHA256 contract locking max payout cap and payee address upfront. |
| **Deterministic Hard Checks** | [`src/lib/verify/hard-checks.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/verify/hard-checks.ts) | Raw byte inspection: container format validation, metadata sanitization, dimensions, size limits. |
| **Color Science (CIEDE2000)** | [`src/lib/verify/color-palette.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/verify/color-palette.ts) | Algorithmic CIEDE2000 $\Delta E_{00}$ color distance with calibrated gray-zone routing. |
| **PayPal Orders v2 (Escrow Capture)** | [`src/lib/paypal/orders.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/paypal/orders.ts) | Idempotent order creation and capture into platform escrow with `custom_id` traceability. |
| **PayPal Payouts REST (Settlement)** | [`src/lib/paypal/payouts.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/paypal/payouts.ts) | Idempotent payout release to freelancer sandbox accounts via `sender_batch_id`. |
| **PayPal Chaos & Idempotency Proof** | [`src/lib/paypal/chaos.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/paypal/chaos.ts) | Real double-transmission proof and negative testing simulation protocol. |
| **Immutable Database Ledger** | [`src/lib/ledger/ledger.ts`](file:///Users/nityam/Documents/Visual%20Studio/Paypal%20Ai%20Hackathon/src/lib/ledger/ledger.ts) | Database triggers + SHA-256 hash chaining walking every historical transition. |
