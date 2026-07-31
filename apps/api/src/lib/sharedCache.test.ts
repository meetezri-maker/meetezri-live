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

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const instance = { quit, disconnect, on, connect, del, get, set, status: 'ready' };
    redisInstances.push(instance);
    return instance;
  });
});

const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

beforeAll(() => {
  // The leak only exists when a Redis URL is configured — which it is in this API's environment.
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
});

afterAll(() => {
  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
});

beforeEach(() => {
  jest.clearAllMocks();
  redisInstances.length = 0;
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
