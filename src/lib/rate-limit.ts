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

export interface ClientIpDetails {
  ip: string;
  sourceHeader: "cf-connecting-ip" | "x-forwarded-for" | "x-real-ip" | "fallback";
  rawHeaderValue?: string;
  isPrivate: boolean;
}

/**
 * Extracts trusted connecting client IP behind Render's reverse proxy with full audit metadata.
 * Prevents IP spoofing: walks right-to-left skipping Render's internal proxy hops,
 * returning the rightmost public client IP appended by Render's trusted edge.
 */
export function getClientIpDetails(req: Request | NextRequest): ClientIpDetails {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) {
    const trimmed = cfIp.trim();
    return {
      ip: trimmed,
      sourceHeader: "cf-connecting-ip",
      rawHeaderValue: cfIp,
      isPrivate: isPrivateIp(trimmed),
    };
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length > 0) {
      // Walk right-to-left: skip any internal proxy IPs appended by Render's internal routing mesh
      for (let i = parts.length - 1; i >= 0; i--) {
        const candidate = parts[i];
        if (!isPrivateIp(candidate)) {
          return {
            ip: candidate,
            sourceHeader: "x-forwarded-for",
            rawHeaderValue: forwardedFor,
            isPrivate: false,
          };
        }
      }

      // If all are internal/private (local dev, test VPC), return rightmost hop
      const rightmost = parts[parts.length - 1];
      return {
        ip: rightmost,
        sourceHeader: "x-forwarded-for",
        rawHeaderValue: forwardedFor,
        isPrivate: isPrivateIp(rightmost),
      };
    }
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    return {
      ip: trimmed,
      sourceHeader: "x-real-ip",
      rawHeaderValue: realIp,
      isPrivate: isPrivateIp(trimmed),
    };
  }

  return {
    ip: "127.0.0.1",
    sourceHeader: "fallback",
    isPrivate: true,
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
