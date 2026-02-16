const DEFAULT_TTL_MS = 30_000;

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

/**
 * Simple in-memory cache with TTL for graph endpoints.
 * Single-process, no Redis needed. Repeated queries return in <5ms.
 */
export class GraphCache {
  private store = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttl = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set(key: string, data: unknown): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttl });
  }

  /** Bust all graph-related cache entries (call after any concept/edge write). */
  invalidate(): void {
    this.store.clear();
  }
}
