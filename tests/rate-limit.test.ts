import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, checkDemoRateLimits, resetRateLimits } from "@/lib/rate-limit";

describe("Demo Safety & Rate Limiting Module", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("permits requests within per-IP sliding window limit", () => {
    const ip = "192.168.1.100";
    for (let i = 0; i < 10; i++) {
      const res = checkDemoRateLimits(ip);
      expect(res.allowed).toBe(true);
      expect(res.ipLimit.remaining).toBe(10 - 1 - i);
    }
  });

  it("blocks requests once per-IP limit is exceeded", () => {
    const ip = "192.168.1.101";
    for (let i = 0; i < 10; i++) {
      checkDemoRateLimits(ip);
    }
    const blockedRes = checkDemoRateLimits(ip);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.ipLimit.remaining).toBe(0);
    expect(blockedRes.reason).toContain("Per-IP rate limit reached");
  });

  it("enforces global daily limit across distinct IPs", () => {
    // Fill global bucket with 100 requests across distinct IPs
    for (let i = 0; i < 100; i++) {
      const res = checkRateLimit("demo_global_daily", 100, 24 * 60 * 60 * 1000);
      expect(res.allowed).toBe(true);
    }

    // 101st request should be blocked
    const globalBlocked = checkRateLimit("demo_global_daily", 100, 24 * 60 * 60 * 1000);
    expect(globalBlocked.allowed).toBe(false);
    expect(globalBlocked.remaining).toBe(0);
  });

  it("resets limit after window expiry", () => {
    const key = "test_window_reset";
    const res1 = checkRateLimit(key, 1, 50); // 50ms window
    expect(res1.allowed).toBe(true);

    const res2 = checkRateLimit(key, 1, 50);
    expect(res2.allowed).toBe(false);

    // Wait 60ms to let window expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const res3 = checkRateLimit(key, 1, 50);
        expect(res3.allowed).toBe(true);
        resolve();
      }, 60);
    });
  });
});
