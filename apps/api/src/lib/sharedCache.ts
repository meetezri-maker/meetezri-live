import Redis from 'ioredis';

import { performance } from 'perf_hooks';
import { recordTiming } from './perfTiming';
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'meetezri:';

let redis: Redis | null = null;

const SAFE_REDIS_STATUSES = new Set([
  'wait',
  'connecting',
  'connect',
  'ready',
  'reconnecting',
  'close',
  'end',
]);

const SAFE_REDIS_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
]);

function safeRedisStatus(status: string | undefined): string {
  return status && SAFE_REDIS_STATUSES.has(status) ? status : 'unknown';
}

function safeRedisErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && SAFE_REDIS_ERROR_CODES.has(code) ? code : null;
}

function classifyRedisError(error: unknown): string {
  const code = safeRedisErrorCode(error);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return code.toLowerCase();
  if (code === 'ECONNREFUSED') return 'connection_refused';
  if (code === 'ECONNRESET') return 'connection_reset';
  if (code === 'ETIMEDOUT') return 'timeout';
  if (code === 'EPIPE') return 'socket_closed';

  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'MaxRetriesPerRequestError') return 'max_retries';
  if (name === 'ReplyError') return 'protocol';

  return 'unknown';
}

function recordRedisStatus(metric: string, status: string | undefined): void {
  recordTiming(metric, 0, safeRedisStatus(status));
}

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
  if (!r) {
    recordTiming("redis.get", 0, "unavailable");
    return null;
  }
  recordRedisStatus("redis.statusBefore", r.status);
  let getStart = 0;
  try {
    if (r.status === "wait") {
      const connectStart = performance.now();
      try {
        await r.connect();
        recordTiming("redis.connect", performance.now() - connectStart, "succeeded");
      } catch (error) {
        recordTiming("redis.connect", performance.now() - connectStart, classifyRedisError(error));
      }
      recordRedisStatus("redis.statusAfterConnect", r.status);
    } else {
      recordTiming("redis.connect", 0, safeRedisStatus(r.status));
    }
    getStart = performance.now();
    const raw = await r.get(k(key));
    recordTiming("redis.get", performance.now() - getStart, raw ? "hit" : "miss");
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    recordTiming("redis.get", getStart ? performance.now() - getStart : 0, classifyRedisError(error));
    recordRedisStatus("redis.statusAfterError", r.status);
    return null;
  }
}
export async function sharedSetJson(
  key: string,
  value: unknown,
  ttlMs: number
): Promise<void> {
  const r = getRedis();
  if (!r) { recordTiming("redis.set", 0, "unavailable"); return; }
  try {
    if (r.status === 'wait') await r.connect().catch(() => {});
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    const setStart = performance.now();
    await r.set(k(key), JSON.stringify(value), 'EX', ttlSeconds);
    recordTiming("redis.set", performance.now() - setStart, "ok");
  } catch {
    // ignore
    recordTiming("redis.set", 0, "error");
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

