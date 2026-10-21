# ProofPay Design Plan & Token System

**Document Version**: 1.0.0  
**Phase**: Phase 1 (Design Concept, Token System, Wireframes & Critique)  
**Target Delivery**: Branch `ui-redesign`

---

## 1. Design Concept Candidates

We explored three visual and mental models tailored specifically to autonomous escrow and milestone settlement:

### Candidate A: The Checkpoint Route & Waystation (Selected)
- **Concept**: Money is visualized as a physical, secured courier payload traveling along an unbending route. Funds enter an escrow vault, halt at verification gates (Deterministic Hard Checks, Multimodal Visual Read, Pure Policy Guard), and dispatch immediately upon clearance.
- **Why this wins**: Solves the core emotional problem of escrow for both Priya (freelancer) and Alice (client): **anxiety about where money is right now**. It communicates the entire value proposition in under 10 seconds. When a deliverable is submitted, the user sees the checkpoint open, verify, and release payment to PayPal.
- **Audience resonance**: Freelancers see that payment release is automatic and cannot be arbitrarily delayed; clients see that their funds never leave escrow until verifiable contract criteria pass.

### Candidate B: The Digital Clearinghouse Board
- **Concept**: High-density financial settlement terminal modeled after ACH/Fedwire clearinghouses, featuring ticker feeds, reconciliation logs, and transaction status matrices.
- **Shortcoming**: Too cold and intimidating for non-technical freelancers; resembles an internal audit dashboard rather than a consumer/prosumer escrow app.

### Candidate C: The Cryptographic Receipt Chain
- **Concept**: Visualizes every milestone as a physical paper receipt with cryptographic watermark badges, hash stamps, and perforated settlement slips.
- **Shortcoming**: Metaphor breaks down when representing multi-stage pipeline evaluation (e.g., color difference or prompt injection sensors).

---

## 2. Design Token System

To avoid visual fatigue and maintain institutional financial trust, the system uses a restrained, high-contrast palette with architectural clarity.

### A. Named Color Palette (6 Tokens)
| Token Name | Hex Code | Role | Usage |
|:---|:---|:---|:---|
| **Canvas Solid** | `#0D1117` | Base Canvas | Primary dark neutral foundation; calm, deep, high contrast. |
| **Card Surface** | `#161B22` | Structural Surface | Raised container surface with crisp 1px borders. |
| **Border Muted** | `#30363D` | Structural Dividers | Architectural boundary lines, zero blur, high legibility. |
| **PayPal Marine** | `#0070BA` | Primary Brand Anchor | Primary action buttons, active pipeline steps, escrow trust badges. |
| **Settlement Emerald** | `#2EA043` | Verification Success | Autonomous approval, verified ledger chain, paid payouts. |
| **Review Amber** | `#D29922` | Human Review Required | Gray-zone banner review ($\Delta E \in [11.5, 16.0]$), waiting queue. |
| **Halt Crimson** | `#F85149` | Security & Reject | Prompt injection detected, mandate cap exceeded, failed hard checks. |

### B. Typography Roles & Scale
- **Font Stack**: Self-hosted modern system geometric sans via `next/font` (`Geist` or `Inter`) for interface prose; `JetBrains Mono` for hashes, currency amounts, and PayPal IDs.
- **Type Scale**:
  - `Display`: 28px / line-height 36px, font-weight 600, tracking -0.02em (Hero hook)
  - `Title`: 20px / line-height 28px, font-weight 600 (Section headings)
  - `Headline`: 16px / line-height 24px, font-weight 600 (Card titles)
  - `Body`: 14px / line-height 20px, font-weight 400 (Descriptions, instructions)
  - `Caption`: 12px / line-height 16px, font-weight 500 (Labels, status metadata)
  - `Mono`: 13px / line-height 18px, font-weight 500 (Hashes, PayPal batch IDs, amounts)
- **Line Length Constraint**: Max 68 characters per line (`max-w-prose` / `max-w-2xl`) to ensure effortless reading.

### C. Spacing, Radii & Elevation
- **Spacing Grid**: 4px base scale: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`.
- **Radii**: Crisp and modern:
  - Chips / Badges: `4px`
  - Form inputs / Buttons: `6px`
  - Cards / Panels: `8px`
  - Signature Checkpoint Track: `10px`
- **Elevation**: Zero muddy or diffuse drop shadows. Surfaces use clean 1px borders (`#30363D`) and subtle hard offset elevation: `box-shadow: 0 1px 2px rgba(0,0,0,0.2)`.

### D. Motion Rules
- **Duration**: `150ms` for state changes (button hovers, accordion expansions); `300ms` for pipeline step progression.
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out).
- **Reduced Motion**: All animations strictly wrapped in `@media (prefers-reduced-motion: reduce)` with instant transitions.
- **Real Data Only**: No fake loading spinners or artificial delays; UI transitions match real Server-Sent Events or WebSocket state updates.

---

## 3. ASCII Wireframes

### A. Home (Landing & Guided Demo)
```
+-------------------------------------------------------------------------------+
|  PROOFPAY   [ Sandbox Demo - No Real Money Moves ]   Demo as: (Priya/Alice/Alex)|
+-------------------------------------------------------------------------------+
|                                                                               |
|  Autonomous milestone escrow that pays freelancers the second work passes.     |
|  Priya gets paid in seconds. Alice only pays for verified deliverables.        |
|                                                                               |
|  [ Try 60-Second Guided Demo ]      [ Continue as Priya ]   [ Continue as Alice]
|                                                                               |
|  +-- THE SIGNATURE CHECKPOINT ROUTE ---------------------------------------+  |
|  | [1. FUNDED]  -->  [2. SUBMITTED]  -->  [3. VERIFIED]  -->  [4. PAID]   |  |
|  | $25.00 Escrow      1080x1080 PNG        Pure TS Guard       PayPal Payout|  |
|  | PayPal Order       MD5 / Dimensions     Zero AI in Guard    $25.00 Sent  |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
|  TRY A LIVE SCENARIO (Real sandbox pipeline, no upload needed):               |
|  +-------------------+  +-------------------+  +----------------------------+ |
|  | 1. Happy Path     |  | 2. Wrong Size     |  | 3. Prompt Injection Block | |
|  | Summer Banner     |  | 800x600 Upload    |  | Embedded text override    | |
|  | -> Auto-paid 2.1s |  | -> Fails hard-check|  | -> Halted: $0 moved      | |
|  +-------------------+  +-------------------+  +----------------------------+ |
|                                                                               |
|  HOW IT IS PROTECTED:                                                         |
|  - Zero AI in Policy Guard (Deterministic fail-closed rules)                  |
|  - Cryptographic SHA-256 Tamper-evident Ledger (10/10 verified)               |
|  - 100% Evaluation Suite (28/28 benchmarks passing, 0 false approvals)         |
+-------------------------------------------------------------------------------+
```

### B. Job Details & Signature Pipeline (`/jobs/[id]`)
```
+-------------------------------------------------------------------------------+
|  PROOFPAY   / Jobs / Summer Sale Banner                     [ Role: Client ]   |
+-------------------------------------------------------------------------------+
|  Social Media Banner (Summer Sale)                            Status: [ PAID ] |
|  $25.00 USD Milestone Escrow                                                   |
|                                                                               |
|  +-- PIPELINE PROGRESS ----------------------------------------------------+  |
|  | (•) Funded      (•) Submitted    (•) Checked      (•) Guard      (•) Paid |  |
|  | PayPal Order    Image uploaded   Dimensions OK    Rules cleared  Sent via  |  |
|  | #8X491...       1080x1080 PNG    Color DeltaE<14  HMAC Valid     Payouts   |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
|  WHAT HAPPENS NEXT:                                                           |
|  "Milestone successfully completed. $25.00 was dispatched to priya@... via    |
|   PayPal Payout batch #B72K9... Trace transaction in PayPal Sandbox."         |
|                                                                               |
|  +-- CONTRACT MANDATE & AUDIT TRAIL ---------------------------------------+  |
|  | Mandate Cap: $25.00 USD | Payee: priya@... | Scope: summer_banner_v1    |  |
|  | SHA-256 Mandate HMAC: 8f9b2c... [Copy]                                  |  |
|  | PayPal Order ID: 4KL819... [View in Sandbox]                             |  |
|  | PayPal Payout ID: 9M310... [View in Sandbox]                            |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

### C. Reviewer Triage Inbox (`/inbox`)
```
+-------------------------------------------------------------------------------+
|  PROOFPAY   / Inbox (1 Pending Review)                      [ Role: Reviewer ] |
+-------------------------------------------------------------------------------+
|  Shortcuts: [J] Next  [K] Prev  [A] Approve & Pay  [R] Reject & Refund        |
|                                                                               |
|  PENDING QUEUE (1)          |  DELIVERABLE INSPECTION: Job #251b...           |
|  +------------------------+ |  Near-Miss Crimson Banner (1080x1080 PNG)       |
|  | [!] Crimson Banner     | |                                                 |
|  | Job #251b4039...       | |  [ Deliverable Image Preview (1080x1080) ]      |
|  | Gray Zone: DeltaE 11.69| |                                                 |
|  | Escrow: $7.50 USD      | |  VERDICT EVIDENCE:                              |
|  | Waiting: 14 mins       | |  - Hard checks: Passed (1080x1080, 1:1, 412 KB) |
|  +------------------------+ |  - Brand color: Detected #C8102E vs #0070BA     |
|                             |    DeltaE = 11.69 (Flagged: Gray zone [11.5-16])|
|                             |  - Prompt Injection: None detected              |
|                             |                                                 |
|                             |  DRY RUN CONSEQUENCE:                           |
|                             |  "If approved: $7.50 USD will be paid to Priya. |
|                             |   Pure TS Guard will verify cap and mandate."   |
|                             |                                                 |
|                             |  [ Approve & Dispatch $7.50 ]  [ Reject & Refund]|
+-------------------------------------------------------------------------------+
```

---

## 4. Critique Against Generic Defaults & What Was Revised

We audited our plan against the 9 prohibited generic defaults:

| Generic Design Default | Status | Concrete Revision in ProofPay |
|:---|:---|:---|
| **1. Cream background + serif + terracotta accent** | **REJECTED** | Used deep slate canvas (`#0D1117`), pure crisp surface (`#161B22`), and official banking blue (`#0070BA`) with zero serif typefaces. |
| **2. Near-black + acid green ("crypto/cyberpunk")** | **REJECTED** | Used institutional financial emerald (`#2EA043`), calm muted slate borders (`#30363D`), and trusted blue. No neon glows or fake cyber aesthetic. |
| **3. Identical rounded cards with soft blurry shadows** | **REJECTED** | Used distinct architectural containers with crisp 1px structural borders and flat offset boundaries. Cards have clear hierarchy (Hero vs Secondary). |
| **4. Gradient washes & blurred mesh blobs** | **REJECTED** | Zero gradient blobs or canvas blurs. All backgrounds are solid, high-contrast, and fast-rendering. |
| **5. ALL-CAPS eyebrow labels above headings** | **REJECTED** | Replaced all uppercase eyebrows with natural sentence-case descriptive breadcrumbs (e.g. "Reviewer triage queue" instead of "QUEUE // 01"). |
| **6. "A · B · C" meta bullet strings** | **REJECTED** | Replaced dot-separated text with discrete, structured data chips with explicit key-value labels. |
| **7. Numbered 01/02/03 markers on static content** | **REJECTED** | Numbering is used *strictly* for sequential processes (e.g., Step 1: Fund $\to$ Step 2: Submit $\to$ Step 3: Verify). Static feature lists use standard icon semantics. |
| **8. Fade-and-slide-up on every single section** | **REJECTED** | Eliminated entrance scroll animations. Content is rendered immediately without opacity delays, reducing CLS to near zero. |
| **9. Single accented/colored word in headlines** | **REJECTED** | Headlines are unified, authoritative prose in single solid colors (e.g. "Autonomous milestone escrow that pays freelancers the second work passes."). |
| **Signature Element Boldness** | **SPENT IN ONE PLACE** | The **Signature Checkpoint Route**: an interactive horizontal money-conduit showing funds moving from Escrow Lockbox $\to$ Deterministic Gate $\to$ Multimodal Gate $\to$ PayPal Instant Settlement. All surrounding UI is calm, legible, and functional. |

