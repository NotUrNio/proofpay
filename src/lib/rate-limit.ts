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
 * Checks both per-IP (10/min) and global daily (100/day) limits on costly AI demo endpoints.
 */
export function checkDemoRateLimits(clientIp: string): {
  allowed: boolean;
  ipLimit: RateLimitResult;
  globalDailyLimit: RateLimitResult;
  reason?: string;
} {
  const ipLimit = checkRateLimit(`demo_ip_${clientIp}`, 10, 60 * 1000); // 10 per min
  const globalDailyLimit = checkRateLimit("demo_global_daily", 100, 24 * 60 * 60 * 1000); // 100 per day

  if (!ipLimit.allowed) {
    return {
      allowed: false,
      ipLimit,
      globalDailyLimit,
      reason: "Per-IP rate limit reached (10 requests / min). Please wait 60 seconds.",
    };
  }

  if (!globalDailyLimit.allowed) {
    return {
      allowed: false,
      ipLimit,
      globalDailyLimit,
      reason: "Global daily demo quota reached (100 runs / day). Quota resets every 24 hours.",
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
