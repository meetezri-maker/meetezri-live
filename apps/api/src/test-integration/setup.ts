/**
 * Per-suite setup for the integration project.
 *
 * Runs in the worker that actually issues the writes, so it repeats the load-then-validate
 * sequence rather than trusting `globalSetup` (which runs in a different process):
 *
 *   1. load `apps/api/.env.test` explicitly
 *   2. require TEST_DATABASE_URL and TEST_DIRECT_URL
 *   3. validate both with `assertSafeTestDatabaseUrl()`
 *   4. only then point Prisma at the database
 *
 * Step 4 must happen before any test module imports `lib/prisma`, which reads `DATABASE_URL` when
 * it constructs the client — hence the module-level execution below rather than a `beforeAll`.
 *
 * Teardown is explicit (Prisma + Redis) rather than `--forceExit`: a run that needs forcing has
 * not demonstrated it cleaned up after itself.
 */

import { applyIntegrationDatabaseEnv, loadIntegrationEnv } from './env';

const env = loadIntegrationEnv();
applyIntegrationDatabaseEnv(env);

afterAll(async () => {
  const { closeSharedCache } = await import('../lib/sharedCache');
  await closeSharedCache();

  const client = (globalThis as { prisma?: { $disconnect?: () => Promise<void> } }).prisma;
  if (client && typeof client.$disconnect === 'function') {
    await client.$disconnect();
  }
});
