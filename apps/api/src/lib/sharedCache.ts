import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'meetezri:';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!REDIS_URL) return null;
  if (redis) return redis;

  // Lazily init. If Redis is unreachable, we fall back to in-memory caches.
  redis = new Redis(REDIS_URL, {
    // Keep this conservative; API should never hang waiting on cache.
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectTimeout: 600,
    lazyConnect: true,
  });

  redis.on('error', () => {
    // Swallow errors; cache is best-effort.
  });

  return redis;
}

function k(key: string) {
  return `${REDIS_PREFIX}${key}`;
}

export async function sharedGetJson<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    if (r.status === 'wait') await r.connect().catch(() => {});
    const raw = await r.get(k(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function sharedSetJson(
  key: string,
  value: unknown,
  ttlMs: number
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    if (r.status === 'wait') await r.connect().catch(() => {});
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await r.set(k(key), JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // ignore
  }
}

/**
 * Close the shared Redis connection and reset the singleton.
 *
 * WHY THIS EXISTS: `getRedis()` lazily creates a process-wide ioredis client on the first cache
 * operation. In production that long-lived connection is exactly what we want and nothing calls
 * this. Under Jest it is what kept the event loop alive after the tests finished — any suite
 * touching a cache-invalidating path (e.g. `invalidateUserProfileCache` -> `sharedDel`) opened a
 * socket with reconnect timers that nothing ever tore down, so `jest` reported "did not exit one
 * second after the test run has completed" and workers had to be force-exited.
 *
 * Called from `src/test-setup.ts` after each suite. Also safe to call from a graceful-shutdown
 * handler if one is ever added.
 *
 * Never throws: a cache client that cannot be closed cleanly is disconnected instead, because
 * failing teardown would be worse than the leak it fixes.
 */
export async function closeSharedCache(): Promise<void> {
  const client = redis;
  redis = null;
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch {
      // ignore
    }
  }
}

export async function sharedDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    if (r.status === 'wait') await r.connect().catch(() => {});
    await r.del(k(key));
  } catch {
    // ignore
  }
}

