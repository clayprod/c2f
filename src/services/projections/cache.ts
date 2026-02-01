/**
 * Simple in-memory cache for projections
 * In production, consider using Redis or similar
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ProjectionCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  // Increment this version to invalidate all existing caches after code changes
  private readonly CACHE_VERSION = 2; // v2: Fixed double counting of actual amounts

  /**
   * Generate cache key
   */
  private getKey(userId: string, startMonth: string, endMonth: string): string {
    return `projections:v${this.CACHE_VERSION}:${userId}:${startMonth}:${endMonth}`;
  }

  /**
   * Get cached data
   */
  get<T>(userId: string, startMonth: string, endMonth: string): T | null {
    const key = this.getKey(userId, startMonth, endMonth);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache data
   */
  set<T>(userId: string, startMonth: string, endMonth: string, data: T, ttl?: number): void {
    const key = this.getKey(userId, startMonth, endMonth);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });
  }

  /**
   * Invalidate cache for a user
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`projections:${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring)
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const projectionCache = new ProjectionCache();



