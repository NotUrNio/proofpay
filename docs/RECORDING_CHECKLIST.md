# ProofPay Video Recording & Screencast Checklist

> **Target Video Duration**: Under 2 minutes 45 seconds (Max: 2:40 recommended).  
> **Target Audio**: Clear voiceover in English, normalized at -14 LUFS, no background noise.  
> **Script Reference**: [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

---

## 🛠️ 1. Technical Pre-Flight Setup

### Screen & Display:
- [ ] **Resolution**: 1920x1080 (1080p) or 2560x1440 (1440p) at 60fps.
- [ ] **Aspect Ratio**: Exactly 16:9 widescreen.
- [ ] **Display Scaling**: 100% (or macOS default "Looks like 1920x1080").
- [ ] **Notifications**: Enable "Do Not Disturb" on macOS to block banner popups and system sounds.
- [ ] **Dock & Menu Bar**: Hide dock automatically or crop cleanly to browser viewport.

### Browser Profile:
- [ ] **Browser**: Clean Google Chrome or Chromium profile with zero extension icons showing.
- [ ] **Bookmarks Bar**: Hidden (`Cmd + Shift + B`).
- [ ] **Browser Zoom**: 100% (clean typography, no clipping).
- [ ] **URL**: `http://localhost:3000` (or `https://proofpay.onrender.com`).
- [ ] **Cache / Personas**: Set cookie to `proofpay_role=client` (`alice@proofpay.io`) prior to recording.

### Database & Demo Seed:
- [ ] Run `pnpm demo:seed` (or `POST /api/demo/reset` if hosted) to ensure:
  - Job `10c2bab9-...` is in `NEEDS_HUMAN` (Review Pending in `/inbox`)
  - Job `20f829e2-...` is in `FUNDED` (Ready for submit demo)
  - Job `bf3884d6-...` is in `PAID` (Instant settlement demo)

---

## ⏱️ 2. Timed 2:40 Recording Path

| Timeline | Scene / Screen | Role Switcher | Actions to Perform | Voiceover Focus |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 – 0:25** | Dashboard (`/`) | `Priya (Freelancer)` | Show completed invoices; point to 30-day manual escrow bottleneck. | Freelancers wait weeks; ProofPay introduces autonomous settlement. |
| **0:25 – 1:05** | New Job Wizard (`/jobs/new`) & Submit | `Alice (Client)` $\to$ `Priya (Freelancer)` | Step 1 $\to$ 2 $\to$ 3 (Mandate preview) $\to$ Submit deliverable (`case_01`) $\to$ Watch 6ms hard checks + Gemini + Guard pass $\to$ Instant Payout. | Zero-LLM Guard validates contract; PayPal Payouts releases $5.00 instantly. |
| **1:05 – 1:35** | Adversarial Upload (`/jobs/[id]/submit`) | `Priya (Freelancer)` | Upload `case_17` (Visible pixel prompt injection) $\to$ Watch Guard halt payout. Show $0.00 moved. | Multi-layer defense: chunk stripping + model flag + Zero-LLM guard. Zero funds move. |
| **1:35 – 1:55** | Review Inbox (`/inbox`) | `Alex (Reviewer)` | Click inbox item ($\Delta E = 14.49$) $\to$ Point to deliberate gray-zone $\to$ Click "Reject & Refund Escrow". | Honest human routing for subjective gray zones; PayPal Payments v2 refund. |
| **1:55 – 2:25** | Chaos Panel (`/chaos`) | `Alex (Reviewer)` | Run Drill 3 (Idempotency) $\to$ Show PayPal duplicate batch rejection (HTTP 400). | Real PayPal negative testing & mathematical double-spend prevention. |
| **2:25 – 2:40** | Terminal & Studio (`/studio`) | Any | Run `pnpm ledger:verify` $\to$ Switch to Studio analytics dashboard. | PostgreSQL trigger append-only ledger; Recharts analytics workspace. |
| **2:40 – 2:45** | GitHub Repo / Summary Slide | Any | Display repo link & hackathon stack. | Autonomous trust layer powered by PayPal & Google Gemini. |

---

## 🏆 3. Hackathon Rubric Coverage Audit

Verify that your recording explicitly demonstrates all 4 judging pillars:

- [ ] **Autonomous Agentic Commerce**: Milestone contracts execute and settle autonomously without human bottleneck upon rubric satisfaction.
- [ ] **PayPal Platform Depth**:
  - PayPal Orders v2 (Escrow Capture)
  - PayPal Payments v2 (Refunds)
  - PayPal Payouts v1 (Instant single payouts with `sender_batch_id` idempotency)
- [ ] **AI & Verification Innovation**:
  - $K=3$ Google Gemini multimodal ensemble
  - Sharp-based CIEDE2000 $\Delta E_{00}$ color distance science
  - Honest gray-zone routing to human review
- [ ] **Safety, Invariants & Security**:
  - Zero-LLM Policy Guard (14 deterministic invariants, ZERO AI imports)
  - Adversarial prompt injection defense (pixel text, hidden metadata chunks)
  - Database trigger-enforced append-only cryptographic hash ledger

---

## 🚨 4. Emergency Retry & Continuity Protocols

If a mistake happens during recording:

1. **Mid-Take Delivery Glitch**:
   - Don't stop recording: pause for 3 seconds of silence, state "Retake from Step 2", and re-perform that specific 30-second section. Cut the bad take during video editing.
2. **Demo Jobs Need Resetting**:
   - Run `pnpm tsx scripts/reset-demo-state.ts` in a terminal tab to instantly restore all 3 jobs to their canonical demo states without restarting the server.
3. **Model Free-Tier Quota Limit (HTTP 429)**:
   - ProofPay automatically fails over to `gemini-3.5-flash-lite`. If local quota is exhausted, switch `PAYPAL_MOCK=true` or use recorded evaluation fixtures.
4. **Mouse Movement Pacing**:
   - Move smoothly and deliberately. Hover over key status badges (`AUTO_PAY`, `NEEDS_HUMAN`, `PAID`) for at least 1.5 seconds so viewers can read them.
