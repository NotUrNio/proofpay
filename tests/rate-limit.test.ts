import { describe, it, expect, beforeEach } from "vitest";
import {
  getClientIp,
  getClientIpDetails,
  isPrivateIp,
  isCloudflareIp,
  checkDemoRateLimits,
  resetRateLimits,
} from "../src/lib/rate-limit";

function makeReq(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/jobs", { headers });
}

describe("Client IP Extraction & Spoofing Resistance (tests/rate-limit.test.ts)", () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.TRUST_CLOUDFLARE_PROXY;
  });

  it("1. resists spoofed X-Forwarded-For prefix by selecting rightmost public hop appended by edge", () => {
    // Attacker sends "X-Forwarded-For: 1.1.1.1, 8.8.8.8"; edge appends real client "198.51.100.42"
    const req = makeReq({
      "x-forwarded-for": "1.1.1.1, 8.8.8.8, 198.51.100.42",
    });
    const details = getClientIpDetails(req);
    expect(details.ip).toBe("198.51.100.42");
    expect(details.sourceHeader).toBe("x-forwarded-for");
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
    expect(details.sourceHeader).toBe("x-forwarded-for");
    expect(details.isPrivate).toBe(false);
  });

  it("3. returns the public proxy address when a public proxy is the last entry (never trusts hops to its left)", () => {
    // Client "198.51.100.10" connects via untrusted public proxy "203.0.113.88" (or followed by internal hop "10.0.1.9")
    const reqDirectLast = makeReq({
      "x-forwarded-for": "198.51.100.10, 203.0.113.88",
    });
    expect(getClientIp(reqDirectLast)).toBe("203.0.113.88");

    const reqWithInternalMesh = makeReq({
      "x-forwarded-for": "198.51.100.10, 203.0.113.88, 10.0.1.9",
    });
    expect(getClientIp(reqWithInternalMesh)).toBe("203.0.113.88");
  });

  it("4. ignores spoofed cf-connecting-ip and true-client-ip when request did NOT come through Cloudflare", () => {
    // Case A: Attacker sends cf-connecting-ip without cf-ray
    const spoofNoRay = makeReq({
      "cf-connecting-ip": "9.9.9.9",
      "x-forwarded-for": "198.51.100.77, 10.0.0.4",
    });
    expect(getClientIpDetails(spoofNoRay)).toMatchObject({
      ip: "198.51.100.77",
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
      sourceHeader: "x-forwarded-for",
      cloudflareVerified: false,
    });
  });

  it("5. trusts cf-connecting-ip / true-client-ip ONLY when request genuinely traversed Cloudflare", () => {
    // Case A: Valid cf-ray + rightmost public XFF hop is in Cloudflare CIDR (e.g., 172.68.10.22 in 172.64.0.0/13)
    expect(isCloudflareIp("172.68.10.22")).toBe(true);
    expect(isCloudflareIp("198.51.100.77")).toBe(false);

    const validCfViaProxy = makeReq({
      "cf-ray": "8d4f1a2b3c4d5e6f-SJC",
      "cf-connecting-ip": "198.51.100.55",
      "x-forwarded-for": "198.51.100.55, 172.68.10.22, 10.0.1.3",
    });
    expect(getClientIpDetails(validCfViaProxy)).toMatchObject({
      ip: "198.51.100.55",
      sourceHeader: "cf-connecting-ip",
      cloudflareVerified: true,
    });

    // Case B: Valid cf-ray + true-client-ip via Cloudflare edge CIDR (104.16.12.34 in 104.16.0.0/13)
    const validTrueClientIp = makeReq({
      "cf-ray": "8d4f1a2b3c4d5e6f-LAX",
      "true-client-ip": "203.0.113.44",
      "x-forwarded-for": "203.0.113.44, 104.16.12.34, 10.0.1.3",
    });
    expect(getClientIpDetails(validTrueClientIp)).toMatchObject({
      ip: "203.0.113.44",
      sourceHeader: "true-client-ip",
      cloudflareVerified: true,
    });
  });

  it("6. enforces isolated per-IP rate limits across distinct public clients", () => {
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
