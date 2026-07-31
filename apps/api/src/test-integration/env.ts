/**
 * Integration-test environment loading.
 *
 * THE ORDER HERE IS THE SAFETY PROPERTY:
 *
 *   1. load `apps/api/.env.test`  (explicit path — never the ambient `.env`)
 *   2. require TEST_DATABASE_URL and TEST_DIRECT_URL
 *   3. validate both with `assertSafeTestDatabaseUrl()`
 *   4. only then may Prisma, migrations, raw SQL, or factories initialise
 *
 * WHY `.env.test` AND NOT `.env`: `apps/api/.env` contains the production Supabase URL. Loading it
 * — even accidentally, even as a fallback — is the one failure mode that matters here, so this
 * module never calls bare `dotenv.config()` and never reads `DATABASE_URL`.
 *
 * `dotenv` does not overwrite variables that are already set, so an explicitly exported
 * TEST_DATABASE_URL (CI, or a one-off shell) still wins over the file.
 *
 * Unit tests never import this module; only the integration project's global setup and per-suite
 * setup do.
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { assertSafeTestDatabaseUrl, type SafeDatabaseInfo } from './safe-database';

/** `apps/api/.env.test`, resolved from this file rather than from the process cwd. */
export const ENV_TEST_PATH = resolve(__dirname, '../../.env.test');
export const ENV_TEST_EXAMPLE_PATH = resolve(__dirname, '../../.env.test.example');

const SETUP_INSTRUCTIONS = `
Integration tests need their own database configuration.

  1. cp apps/api/.env.test.example apps/api/.env.test
  2. pnpm --filter @meetezri/api test:integration:up
  3. pnpm --filter @meetezri/api test:integration

Required variables: TEST_DATABASE_URL and TEST_DIRECT_URL.
They must point at the disposable local database (meetezri_test on localhost:5433).
DATABASE_URL is deliberately NOT used as a fallback — it points at production.
`.trim();

export class IntegrationEnvError extends Error {
  constructor(message: string) {
    super(`${message}\n\n${SETUP_INSTRUCTIONS}`);
    this.name = 'IntegrationEnvError';
  }
}

export interface IntegrationEnv {
  /** Runtime connection for Prisma. */
  databaseUrl: string;
  /** Direct connection for `prisma migrate deploy`. */
  directUrl: string;
  info: SafeDatabaseInfo;
  directInfo: SafeDatabaseInfo;
  /** True when values came from `.env.test`; false when they were already exported. */
  loadedFromFile: boolean;
}

/**
 * Load and validate the integration environment.
 *
 * Idempotent: safe to call from both `globalSetup` and per-suite setup.
 */
export function loadIntegrationEnv(): IntegrationEnv {
  let loadedFromFile = false;

  if (existsSync(ENV_TEST_PATH)) {
    // Explicit path, and `override` left off so exported variables keep precedence.
    dotenv.config({ path: ENV_TEST_PATH });
    loadedFromFile = true;
  }

  const databaseUrl = process.env.TEST_DATABASE_URL;
  const directUrl = process.env.TEST_DIRECT_URL;

  const missing: string[] = [];
  if (!databaseUrl || !databaseUrl.trim()) missing.push('TEST_DATABASE_URL');
  if (!directUrl || !directUrl.trim()) missing.push('TEST_DIRECT_URL');

  if (missing.length > 0) {
    const where = existsSync(ENV_TEST_PATH)
      ? `apps/api/.env.test exists but does not define: ${missing.join(', ')}.`
      : `apps/api/.env.test was not found (looked in ${ENV_TEST_PATH}). Missing: ${missing.join(', ')}.`;
    throw new IntegrationEnvError(where);
  }

  // Step 3: both URLs validated before anything is allowed to connect.
  const info = assertSafeTestDatabaseUrl(databaseUrl, 'TEST_DATABASE_URL');
  const directInfo = assertSafeTestDatabaseUrl(directUrl, 'TEST_DIRECT_URL');

  return {
    databaseUrl: databaseUrl as string,
    directUrl: directUrl as string,
    info,
    directInfo,
    loadedFromFile,
  };
}

/**
 * Point Prisma at the validated test database.
 *
 * Must run before anything imports `lib/prisma`, which reads `DATABASE_URL` when it constructs
 * the client. Overwriting both variables in-process is also what stops the Prisma CLI from
 * resolving the production URL out of `apps/api/.env`: dotenv never overrides an already-set
 * variable, so these win.
 */
export function applyIntegrationDatabaseEnv(env: IntegrationEnv): void {
  process.env.DATABASE_URL = env.databaseUrl;
  process.env.DIRECT_URL = env.directUrl;
  // Integration tests must never reach a cache server; `sharedCache` no-ops without this.
  delete process.env.REDIS_URL;
}
