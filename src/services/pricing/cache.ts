let cachedPricing: unknown = null;
let cacheTimestamp = 0;

const CACHE_TTL = 5 * 60 * 1000;

export function getPricingCache(now = Date.now()): unknown | null {
  if (!cachedPricing) {
    return null;
  }

  if (now - cacheTimestamp >= CACHE_TTL) {
    return null;
  }

  return cachedPricing;
}

export function setPricingCache(plans: unknown, now = Date.now()): void {
  cachedPricing = plans;
  cacheTimestamp = now;
}

export function clearPricingCache(): void {
  cachedPricing = null;
  cacheTimestamp = 0;
}
