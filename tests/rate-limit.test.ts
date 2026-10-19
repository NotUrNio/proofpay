import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getClientIp,
  getClientIpDetails,
  parseTrustedProxyHops,
  isPrivateIp,
  isCloudflareIp,
  checkDemoRateLimits,
  resetRateLimits,
} from "../src/lib/rate-limit";
import { GET as getDebugClientIp } from "../src/app/api/debug/client-ip/route";

function makeReq(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/jobs", { headers });
}

describe("Client IP Extraction & Spoofing Resistance (tests/rate-limit.test.ts)", () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.TRUST_CLOUDFLARE_PROXY;
    delete process.env.CLIENT_IP_TRUSTED_PROXY_HOPS;
  });

  it("1. resists spoofed X-Forwarded-For prefix by selecting rightmost public hop appended by edge", () => {
    // Attacker sends "X-Forwarded-For: 1.1.1.1, 8.8.8.8"; edge appends real client "198.51.100.42"
    const req = makeReq({
      "x-forwarded-for": "1.1.1.1, 8.8.8.8, 198.51.100.42",
    });
    const details = getClientIpDetails(req);
    expect(details.ip).toBe("198.51.100.42");
    expect(details.rule).toBe("xff-rightmost-public");
    expect(details.sourceHeader).toBe("x-forwarded-for");
    expect(details.cloudflareVerified).toBe(false);
    expect(details.hopList).toEqual(["1.1.1.1", "8.8.8.8", "198.51.100.42"]);
    expect(details.trustedProxyHops).toBe(0);
    expect(details.isPrivate).toBe(false);
    expect(getClientIp(req)).toBe("198.51.100.42");
  });

  it("2. handles multi-hop X-Forwarded-For by skipping internal RFC 1918 proxy hops on the right", () => {
    // Spoofed "1.2.3.4", real client "203.0.113.25", followed by Render internal hops "172.20.0.5, 10.0.0.2"
    const req = makeReq({
      "x-forwarded-for": "1.2.3.4, 203.0.113.25, 172.20.0.5, 10.0.0.2",
    });
    const details = getClientIpDetails(req);
    expect(details.ip).toBe("203.0.113.25");
    expect(details.rule).toBe("xff-rightmost-public");
    expect(details.sourceHeader).toBe("x-forwarded-for");
    expect(details.hopList).toEqual([
      "1.2.3.4",
      "203.0.113.25",
      "172.20.0.5",
      "10.0.0.2",
    ]);
    expect(details.isPrivate).toBe(false);
  });

  it("3. Render-proxy-as-last-hop: defaults to rightmost public hop when CLIENT_IP_TRUSTED_PROXY_HOPS=0, and skips Render proxy when CLIENT_IP_TRUSTED_PROXY_HOPS=1", () => {
    // Visitor A (198.51.100.10) and Visitor B (203.0.113.99) both arrive through Render's non-Cloudflare public proxy (216.24.57.4)
    const visitorA = makeReq({
      "x-forwarded-for": "1.1.1.1, 198.51.100.10, 216.24.57.4, 10.0.1.9",
    });
    const visitorB = makeReq({
      "x-forwarded-for": "8.8.8.8, 203.0.113.99, 216.24.57.4, 10.0.1.9",
    });

    // With default CLIENT_IP_TRUSTED_PROXY_HOPS=0, untrusted public last hop (216.24.57.4) is returned
    expect(getClientIpDetails(visitorA)).toMatchObject({
      ip: "216.24.57.4",
      rule: "xff-rightmost-public",
      cloudflareVerified: false,
      trustedProxyHops: 0,
    });

    // With CLIENT_IP_TRUSTED_PROXY_HOPS=1, Render's proxy hop (216.24.57.4) is skipped as a trusted proxy,
    // isolating Visitor A and Visitor B into separate rate-limit buckets while still ignoring spoofed prefixes (1.1.1.1 / 8.8.8.8)
    process.env.CLIENT_IP_TRUSTED_PROXY_HOPS = "1";
    const detailsA = getClientIpDetails(visitorA);
    const detailsB = getClientIpDetails(visitorB);

    expect(detailsA).toMatchObject({
      ip: "198.51.100.10",
      rule: "xff-trusted-proxy-hops",
      sourceHeader: "x-forwarded-for",
      cloudflareVerified: false,
      trustedProxyHops: 1,
      hopList: ["1.1.1.1", "198.51.100.10", "216.24.57.4", "10.0.1.9"],
    });
    expect(detailsB).toMatchObject({
      ip: "203.0.113.99",
      rule: "xff-trusted-proxy-hops",
      sourceHeader: "x-forwarded-for",
      cloudflareVerified: false,
      trustedProxyHops: 1,
      hopList: ["8.8.8.8", "203.0.113.99", "216.24.57.4", "10.0.1.9"],
    });
  });

  it("4. validates CLIENT_IP_TRUSTED_PROXY_HOPS env override and clamps safely on short hop lists", () => {
    expect(parseTrustedProxyHops(undefined)).toBe(0);
    expect(parseTrustedProxyHops("")).toBe(0);
    expect(parseTrustedProxyHops("0")).toBe(0);
    expect(parseTrustedProxyHops("2")).toBe(2);
    expect(() => parseTrustedProxyHops("-1")).toThrow(RangeError);
    expect(() => parseTrustedProxyHops("abc")).toThrow(RangeError);
    expect(() => parseTrustedProxyHops("11")).toThrow(RangeError);

    // Multi-proxy chain with CLIENT_IP_TRUSTED_PROXY_HOPS=2 skips two rightmost public proxies
    process.env.CLIENT_IP_TRUSTED_PROXY_HOPS = "2";
    const reqTwoProxies = makeReq({
      "x-forwarded-for": "9.9.9.9, 198.51.100.88, 192.0.2.10, 216.24.57.4",
    });
    expect(getClientIpDetails(reqTwoProxies)).toMatchObject({
      ip: "198.51.100.88",
      rule: "xff-trusted-proxy-hops",
      trustedProxyHops: 2,
    });
  });

  it("5. ignores spoofed cf-connecting-ip and true-client-ip when request did NOT come through Cloudflare", () => {
    // Case A: Attacker sends cf-connecting-ip without cf-ray
    const spoofNoRay = makeReq({
      "cf-connecting-ip": "9.9.9.9",
      "x-forwarded-for": "198.51.100.77, 10.0.0.4",
    });
    expect(getClientIpDetails(spoofNoRay)).toMatchObject({
      ip: "198.51.100.77",
      rule: "xff-rightmost-public",
      sourceHeader: "x-forwarded-for",
      cloudflareVerified: false,
    });

    // Case B: Attacker sends fake cf-ray AND fake cf-connecting-ip, but rightmost public XFF hop is attacker IP (not Cloudflare)
    const spoofWithFakeRay = makeReq({
      "cf-ray": "8d4f1a2b3c4d5e6f-SJC",
      "cf-connecting-ip": "9.9.9.9",
      "true-client-ip": "9.9.9.9",
      "x-forwarded-for": "198.51.100.77, 10.0.0.4",
    });
    expect(getClientIpDetails(spoofWithFakeRay)).toMatchObject({
      ip: "198.51.100.77",
      rule: "xff-rightmost-public",
      sourceHeader: "x-forwarded-for",
      cloudflareVerified: false,
    });
  });

  it("6. trusts cf-connecting-ip / true-client-ip ONLY when request genuinely traversed Cloudflare", () => {
    expect(isCloudflareIp("172.68.10.22")).toBe(true);
    expect(isCloudflareIp("198.51.100.77")).toBe(false);

    const validCfViaProxy = makeReq({
      "cf-ray": "8d4f1a2b3c4d5e6f-SJC",
      "cf-connecting-ip": "198.51.100.55",
      "x-forwarded-for": "198.51.100.55, 172.68.10.22, 10.0.1.3",
    });
    expect(getClientIpDetails(validCfViaProxy)).toMatchObject({
      ip: "198.51.100.55",
      rule: "cloudflare-verified-header",
      sourceHeader: "cf-connecting-ip",
      cloudflareVerified: true,
    });

    const validTrueClientIp = makeReq({
      "cf-ray": "8d4f1a2b3c4d5e6f-LAX",
      "true-client-ip": "203.0.113.44",
      "x-forwarded-for": "203.0.113.44, 104.16.12.34, 10.0.1.3",
    });
    expect(getClientIpDetails(validTrueClientIp)).toMatchObject({
      ip: "203.0.113.44",
      rule: "cloudflare-verified-header",
      sourceHeader: "true-client-ip",
      cloudflareVerified: true,
    });
  });

  it("7. /api/debug/client-ip enforces reviewer-only access and returns derivedIp, rule, cloudflareVerified, and hopList", async () => {
    process.env.CLIENT_IP_TRUSTED_PROXY_HOPS = "1";

    // Freelancer role is denied with HTTP 403
    const deniedReq = new NextRequest("http://localhost:3000/api/debug/client-ip", {
      headers: {
        "x-proofpay-role": "freelancer",
        "x-forwarded-for": "198.51.100.12, 216.24.57.4",
      },
    });
    const deniedRes = await getDebugClientIp(deniedReq);
    expect(deniedRes.status).toBe(403);

    // Reviewer role receives full diagnostic payload
    const reviewerReq = new NextRequest("http://localhost:3000/api/debug/client-ip", {
      headers: {
        "x-proofpay-role": "reviewer",
        "x-forwarded-for": "1.1.1.1, 198.51.100.12, 216.24.57.4, 10.0.0.8",
      },
    });
    const okRes = await getDebugClientIp(reviewerReq);
    expect(okRes.status).toBe(200);
    const body = await okRes.json();
    expect(body).toMatchObject({
      success: true,
      derivedIp: "198.51.100.12",
      clientIp: "198.51.100.12",
      rule: "xff-trusted-proxy-hops",
      cloudflareVerified: false,
      hopList: ["1.1.1.1", "198.51.100.12", "216.24.57.4", "10.0.0.8"],
      trustedProxyHops: 1,
    });
  });

  it("8. enforces isolated per-IP rate limits across distinct public clients", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.24.0.1")).toBe(true);
    expect(isPrivateIp("198.51.100.1")).toBe(false);

    for (let i = 0; i < 10; i++) {
      expect(checkDemoRateLimits("198.51.100.1").allowed).toBe(true);
    }
    expect(checkDemoRateLimits("198.51.100.1").allowed).toBe(false);
    // Second distinct network IP is still allowed
    expect(checkDemoRateLimits("203.0.113.2").allowed).toBe(true);
  });
});

