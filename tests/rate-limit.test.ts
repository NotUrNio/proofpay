import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  checkDemoRateLimits,
  resetRateLimits,
  getClientIp,
  getClientIpDetails,
} from "@/lib/rate-limit";

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

  describe("getClientIp & getClientIpDetails (Proxy & Anti-Spoofing)", () => {
    const makeReq = (headers: Record<string, string>) => {
      return new Request("http://localhost:3000/api/jobs", {
        headers: new Headers(headers),
      });
    };

    it("prefers cf-connecting-ip as the most trusted CDN header", () => {
      const req = makeReq({
        "cf-connecting-ip": "198.51.100.4",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      });
      const details = getClientIpDetails(req);
      expect(details.ip).toBe("198.51.100.4");
      expect(details.sourceHeader).toBe("cf-connecting-ip");
    });

    it("picks the rightmost public IP in multi-hop x-forwarded-for, defeating client spoofing", () => {
      // Client forged "8.8.8.8", proxy appended "203.0.113.50"
      const req = makeReq({
        "x-forwarded-for": "8.8.8.8, 203.0.113.50",
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
      expect(getClientIpDetails(req).sourceHeader).toBe("x-forwarded-for");
    });

    it("skips Render internal proxy IP (10.x.x.x) at the tail and returns the true public client IP", () => {
      // Client forged "1.1.1.1", Render edge saw "198.51.100.99", internal mesh hop was "10.0.4.15"
      const req = makeReq({
        "x-forwarded-for": "1.1.1.1, 198.51.100.99, 10.0.4.15",
      });
      expect(getClientIp(req)).toBe("198.51.100.99");
      expect(getClientIpDetails(req).isPrivate).toBe(false);
    });

    it("falls back to rightmost hop if all hops are internal/private in VPC", () => {
      const req = makeReq({
        "x-forwarded-for": "10.0.1.1, 10.0.2.2",
      });
      expect(getClientIp(req)).toBe("10.0.2.2");
      expect(getClientIpDetails(req).isPrivate).toBe(true);
    });

    it("uses x-real-ip if x-forwarded-for is missing", () => {
      const req = makeReq({
        "x-real-ip": "192.0.2.1",
      });
      const details = getClientIpDetails(req);
      expect(details.ip).toBe("192.0.2.1");
      expect(details.sourceHeader).toBe("x-real-ip");
    });

    it("falls back to 127.0.0.1 if no forwarding headers are present", () => {
      const req = makeReq({});
      expect(getClientIp(req)).toBe("127.0.0.1");
      expect(getClientIpDetails(req).sourceHeader).toBe("fallback");
    });
  });
});

