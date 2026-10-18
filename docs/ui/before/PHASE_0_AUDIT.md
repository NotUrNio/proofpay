# Phase 0 Baseline UI Audit & Metrics

**Date**: 2026-10-19  
**Branch**: `ui-redesign` (branched from `main` @ `v1.0.0-submission`)  
**Target Deployment**: `https://proofpay-68qi.onrender.com` / `http://localhost:3000`

---

## 1. UI Routes Inventory & Screenshots

All screenshots captured at both **390px** (iPhone 12/13/14 mobile viewport) and **1440px** (Desktop widescreen) and saved in `docs/ui/before/`:

| # | Route | Purpose | Mobile (390px) | Desktop (1440px) |
|---|-------|---------|----------------|------------------|
| 1 | `/` | Home / Landing / Dashboard | [`01_home_390px.png`](01_home_390px.png) | [`01_home_1440px.png`](01_home_1440px.png) |
| 2 | `/jobs/new` | Create Milestone Escrow | [`02_jobs_new_390px.png`](02_jobs_new_390px.png) | [`02_jobs_new_1440px.png`](02_jobs_new_1440px.png) |
| 3 | `/jobs/[id]` | Job Pipeline Details | [`03_job_details_390px.png`](03_job_details_390px.png) | [`03_job_details_1440px.png`](03_job_details_1440px.png) |
| 4 | `/jobs/[id]/submit` | Freelancer Deliverable Upload | [`04_job_submit_390px.png`](04_job_submit_390px.png) | [`04_job_submit_1440px.png`](04_job_submit_1440px.png) |
| 5 | `/inbox` | Reviewer Triage Inbox | [`05_inbox_390px.png`](05_inbox_390px.png) | [`05_inbox_1440px.png`](05_inbox_1440px.png) |
| 6 | `/policy` | Policy Engine & Counterfactual Replay | [`06_policy_390px.png`](06_policy_390px.png) | [`06_policy_1440px.png`](06_policy_1440px.png) |
| 7 | `/chaos` | Chaos Lab & Negative Testing | [`07_chaos_390px.png`](07_chaos_390px.png) | [`07_chaos_1440px.png`](07_chaos_1440px.png) |
| 8 | `/studio` | AG Studio Analytics Dashboard | [`08_studio_390px.png`](08_studio_390px.png) | [`08_studio_1440px.png`](08_studio_1440px.png) |
| 9 | `/eval` | 28-Fixture Benchmark Evaluation | [`09_eval_390px.png`](09_eval_390px.png) | [`09_eval_1440px.png`](09_eval_1440px.png) |

---

## 2. Lighthouse Mobile Audit Baseline

Audits recorded using Chrome Headless with mobile screen emulation (390x844, 4x CPU slowdown). Raw JSON outputs preserved in `docs/ui/before/`.

### A. Home Page (`/`) — `lighthouse_home_mobile.json`
- **Performance**: **72 / 100**
- **Accessibility**: **96 / 100**
- **Best Practices**: **96 / 100**
- **SEO**: **100 / 100**
- **Cumulative Layout Shift (CLS)**: **0.197** *(Target: < 0.10)*
- **First Contentful Paint (FCP)**: **1.2 s**
- **Largest Contentful Paint (LCP)**: **4.9 s** *(Target: < 2.5 s)*

### B. Job Pipeline Page (`/jobs/[id]`) — `lighthouse_job_mobile.json`
- **Performance**: **69 / 100**
- **Accessibility**: **96 / 100**
- **Best Practices**: **96 / 100**
- **SEO**: **100 / 100**
- **Cumulative Layout Shift (CLS)**: **0.273** *(Target: < 0.10)*
- **First Contentful Paint (FCP)**: **1.2 s**
- **Largest Contentful Paint (LCP)**: **4.8 s** *(Target: < 2.5 s)*

### Key Lighthouse Takeaways
1. **High CLS (0.197 - 0.273)**: Unmounted money flow strip, dynamic pipeline cards, and AG Grid load asynchronously without min-height container reservation, causing visible vertical jumps.
2. **High LCP (4.8s - 4.9s)**: Large JS chunks from AG Grid Community and Enterprise libraries are loaded unconditionally on the main thread rather than lazily loaded on demand.

---

## 3. Top Issues Identified Per Page

### Global Shell & Nav
- **Two competing navigation bars**: Top bar has role selector and sandbox banner; second bar has 8 navigation links. On mobile, this stacks and pushes content below the fold.
- **Generic Role Switcher**: A bare `<select>` element without persona identity (Priya the Freelancer, Alice the Client, Alex the Reviewer).
- **Uncategorized Nav Links**: Developer/auditor lab routes (`/policy`, `/chaos`, `/studio`, `/eval`) sit at the same level as user workflow routes (`/jobs/new`, `/inbox`).
- **Money Strip Flash**: Shows placeholder `$...` before hydration, shifting layout.

### Home (`/`)
- **No 10-Second Hook**: Opens directly with density stats and a large data grid. First-time visitors cannot tell who this is for or how money moves.
- **No Interactive Guided Demo**: Visitors must either create real PayPal transactions or wonder what to click. Lacks 1-click self-contained scenario cards with sample files.
- **Heavy Bundle Weight**: Direct embedding of AG Grid on home page inflates client bundle size.

### New Job (`/jobs/new`)
- **Complex Monolithic Form**: All fields (including raw JSON and technical color tolerance) are shown at once without a progressive 3-step sequence.
- **No Presets**: Freelancers/clients must manually input pixel dimensions, hex codes, and aspect ratios.
- **Missing Plain-Language Summary**: Does not show a live preview of "What will be checked and what gets paid when".

### Job Details (`/jobs/[id]`)
- **Generic Pipeline Graphic**: Just a row of colored badge pills without physical checkpoint journey feeling.
- **No PayPal Sandbox Links**: Transaction and payout IDs are plain text; cannot click to inspect in the PayPal Sandbox dashboard.
- **No "What Happens Next" Section**: Users are left wondering whether client approval or automated verification is awaited.

### Deliverable Submit (`/jobs/[id]/submit`)
- **Primitive File Upload**: Standard `<input type="file">` without drag-and-drop zone.
- **No Pre-flight Checklist**: Does not inspect image aspect ratio, resolution, or file size before submission.
- **No Live Multi-Stage Verification Flow**: Jumps directly to complete state without showing the transparent checks (Hard Checks $\to$ Multimodal Read $\to$ Policy Guard).

### Reviewer Inbox (`/inbox`)
- **Single Flat List**: Reviewer cannot inspect deliverable details without navigating away.
- **No Keyboard Shortcuts**: Lacks rapid triage bindings (`J`/`K` navigation, `A` approve, `R` reject).
- **No Dry-Run Impact Preview**: Does not clarify what money moves or what the Policy Guard verifies prior to clicking approve.

### Policy Editor (`/policy`)
- **Numeric-Only Sliders**: No intuitive presets like "Cautious", "Balanced", or "Fast".
- **Raw Diff Output**: Counterfactual replay returns raw JSON fields instead of a plain-English impact statement.

### Chaos Lab (`/chaos`)
- **Table Layout**: Does not feel like a rigorous reliability console. Needs drill-by-drill execution cards, real-time log stream, and a 1-click "Run All" suite.

### AG Studio (`/studio`)
- **No Contextual KPI Strip**: Opens directly to an empty or default grid without milestone health metrics.
- **No Graceful Fallback**: If license features are absent, UI needs to gracefully emphasize core Community features rather than showing empty space.

### Eval Benchmark (`/eval`)
- **Raw Metric Display**: Lacks clear Wilson confidence intervals, explicit $N=28$ sample size caveats, and transparent model metadata (`gemini-3.8-flash`).
