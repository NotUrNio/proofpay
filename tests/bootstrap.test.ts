import { describe, it, expect, beforeAll } from "vitest";
import { ensureHostedBootstrap, BUNDLED_JOB_IDS } from "../src/lib/bootstrap";
import { db, jobs, policies, ledgerEvents } from "../src/db";
import { eq, count } from "drizzle-orm";
import crypto from "crypto";

describe("Hosted Database Bootstrap Invariants (src/lib/bootstrap.ts)", () => {
  beforeAll(async () => {
    // Ensure initial baseline schema and data exist
    await ensureHostedBootstrap();
  });

  it("1. never overwrites or deletes existing hosted policies", async () => {
    const customPolicyName = `Custom Safety Policy ${Date.now()}`;
    await db.insert(policies).values({
      name: customPolicyName,
      maxDailyPayoutAmount: "9999.00",
      maxJobPayoutAmount: "1234.00",
      minConfidenceThreshold: "0.9900",
      requireHumanReviewIfAmbiguous: false,
      isActive: true,
    });

    const [beforePolicyCount] = await db.select({ c: count() }).from(policies);

    // Re-run bootstrap
    await ensureHostedBootstrap();

    const [afterPolicyCount] = await db.select({ c: count() }).from(policies);
    expect(afterPolicyCount.c).toBe(beforePolicyCount.c);

    // Verify custom policy wasn't overwritten or altered
    const [retrieved] = await db.select().from(policies).where(eq(policies.name, customPolicyName));
    expect(retrieved).toBeDefined();
    expect(retrieved.maxJobPayoutAmount).toBe("1234.00");
    expect(retrieved.requireHumanReviewIfAmbiguous).toBe(false);
  });

  it("2. handles a hosted DB that already holds v1.0.0 data without overwriting custom modifications", async () => {
    // Modify one bundled job's title or status to simulate live database activity
    const nhId = BUNDLED_JOB_IDS.NEEDS_HUMAN;
    await db
      .update(jobs)
      .set({ description: "Custom production description from v1.0.0 deployment" })
      .where(eq(jobs.id, nhId));

    const [beforeJobsCount] = await db.select({ c: count() }).from(jobs);
    const [beforeLedgerCount] = await db.select({ c: count() }).from(ledgerEvents);

    // Call bootstrap on the already-populated DB
    await ensureHostedBootstrap();

    const [afterJobsCount] = await db.select({ c: count() }).from(jobs);
    const [afterLedgerCount] = await db.select({ c: count() }).from(ledgerEvents);

    // Zero rows added or deleted
    expect(afterJobsCount.c).toBe(beforeJobsCount.c);
    expect(afterLedgerCount.c).toBe(beforeLedgerCount.c);

    // Verified custom description was not overwritten by seed defaults
    const [jobAfter] = await db.select().from(jobs).where(eq(jobs.id, nhId));
    expect(jobAfter.description).toBe("Custom production description from v1.0.0 deployment");
  });

  it("3. runs only when needed: no-op when bundled jobs and policies are already present", async () => {
    const [jobsBefore] = await db.select({ c: count() }).from(jobs);
    const [policiesBefore] = await db.select({ c: count() }).from(policies);
    const [ledgerBefore] = await db.select({ c: count() }).from(ledgerEvents);

    // Execute bootstrap twice
    await ensureHostedBootstrap();
    await ensureHostedBootstrap();

    const [jobsAfter] = await db.select({ c: count() }).from(jobs);
    const [policiesAfter] = await db.select({ c: count() }).from(policies);
    const [ledgerAfter] = await db.select({ c: count() }).from(ledgerEvents);

    expect(jobsAfter.c).toBe(jobsBefore.c);
    expect(policiesAfter.c).toBe(policiesBefore.c);
    expect(ledgerAfter.c).toBe(ledgerBefore.c);
  });
});

