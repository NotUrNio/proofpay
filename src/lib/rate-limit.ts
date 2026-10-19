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

export interface ClientIpDetails {
  ip: string;
  sourceHeader:
    | "cf-connecting-ip"
    | "true-client-ip"
    | "x-forwarded-for"
    | "x-real-ip"
    | "fallback";
  rawHeaderValue?: string;
  isPrivate: boolean;
  cloudflareVerified: boolean;
}

/**
 * Decides whether a request genuinely traversed Cloudflare before trusting
 * `cf-connecting-ip` or `true-client-ip`:
 * 1. A valid `cf-ray` header (`<16-hex>-<3-letter-IATA>`) must be present.
 * 2. If `x-forwarded-for` is present, its rightmost non-private hop must either:
 *    - belong to a published Cloudflare edge CIDR (`isCloudflareIp`), OR
 *    - match the `cf-connecting-ip` / `true-client-ip` value (Render's Cloudflare edge
 *      sets both `cf-connecting-ip` and appends the client IP to `x-forwarded-for`).
 *    If the rightmost public hop in `x-forwarded-for` is a non-Cloudflare IP that differs
 *    from `cf-connecting-ip`, then `cf-connecting-ip` was spoofed by the client and is ignored.
 * 3. If `x-forwarded-for` is absent, `cf-connecting-ip` / `true-client-ip` is only trusted
 *    when `TRUST_CLOUDFLARE_PROXY=true` and `cf-ray` is valid.
 */
export function getClientIpDetails(req: Request | NextRequest): ClientIpDetails {
  const cfRay = (req.headers.get("cf-ray") || "").trim();
  const hasValidCfRay = /^[0-9a-f]{16}-[a-z]{3}$/i.test(cfRay);
  const cfConnectingIp = (req.headers.get("cf-connecting-ip") || "").trim();
  const trueClientIp = (req.headers.get("true-client-ip") || "").trim();
  const forwardedFor = req.headers.get("x-forwarded-for");

  const xffParts = forwardedFor
    ? forwardedFor
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Find the rightmost non-private hop in X-Forwarded-For (skipping internal RFC 1918 proxy hops)
  let rightmostPublicXff: string | null = null;
  for (let i = xffParts.length - 1; i >= 0; i--) {
    if (!isPrivateIp(xffParts[i])) {
      rightmostPublicXff = xffParts[i];
      break;
    }
  }

  const candidateCfHeader: "cf-connecting-ip" | "true-client-ip" | null = cfConnectingIp
    ? "cf-connecting-ip"
    : trueClientIp
      ? "true-client-ip"
      : null;
  const candidateCfIp = cfConnectingIp || trueClientIp;

  if (candidateCfHeader && candidateCfIp && hasValidCfRay) {
    const verifiedViaXff =
      rightmostPublicXff !== null &&
      (isCloudflareIp(rightmostPublicXff) || rightmostPublicXff === candidateCfIp);
    const verifiedWithoutXff =
      xffParts.length === 0 && process.env.TRUST_CLOUDFLARE_PROXY === "true";

    if (verifiedViaXff || verifiedWithoutXff) {
      return {
        ip: candidateCfIp,
        sourceHeader: candidateCfHeader,
        rawHeaderValue: candidateCfIp,
        isPrivate: isPrivateIp(candidateCfIp),
        cloudflareVerified: true,
      };
    }
  }

  if (xffParts.length > 0) {
    // Walk right-to-left: skip internal RFC 1918 proxy IPs appended by Render's internal mesh.
    // Note: if the last public entry is a public proxy (non-private), we stop at that last public entry
    // and never trust hops to its left because an untrusted public proxy can forge prior XFF entries.
    if (rightmostPublicXff) {
      return {
        ip: rightmostPublicXff,
        sourceHeader: "x-forwarded-for",
        rawHeaderValue: forwardedFor || undefined,
        isPrivate: false,
        cloudflareVerified: false,
      };
    }

    // If all hops are internal/private (local dev or internal VPC), return rightmost hop
    const rightmost = xffParts[xffParts.length - 1];
    return {
      ip: rightmost,
      sourceHeader: "x-forwarded-for",
      rawHeaderValue: forwardedFor || undefined,
      isPrivate: isPrivateIp(rightmost),
      cloudflareVerified: false,
    };
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    return {
      ip: trimmed,
      sourceHeader: "x-real-ip",
      rawHeaderValue: realIp,
      isPrivate: isPrivateIp(trimmed),
      cloudflareVerified: false,
    };
  }

  return {
    ip: "127.0.0.1",
    sourceHeader: "fallback",
    isPrivate: true,
    cloudflareVerified: false,
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
