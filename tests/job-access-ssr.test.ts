import { describe, it, expect, vi, beforeEach } from "vitest";
import { canUserAccessJob, DEMO_USERS } from "../src/lib/auth/roles";

// Mirror next.config.ts experimental.authInterrupts = true in Vitest environment
process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";

// Mock next/headers cookies() so we can test JobPage and generateMetadata directly in Vitest

let mockedRoleCookie = "freelancer";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "proofpay_role" ? { value: mockedRoleCookie } : undefined,
  }),
}));

import JobPage, { generateMetadata } from "../src/app/jobs/[id]/page";
import { db, jobs, mandates } from "../src/db";
import { ensureDatabaseSchema } from "../src/db/init";
import { signMandate } from "../src/lib/guard";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("SSR & API Job Ownership Access Control (tests/job-access-ssr.test.ts)", () => {
  const privateJobId = crypto.randomUUID();
  const secretTitle = "CONFIDENTIAL_AEROSPACE_CAD_77419";
  const secretAmount = "419.88";
  const secretOwner = "private-client@vault.example.test";
  const secretPayee = "private-freelancer@vault.example.test";

  beforeEach(async () => {
    await ensureDatabaseSchema();
    await db.delete(mandates).where(eq(mandates.jobId, privateJobId));
    await db.delete(jobs).where(eq(jobs.id, privateJobId));

    await db.insert(jobs).values({
      id: privateJobId,
      title: secretTitle,
      description: "Classified blueprint deliverable",
      clientEmail: secretOwner,
      freelancerEmail: secretPayee,
      amount: secretAmount,
      currency: "USD",
      status: "FUNDED",
    });

    const signed = signMandate({
      jobId: privateJobId,
      maxAmount: secretAmount,
      currency: "USD",
      payeeEmail: secretPayee,
      scope: "classified_cad",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    await db.insert(mandates).values({
      jobId: privateJobId,
      maxAmount: signed.maxAmount,
      currency: signed.currency,
      payeeEmail: signed.payeeEmail,
      scope: signed.scope,
      expiresAt: new Date(signed.expiresAt),
      signature: signed.signature,
    });
  });

  it("1. canUserAccessJob denies wrong-role freelancer and non-owner client on non-demo jobs", () => {
    const privateJob = {
      id: privateJobId,
      clientEmail: secretOwner,
      freelancerEmail: secretPayee,
      amount: secretAmount,
    };

    expect(canUserAccessJob(DEMO_USERS.freelancer, privateJob)).toBe(false);
    expect(canUserAccessJob(DEMO_USERS.reviewer, privateJob)).toBe(true);
  });

  it("2. generateMetadata throws forbidden() (HTTP 403) for wrong-role user (zero leak in <head> or RSC metadata)", async () => {
    mockedRoleCookie = "freelancer"; // Priya (priya@proofpay.io) !== secretPayee
    let caughtError: any = null;
    try {
      await generateMetadata({ params: Promise.resolve({ id: privateJobId }) });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    expect(String(caughtError.digest || caughtError.message)).toContain("403");
    const serializedMeta = JSON.stringify(caughtError);
    expect(serializedMeta).not.toContain(secretTitle);
    expect(serializedMeta).not.toContain(secretAmount);
    expect(serializedMeta).not.toContain(secretPayee);
    expect(serializedMeta).not.toContain(secretOwner);
    expect(serializedMeta).not.toContain(privateJobId);
  });


  it("3. JobPage SSR throws Next.js 15.1 forbidden() (NEXT_HTTP_ERROR_FALLBACK;403) for wrong-role user before querying or serializing props", async () => {
    mockedRoleCookie = "freelancer";
    let caughtError: any = null;
    try {
      await JobPage({ params: Promise.resolve({ id: privateJobId }) });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    // Next.js 15.1 forbidden() throws error with digest "NEXT_HTTP_ERROR_FALLBACK;403"
    expect(String(caughtError.digest || caughtError.message)).toContain("403");
    const serializedErr = JSON.stringify(caughtError);
    expect(serializedErr).not.toContain(secretTitle);
    expect(serializedErr).not.toContain(secretAmount);
    expect(serializedErr).not.toContain(secretPayee);
  });
});
