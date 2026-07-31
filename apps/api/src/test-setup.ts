/**
 * Jest per-suite setup (wired via `setupFilesAfterEnv`).
 *
 * Closes the lazily-created shared Redis connection after every suite.
 *
 * `lib/sharedCache.ts` opens a process-wide ioredis client on the first cache operation, and
 * `REDIS_URL` is set in the API environment — so any suite that touches a cache-invalidating path
 * (`invalidateUserProfileCache` -> `sharedDel`, and similar) opened a real socket with reconnect
 * timers that nothing tore down. That is what made Jest report "did not exit one second after the
 * test run has completed" and forced workers to be killed.
 *
 * This runs inside each worker, which is the only place that can close the client that worker
 * created — a `globalTeardown` runs in a separate process and would not see it.
 *
 * Production behaviour is untouched: nothing in the running API calls `closeSharedCache`.
 */

import { closeSharedCache } from './lib/sharedCache';

afterAll(async () => {
  await closeSharedCache();
  await disconnectPrismaIfConnected();
});

/**
 * Disconnect the Prisma client, but only if a suite actually created one.
 *
 * Deliberately reached through `globalThis` rather than `import prisma from './lib/prisma'`:
 * that module instantiates `new PrismaClient()` at import time, so importing it here would open a
 * real connection pool in every suite — including the pure ones that never touch a database, and
 * the many suites that mock `lib/prisma` entirely. That would create the very leak this is
 * cleaning up.
 *
 * `lib/prisma.ts` assigns its singleton to `global.prisma` whenever `NODE_ENV !== 'production'`,
 * which is exactly the test case, so this finds the real client when one exists and no-ops when
 * it does not.
 */
async function disconnectPrismaIfConnected(): Promise<void> {
  const client = (globalThis as { prisma?: { $disconnect?: () => Promise<void> } }).prisma;
  if (!client || typeof client.$disconnect !== 'function') return;
  try {
    await client.$disconnect();
  } catch {
    // Teardown must never fail the suite it is cleaning up after.
  }
}
