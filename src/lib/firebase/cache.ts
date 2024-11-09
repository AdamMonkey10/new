import type { Item, Location, Movement } from '@/types/warehouse';
import type { WarehouseAction } from './actions';

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  ttl: number;
}

interface Cache {
  items: CacheEntry<Item>;
  locations: CacheEntry<Location>;
  movements: CacheEntry<Movement>;
  actions: CacheEntry<WarehouseAction>;
}

const DEFAULT_TTL = 30 * 1000; // 30 seconds
let cache: Cache = {
  items: { data: [], timestamp: 0, ttl: DEFAULT_TTL },
  locations: { data: [], timestamp: 0, ttl: DEFAULT_TTL },
  movements: { data: [], timestamp: 0, ttl: DEFAULT_TTL },
  actions: { data: [], timestamp: 0, ttl: DEFAULT_TTL },
};

export function getCached<T>(key: keyof Cache): T[] | null {
  const entry = cache[key];
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    return null;
  }

  return entry.data as T[];
}

export function setCache<T extends Item | Location | Movement | WarehouseAction>(
  key: keyof Cache,
  data: T[],
  ttl = DEFAULT_TTL
) {
  cache[key] = {
    data,
    timestamp: Date.now(),
    ttl,
  } as Cache[keyof Cache];
}

export function invalidateCache(key?: keyof Cache) {
  if (key) {
    cache[key].data = [];
    cache[key].timestamp = 0;
  } else {
    Object.keys(cache).forEach((k) => {
      const cacheKey = k as keyof Cache;
      cache[cacheKey].data = [];
      cache[cacheKey].timestamp = 0;
    });
  }
}