import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postDemoReset } from "../src/app/api/demo/reset/route";
import { ensureHostedBootstrap, BUNDLED_JOB_IDS } from "../src/lib/bootstrap";
import { db, jobs, ledgerEvents } from "../src/db";
import { eq, inArray, count } from "drizzle-orm";
import { resetRateLimits } from "../src/lib/rate-limit";
import { verifyLedgerChain } from "../src/db/ledger";
import crypto from "crypto";

describe("POST /api/demo/reset Security & Invariants", () => {
  const originalEnv = { ...process.env };
  const customJobId = crypto.randomUUID();

  beforeAll(async () => {
    await ensureHostedBootstrap();

    // Insert a non-bundled job to test that reset never touches non-bundled rows
    await db.insert(jobs).values({
      id: customJobId,
      title: "Custom Non-Bundled Client Job",
      description: "User submitted bespoke project",
      clientEmail: "custom@client.io",
      freelancerEmail: "custom@freelancer.io",
      amount: "99.00",
      currency: "USD",
      status: "CREATED",
    });
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENABLE_DEMO_RESET = "true";
    resetRateLimits();
  });

  it("1. rejects request with no role cookie with HTTP 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Role Cookie Required");
  });

  it("2. rejects client persona with HTTP 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: { cookie: "proofpay_role=client" },
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Access Denied");
  });

  it("3. rejects freelancer persona with HTTP 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: { cookie: "proofpay_role=freelancer" },
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Access Denied");
  });

  it("4. rejects reviewer when ENABLE_DEMO_RESET is false or unset", async () => {
    process.env.ENABLE_DEMO_RESET = "false";
    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: { cookie: "proofpay_role=reviewer" },
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Demo state reset is disabled");
  });

  it("5. allows reviewer when ENABLE_DEMO_RESET=true and returns HTTP 200 with DEMO_STATE_RESET event", async () => {
    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: { cookie: "proofpay_role=reviewer" },
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ledgerEventId).toBeDefined();

    // Verify bundled jobs are at canonical states
    const [nh] = await db.select().from(jobs).where(eq(jobs.id, BUNDLED_JOB_IDS.NEEDS_HUMAN));
    const [funded] = await db.select().from(jobs).where(eq(jobs.id, BUNDLED_JOB_IDS.FUNDED));
    const [paid] = await db.select().from(jobs).where(eq(jobs.id, BUNDLED_JOB_IDS.PAID));

    expect(nh.status).toBe("VERIFIED");
    expect(funded.status).toBe("FUNDED");
    expect(paid.status).toBe("PAID");
  });

  it("6. is idempotent across consecutive invocations", async () => {
    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/demo/reset", {
        method: "POST",
        headers: { cookie: "proofpay_role=reviewer" },
      });

    const res1 = await postDemoReset(makeReq());
    expect(res1.status).toBe(200);

    const res2 = await postDemoReset(makeReq());
    expect(res2.status).toBe(200);

    const res3 = await postDemoReset(makeReq());
    expect(res3.status).toBe(200);
  });

  it("7. invariant: never deletes or modifies historical ledger rows", async () => {
    const [beforeCount] = await db.select({ c: count() }).from(ledgerEvents);

    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: { cookie: "proofpay_role=reviewer" },
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(200);

    const [afterCount] = await db.select({ c: count() }).from(ledgerEvents);
    // Row count must strictly increase by 1 (append-only)
    expect(afterCount.c).toBe(beforeCount.c + 1);

    // Hash chain remains valid
    const chainResult = await verifyLedgerChain();
    expect(chainResult.valid).toBe(true);
    expect(chainResult.totalEventsVerified).toBeGreaterThan(0);
  });

  it("8. invariant: never touches non-bundled jobs", async () => {
    const [beforeCustom] = await db.select().from(jobs).where(eq(jobs.id, customJobId));
    expect(beforeCustom.status).toBe("CREATED");
    expect(beforeCustom.amount).toBe("99.00");

    const req = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: { cookie: "proofpay_role=reviewer" },
    });
    const res = await postDemoReset(req);
    expect(res.status).toBe(200);

    const [afterCustom] = await db.select().from(jobs).where(eq(jobs.id, customJobId));
    expect(afterCustom.status).toBe("CREATED");
    expect(afterCustom.amount).toBe("99.00");
    expect(afterCustom.title).toBe("Custom Non-Bundled Client Job");
  });

  it("9. enforces rate limiting: rejects excessive requests with HTTP 429", async () => {
    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/demo/reset", {
        method: "POST",
        headers: {
          cookie: "proofpay_role=reviewer",
          "x-forwarded-for": "203.0.113.88",
        },
      });

    // Send 5 requests (within rate limit of 5 per minute)
    for (let i = 0; i < 5; i++) {
      const res = await postDemoReset(makeReq());
      expect(res.status).toBe(200);
    }

    // 6th request must be rejected with 429
    const blockedRes = await postDemoReset(makeReq());
    expect(blockedRes.status).toBe(429);
    const body = await blockedRes.json();
    expect(body.error).toContain("Rate limit");
  });
});
