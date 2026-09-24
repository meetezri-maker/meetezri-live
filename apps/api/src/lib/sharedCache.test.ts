/**
 * PHASE 2B — shared cache connection lifecycle.
 *
 * Pins the fix for the Jest open-handle leak: `getRedis()` lazily creates a process-wide ioredis
 * client, and nothing ever closed it, so any suite touching a cache-invalidating path left an
 * open socket and Jest could not exit.
 */

const quit = jest.fn().mockResolvedValue('OK');
const disconnect = jest.fn();
const on = jest.fn();
const connect = jest.fn().mockResolvedValue(undefined);
const del = jest.fn().mockResolvedValue(1);
const get = jest.fn().mockResolvedValue(null);
const set = jest.fn().mockResolvedValue('OK');

const redisInstances: any[] = [];
let mockRedisStatus = 'ready';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const instance = { quit, disconnect, on, connect, del, get, set, status: mockRedisStatus };
    redisInstances.push(instance);
    return instance;
  });
});

const ORIGINAL_REDIS_URL = process.env.REDIS_URL;
const ORIGINAL_DEBUG_API_TIMING = process.env.DEBUG_API_TIMING;

beforeAll(() => {
  // The leak only exists when a Redis URL is configured — which it is in this API's environment.
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
});

afterAll(() => {
  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
  if (ORIGINAL_DEBUG_API_TIMING === undefined) delete process.env.DEBUG_API_TIMING;
  else process.env.DEBUG_API_TIMING = ORIGINAL_DEBUG_API_TIMING;
});

beforeEach(() => {
  jest.clearAllMocks();
  redisInstances.length = 0;
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  delete process.env.DEBUG_API_TIMING;
  mockRedisStatus = 'ready';
  get.mockResolvedValue(null);
  set.mockResolvedValue('OK');
  del.mockResolvedValue(1);
  connect.mockResolvedValue(undefined);
  jest.resetModules();
});

/** Fresh module registry each time, so the lazily-created singleton starts unset. */
function loadSharedCache() {
  // eslint-disable-next-line
  return require('./sharedCache') as typeof import('./sharedCache');
}

describe('shared cache client lifecycle', () => {
  it('creates no client until a cache operation happens', async () => {
    loadSharedCache();
    expect(redisInstances).toHaveLength(0);
  });

  it('creates the client lazily on first use', async () => {
    const cache = loadSharedCache();
    await cache.sharedDel('users:credits:abc');

    // This is the handle that used to outlive the test run.
    expect(redisInstances).toHaveLength(1);
  });

  it('reuses one client across operations', async () => {
    const cache = loadSharedCache();
    await cache.sharedDel('a');
    await cache.sharedGetJson('b');
    await cache.sharedSetJson('c', { v: 1 }, 1000);

    expect(redisInstances).toHaveLength(1);
  });

  it('closeSharedCache quits the client', async () => {
    const cache = loadSharedCache();
    await cache.sharedDel('a');

    await cache.closeSharedCache();

    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('closeSharedCache resets the singleton so a later call builds a fresh client', async () => {
    const cache = loadSharedCache();
    await cache.sharedDel('a');
    await cache.closeSharedCache();

    await cache.sharedDel('b');

    // A new client, not the closed one — teardown must not poison later use within a worker.
    expect(redisInstances).toHaveLength(2);
  });

  it('is a no-op when no client was ever created', async () => {
    const cache = loadSharedCache();

    await expect(cache.closeSharedCache()).resolves.toBeUndefined();
    expect(quit).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('is safe to call twice', async () => {
    const cache = loadSharedCache();
    await cache.sharedDel('a');

    await cache.closeSharedCache();
    await expect(cache.closeSharedCache()).resolves.toBeUndefined();

    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('falls back to disconnect when quit fails, and never throws', async () => {
    quit.mockRejectedValueOnce(new Error('connection already gone'));
    const cache = loadSharedCache();
    await cache.sharedDel('a');

    // A failing teardown must not fail the suite it is cleaning up after.
    await expect(cache.closeSharedCache()).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('creates no client at all when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const cache = loadSharedCache();

    await cache.sharedDel('a');
    await cache.closeSharedCache();

    expect(redisInstances).toHaveLength(0);
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });
});


describe('shared cache Redis diagnostics', () => {
  async function captureTiming(
    operation: (cache: ReturnType<typeof loadSharedCache>) => Promise<unknown>
  ) {
    process.env.DEBUG_API_TIMING = '1';
    const cache = loadSharedCache();
    const perf = require('./perfTiming') as typeof import('./perfTiming');
    let header = '';
    await perf.runWithRequestTiming(async () => {
      await operation(cache);
      header = perf.buildServerTimingHeader(1);
    });
    return header;
  }

  it('keeps diagnostics dormant when DEBUG_API_TIMING is disabled', async () => {
    const cache = loadSharedCache();

    await cache.sharedGetJson('users:credits:user-secret');
    const perf = require('./perfTiming') as typeof import('./perfTiming');

    expect(perf.buildServerTimingHeader(1)).toBe('');
  });

  it('classifies unavailable Redis without creating a client', async () => {
    process.env.DEBUG_API_TIMING = '1';
    delete process.env.REDIS_URL;
    const cache = loadSharedCache();
    const perf = require('./perfTiming') as typeof import('./perfTiming');

    let header = '';
    await perf.runWithRequestTiming(async () => {
      await cache.sharedGetJson('users:credits:user-secret');
      header = perf.buildServerTimingHeader(1);
    });

    expect(redisInstances).toHaveLength(0);
    expect(header).toContain('redis.get;dur=0;desc="unavailable"');
    expect(header).not.toContain('user-secret');
  });

  it('preserves Redis miss diagnostics without exposing the key', async () => {
    const header = await captureTiming(async (cache: ReturnType<typeof loadSharedCache>) => {
      await cache.sharedGetJson('users:activity:user-secret:10');
    });

    expect(header).toContain('redis.statusBefore;dur=0;desc="ready"');
    expect(header).toContain('redis.connect;dur=0;desc="ready"');
    expect(header).toContain('redis.get;dur=');
    expect(header).toContain('desc="miss"');
    expect(header).not.toContain('user-secret');
  });

  it('preserves Redis hit behavior without exposing cached values', async () => {
    get.mockResolvedValueOnce(JSON.stringify({ token: 'cached-value-secret' }));

    let result: unknown;
    const header = await captureTiming(async (cache: ReturnType<typeof loadSharedCache>) => {
      result = await cache.sharedGetJson('users:credits:user-secret');
    });

    expect(result).toEqual({ token: 'cached-value-secret' });
    expect(header).toContain('desc="hit"');
    expect(header).not.toContain('cached-value-secret');
    expect(header).not.toContain('user-secret');
  });

  it('classifies GET failures with elapsed timing and no secret leakage', async () => {
    const err = new Error('redis://user:password@secret-host:6379 leaked message');
    (err as any).code = 'ENOTFOUND';
    get.mockRejectedValueOnce(err);

    const header = await captureTiming(async (cache: ReturnType<typeof loadSharedCache>) => {
      await expect(cache.sharedGetJson('users:credits:user-secret')).resolves.toBeNull();
    });

    expect(header).toContain('redis.get;dur=');
    expect(header).toContain('desc="enotfound"');
    expect(header).toContain('redis.statusAfterError;dur=0;desc="ready"');
    expect(header).not.toContain('secret-host');
    expect(header).not.toContain('password');
    expect(header).not.toContain('leaked message');
    expect(header).not.toContain('user-secret');
    expect(header).not.toContain('stack');
  });

  it('classifies connect failures and preserves fallback', async () => {
    const err = new Error('token and host must not leak');
    (err as any).code = 'ETIMEDOUT';
    connect.mockImplementationOnce(async () => {
      redisInstances[0].status = 'reconnecting';
      throw err;
    });
    get.mockRejectedValueOnce(Object.assign(new Error('still no leak'), { code: 'EPIPE' }));

    let header = '';
    process.env.DEBUG_API_TIMING = '1';
    mockRedisStatus = 'wait';
    const cache = loadSharedCache();
    const perf = require('./perfTiming') as typeof import('./perfTiming');

    await perf.runWithRequestTiming(async () => {
      await cache.sharedGetJson('users:credits:user-secret');
      header = perf.buildServerTimingHeader(1);
    });

    expect(header).toContain('redis.statusBefore;dur=0;desc="wait"');
    expect(header).toContain('redis.connect;dur=');
    expect(header).toContain('desc="timeout"');
    expect(header).toContain('redis.statusAfterConnect;dur=0;desc="reconnecting"');
    expect(header).toContain('redis.get;dur=');
    expect(header).toContain('desc="socket_closed"');
    expect(header).not.toContain('token');
    expect(header).not.toContain('host');
    expect(header).not.toContain('user-secret');
  });

  it('falls back to unknown for unallowlisted errors without leaking details', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('contains redis://secret-host'), { code: 'SOME_VENDOR_CODE' }));

    const header = await captureTiming(async (cache: ReturnType<typeof loadSharedCache>) => {
      await cache.sharedGetJson('users:credits:user-secret');
    });

    expect(header).toContain('desc="unknown"');
    expect(header).not.toContain('SOME_VENDOR_CODE');
    expect(header).not.toContain('secret-host');
    expect(header).not.toContain('user-secret');
  });
});
