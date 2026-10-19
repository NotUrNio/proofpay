/**
 * Canonical Bundled Demo Templates
 *
 * In accordance with ProofPay's financial safety invariants:
 * Simulated funding (isMock/isSimulated) is STRICTLY restricted to these exact
 * bundled presets with fixed parameters. Custom user-supplied amounts or payees
 * can NEVER use simulated funding and must undergo authentic PayPal Orders authorization.
 */

export const BUNDLED_DEMO_PRESETS = [
  "Demo: 1. Happy Path: Compliant Banner",
  "Demo: 2. Wrong Size: Dimension Mismatch",
  "Demo: 3. Adversarial Prompt Injection",
  "Demo: 4. Borderline Brand Color",
  "Social Media Banner (Summer Sale)",
  "Instagram Story Banner (Near-Miss Crimson)",
  "Hero Brand Illustration (Awaiting Submission)",
];

export const ALLOWED_DEMO_PAYEES = [
  "priya@proofpay.io",
  "priya-designer@sandbox.paypal.com",
];

export function isBundledDemoJob(title: string, payeeEmail: string): boolean {
  const isPresetTitle =
    title.startsWith("Demo:") || BUNDLED_DEMO_PRESETS.includes(title);
  const isAllowedPayee = ALLOWED_DEMO_PAYEES.includes(payeeEmail);
  return isPresetTitle && isAllowedPayee;
}

