import { NextRequest } from "next/server";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  reason?: string;
}

interface RateLimitStore {
  count: number;
  resetAt: number;
}

// In-memory sliding/fixed window store.
// Counters live in-memory per Node process. In multi-instance or serverless,
// this enforces a strict local process ceiling; on Render's single instance, it provides exact global protection.
const memoryStore = new Map<string, RateLimitStore>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: entry.resetAt,
      reason: `Rate limit of ${limit} requests per window exceeded. Try again after ${new Date(entry.resetAt).toISOString()}.`,
    };
  }

  entry.count++;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Helper to identify private/loopback/internal RFC 1918/4193 addresses.
 */
export function isPrivateIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "localhost" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("169.254.") ||
    clean.startsWith("fc00:") ||
    clean.startsWith("fd00:") ||
    clean.startsWith("fe80:")
  ) {
    return true;
  }
  // Check 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Published Cloudflare IPv4 CIDR ranges (https://www.cloudflare.com/ips-v4)
 * and IPv6 prefixes (https://www.cloudflare.com/ips-v6) used to verify whether
 * the immediate upstream public proxy hop is an authentic Cloudflare edge node.
 */
const CLOUDFLARE_IPV4_CIDRS: Array<[number, number]> = [
  [ipv4ToInt("173.245.48.0"), 20],
  [ipv4ToInt("103.21.244.0"), 22],
  [ipv4ToInt("103.22.200.0"), 22],
  [ipv4ToInt("103.31.4.0"), 22],
  [ipv4ToInt("141.101.64.0"), 18],
  [ipv4ToInt("108.162.192.0"), 18],
  [ipv4ToInt("190.93.240.0"), 20],
  [ipv4ToInt("188.114.96.0"), 20],
  [ipv4ToInt("197.234.240.0"), 22],
  [ipv4ToInt("198.41.128.0"), 17],
  [ipv4ToInt("162.158.0.0"), 15],
  [ipv4ToInt("104.16.0.0"), 13],
  [ipv4ToInt("104.24.0.0"), 14],
  [ipv4ToInt("172.64.0.0"), 13],
  [ipv4ToInt("131.0.72.0"), 22],
];

function ipv4ToInt(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return -1;
  let res = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return -1;
    const n = Number(part);
    if (n < 0 || n > 255) return -1;
    res = ((res << 8) | n) >>> 0;
  }
  return res;
}

export function isCloudflareIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (clean.includes(":")) {
    return (
      clean.startsWith("2400:cb00:") ||
      clean.startsWith("2606:4700:") ||
      clean.startsWith("2803:f800:") ||
      clean.startsWith("2405:b500:") ||
      clean.startsWith("2405:8100:") ||
      clean.startsWith("2a06:98c0:") ||
      clean.startsWith("2c0f:f248:")
    );
  }
  const intVal = ipv4ToInt(clean);
  if (intVal < 0) return false;
  for (const [net, prefix] of CLOUDFLARE_IPV4_CIDRS) {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((intVal & mask) >>> 0 === (net & mask) >>> 0) {
      return true;
    }
  }
  return false;
}

export type ClientIpRule =
  | "cloudflare-verified-header"
  | "xff-trusted-proxy-hops"
  | "xff-rightmost-public"
  | "xff-rightmost-private"
  | "x-real-ip"
  | "loopback-fallback";

export interface ClientIpDetails {
  ip: string;
  rule: ClientIpRule;
  sourceHeader:
    | "cf-connecting-ip"
    | "true-client-ip"
    | "x-forwarded-for"
    | "x-real-ip"
    | "fallback";
  rawHeaderValue?: string;
  isPrivate: boolean;
  cloudflareVerified: boolean;
  hopList: string[];
  trustedProxyHops: number;
}

export const DEFAULT_TRUSTED_PROXY_HOPS = 0;
export const MAX_TRUSTED_PROXY_HOPS = 10;

/**
 * Parses and validates CLIENT_IP_TRUSTED_PROXY_HOPS (number of rightmost public
 * X-Forwarded-For entries to skip as trusted proxies, e.g., Render's edge proxy).
 * Documented default: 0. Must be an integer in [0, 10].
 */
export function parseTrustedProxyHops(
  raw: string | undefined = process.env.CLIENT_IP_TRUSTED_PROXY_HOPS
): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new RangeError(
      `Invalid CLIENT_IP_TRUSTED_PROXY_HOPS="${raw}": must be an integer between 0 and ${MAX_TRUSTED_PROXY_HOPS} (default: ${DEFAULT_TRUSTED_PROXY_HOPS}).`
    );
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_TRUSTED_PROXY_HOPS
  ) {
    throw new RangeError(
      `Invalid CLIENT_IP_TRUSTED_PROXY_HOPS="${raw}": must be between 0 and ${MAX_TRUSTED_PROXY_HOPS} (default: ${DEFAULT_TRUSTED_PROXY_HOPS}).`
    );
  }
  return parsed;
}

/**
 * Decides whether a request genuinely traversed Cloudflare before trusting
 * `cf-connecting-ip` or `true-client-ip`, andotherwise extracts the client IP
 * from `x-forwarded-for` while skipping internal RFC 1918 mesh hops and
 * `CLIENT_IP_TRUSTED_PROXY_HOPS` rightmost public proxy hops.
 */
export function getClientIpDetails(req: Request | NextRequest): ClientIpDetails {
  const trustedProxyHops = parseTrustedProxyHops();
  const cfRay = (req.headers.get("cf-ray") || "").trim();
  const hasValidCfRay = /^[0-9a-f]{16}-[a-z]{3}$/i.test(cfRay);
  const cfConnectingIp = (req.headers.get("cf-connecting-ip") || "").trim();
  const trueClientIp = (req.headers.get("true-client-ip") || "").trim();
  const forwardedFor = req.headers.get("x-forwarded-for");

  const hopList = forwardedFor
    ? forwardedFor
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Strip trailing internal RFC 1918 proxy hops appended by internal service meshes
  let lastPublicIdx = hopList.length - 1;
  while (lastPublicIdx >= 0 && isPrivateIp(hopList[lastPublicIdx])) {
    lastPublicIdx--;
  }

  // Rightmost public hop before skipping trustedProxyHops (used to check direct Cloudflare edge hop)
  const rightmostPublicXff = lastPublicIdx >= 0 ? hopList[lastPublicIdx] : null;

  // Apply CLIENT_IP_TRUSTED_PROXY_HOPS: skip N rightmost public proxy entries (clamped to index 0)
  let targetPublicIdx =
    lastPublicIdx >= 0 ? Math.max(0, lastPublicIdx - trustedProxyHops) : -1;
  while (targetPublicIdx > 0 && isPrivateIp(hopList[targetPublicIdx])) {
    targetPublicIdx--;
  }
  const effectivePublicXff =
    targetPublicIdx >= 0 && !isPrivateIp(hopList[targetPublicIdx])
      ? hopList[targetPublicIdx]
      : null;

  const candidateCfHeader: "cf-connecting-ip" | "true-client-ip" | null = cfConnectingIp
    ? "cf-connecting-ip"
    : trueClientIp
      ? "true-client-ip"
      : null;
  const candidateCfIp = cfConnectingIp || trueClientIp;

  if (candidateCfHeader && candidateCfIp && hasValidCfRay) {
    const verifiedViaXff =
      (rightmostPublicXff !== null &&
        (isCloudflareIp(rightmostPublicXff) || rightmostPublicXff === candidateCfIp)) ||
      (effectivePublicXff !== null &&
        (isCloudflareIp(effectivePublicXff) || effectivePublicXff === candidateCfIp));
    const verifiedWithoutXff =
      hopList.length === 0 && process.env.TRUST_CLOUDFLARE_PROXY === "true";

    if (verifiedViaXff || verifiedWithoutXff) {
      return {
        ip: candidateCfIp,
        rule: "cloudflare-verified-header",
        sourceHeader: candidateCfHeader,
        rawHeaderValue: candidateCfIp,
        isPrivate: isPrivateIp(candidateCfIp),
        cloudflareVerified: true,
        hopList,
        trustedProxyHops,
      };
    }
  }

  if (hopList.length > 0) {
    if (effectivePublicXff) {
      const skippedTrustedHops =
        trustedProxyHops > 0 && targetPublicIdx < lastPublicIdx;
      return {
        ip: effectivePublicXff,
        rule: skippedTrustedHops
          ? "xff-trusted-proxy-hops"
          : "xff-rightmost-public",
        sourceHeader: "x-forwarded-for",
        rawHeaderValue: forwardedFor || undefined,
        isPrivate: false,
        cloudflareVerified: false,
        hopList,
        trustedProxyHops,
      };
    }

    // If all hops are internal/private (local dev or internal VPC), return rightmost hop
    const rightmost = hopList[hopList.length - 1];
    return {
      ip: rightmost,
      rule: "xff-rightmost-private",
      sourceHeader: "x-forwarded-for",
      rawHeaderValue: forwardedFor || undefined,
      isPrivate: isPrivateIp(rightmost),
      cloudflareVerified: false,
      hopList,
      trustedProxyHops,
    };
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    return {
      ip: trimmed,
      rule: "x-real-ip",
      sourceHeader: "x-real-ip",
      rawHeaderValue: realIp,
      isPrivate: isPrivateIp(trimmed),
      cloudflareVerified: false,
      hopList,
      trustedProxyHops,
    };
  }

  return {
    ip: "127.0.0.1",
    rule: "loopback-fallback",
    sourceHeader: "fallback",
    isPrivate: true,
    cloudflareVerified: false,
    hopList,
    trustedProxyHops,
  };
}

export function getClientIp(req: Request | NextRequest): string {
  return getClientIpDetails(req).ip;
}

/**
 * Checks both per-IP (10/min) and global daily (env-configurable DEMO_DAILY_CAP, default 100)
 * limits across all routes that spend Gemini model calls or PayPal API requests.
 */
export function checkDemoRateLimits(clientIp: string): {
  allowed: boolean;
  ipLimit: RateLimitResult;
  globalDailyLimit: RateLimitResult;
  reason?: string;
} {
  const dailyCap = parseInt(process.env.DEMO_DAILY_CAP || "100", 10);
  const ipLimit = checkRateLimit(`demo_ip_${clientIp}`, 10, 60 * 1000); // 10 per min
  const globalDailyLimit = checkRateLimit("demo_global_daily", dailyCap, 24 * 60 * 60 * 1000); // 100 per day

  if (!ipLimit.allowed) {
    return {
      allowed: false,
      ipLimit,
      globalDailyLimit,
      reason: "Per-IP rate limit reached (10 requests/min). Please wait 60 seconds before trying again.",
    };
  }

  if (!globalDailyLimit.allowed) {
    const resetDate = new Date(globalDailyLimit.resetAt);
    const resetTimeStr = resetDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    return {
      allowed: false,
      ipLimit,
      globalDailyLimit,
      reason: `Global daily demo quota reached (${dailyCap} runs/day). Daily sandbox quota resets at ${resetTimeStr} (${resetDate.toISOString()}).`,
    };
  }

  return {
    allowed: true,
    ipLimit,
    globalDailyLimit,
  };
}

export function resetRateLimits(): void {
  memoryStore.clear();
}
