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

