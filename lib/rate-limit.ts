type Bucket = number[];

const buckets = new Map<string, Bucket>();

export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Sliding window. Returns false when the caller is over the limit.
 * Cache hits should not call this — they don't spend RentCast quota.
 */
export function takeToken(
  scope: string,
  id: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const key = `${scope}:${id}`;
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "local";
}

export const RATE_LIMITS = {
  property: { limit: 6, windowMs: 60 * 60 * 1000 },
  rent: { limit: 12, windowMs: 60 * 60 * 1000 },
  lead: { limit: 8, windowMs: 60 * 60 * 1000 },
  verifySendIp: { limit: 5, windowMs: 60 * 60 * 1000 },
  verifySendPhone: { limit: 3, windowMs: 60 * 60 * 1000 },
  verifyCheckIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  verifyCheckPhone: { limit: 6, windowMs: 60 * 60 * 1000 },
  str: { limit: 8, windowMs: 60 * 60 * 1000 },
  appointment: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;
