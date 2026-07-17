type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const REGISTER_RATE_LIMIT = 20;
export const SYNC_RATE_LIMIT = 60;
export const LOGIN_FAILED_RATE_LIMIT = 10;
export const FORGOT_PASSWORD_RATE_LIMIT = 5;
export const RESET_PASSWORD_RATE_LIMIT = 10;
export const CHANGE_PASSWORD_RATE_LIMIT = 10;

export type RateLimitResult = {
  isAllowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function pruneExpiredBuckets(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

/**
 * Fixed-window counter. Increments on every call (use for register/sync).
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      isAllowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      isAllowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  existing.count += 1;
  return {
    isAllowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    ),
  };
}

/** True when the key is already at/over the limit (no increment). */
export function isRateLimitExceeded(
  key: string,
  limit: number,
): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) return false;
  return existing.count >= limit;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
