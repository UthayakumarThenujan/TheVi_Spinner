/**
 * In-memory sliding-window rate limiter (per server instance).
 * For multi-instance deployments replace with Redis or an edge rate limiter.
 */
type Bucket = { hits: number[] };
type G = typeof globalThis & { __tvsRate?: Map<string, Bucket> };
const g = globalThis as G;
const buckets: Map<string, Bucket> = g.__tvsRate ?? (g.__tvsRate = new Map());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - b.hits[0])) / 1000) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  if (buckets.size > 20_000) {
    // crude cleanup to bound memory
    for (const [k, v] of buckets) if (!v.hits.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
