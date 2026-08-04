/**
 * PHASE 2C — integration environment loading.
 *
 * A UNIT test (no database required): it guards the loader that decides which database the
 * integration suite is allowed to touch, so it must pass in the normal suite.
 *
 * The four properties under test are exactly the ones that keep production safe:
 *   1. missing variables produce actionable setup guidance
 *   2. there is no fallback to DATABASE_URL
 *   3. an unsafe TEST_* value is rejected before anything connects
 *   4. `.env.test` is read from an explicit path, never the ambient `.env`
 */

import { existsSync } from 'fs';
import {
  ENV_TEST_PATH,
  ENV_TEST_EXAMPLE_PATH,
  IntegrationEnvError,
  applyIntegrationDatabaseEnv,
  loadIntegrationEnv,
} from './env';
import { UnsafeTestDatabaseError } from './safe-database';

const SAFE_URL = 'postgresql://meetezri_test:meetezri_test@localhost:5433/meetezri_test';
const PRODUCTION_URL =
  'postgresql://postgres.oebtxvmldckdezcpfkai:REDACTED@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1';

const SAVED = {
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  TEST_DIRECT_URL: process.env.TEST_DIRECT_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  REDIS_URL: process.env.REDIS_URL,
};

function restore(key: keyof typeof SAVED) {
  const value = SAVED[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  (Object.keys(SAVED) as Array<keyof typeof SAVED>).forEach(restore);
});

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

describe('env file locations', () => {
  it('resolves .env.test relative to apps/api, not the process cwd', () => {
    // A cwd-relative path would silently read a different file depending on where jest was run.
    expect(ENV_TEST_PATH.replace(/\\/g, '/')).toMatch(/apps\/api\/\.env\.test$/);
  });

  it('ships a committed template', () => {
    expect(existsSync(ENV_TEST_EXAMPLE_PATH)).toBe(true);
  });

  it('never points at the production .env', () => {
    expect(ENV_TEST_PATH.replace(/\\/g, '/')).not.toMatch(/apps\/api\/\.env$/);
  });
});

// ---------------------------------------------------------------------------
// Missing variables
// ---------------------------------------------------------------------------

describe('missing variables', () => {
  /**
   * The loader reads `.env.test` when it exists, so these cases neutralise it by setting the
   * variables to empty strings — dotenv will not overwrite an already-set variable, which is the
   * same precedence real exported values get.
   */
  it('fails when TEST_DATABASE_URL is missing', () => {
    process.env.TEST_DATABASE_URL = '';
    process.env.TEST_DIRECT_URL = SAFE_URL;

    expect(() => loadIntegrationEnv()).toThrow(IntegrationEnvError);
    expect(() => loadIntegrationEnv()).toThrow(/TEST_DATABASE_URL/);
  });

  it('fails when TEST_DIRECT_URL is missing', () => {
    process.env.TEST_DATABASE_URL = SAFE_URL;
    process.env.TEST_DIRECT_URL = '';

    expect(() => loadIntegrationEnv()).toThrow(/TEST_DIRECT_URL/);
  });

  it('reports both when both are missing', () => {
    process.env.TEST_DATABASE_URL = '';
    process.env.TEST_DIRECT_URL = '';

    try {
      loadIntegrationEnv();
      throw new Error('expected rejection');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('TEST_DATABASE_URL');
      expect(message).toContain('TEST_DIRECT_URL');
    }
  });

  it('explains how to create .env.test from the template', () => {
    process.env.TEST_DATABASE_URL = '';
    process.env.TEST_DIRECT_URL = '';

    try {
      loadIntegrationEnv();
      throw new Error('expected rejection');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('cp apps/api/.env.test.example apps/api/.env.test');
      expect(message).toContain('test:integration:up');
    }
  });
});

// ---------------------------------------------------------------------------
// No production fallback
// ---------------------------------------------------------------------------

describe('production fallback is impossible', () => {
  it('does not fall back to DATABASE_URL when TEST_DATABASE_URL is absent', () => {
    process.env.TEST_DATABASE_URL = '';
    process.env.TEST_DIRECT_URL = '';
    process.env.DATABASE_URL = PRODUCTION_URL;
    process.env.DIRECT_URL = PRODUCTION_URL;

    // The single most important assertion in this file.
    expect(() => loadIntegrationEnv()).toThrow(IntegrationEnvError);
  });

  it('rejects a production URL even when supplied via TEST_DATABASE_URL', () => {
    process.env.TEST_DATABASE_URL = PRODUCTION_URL;
    process.env.TEST_DIRECT_URL = SAFE_URL;

    expect(() => loadIntegrationEnv()).toThrow(UnsafeTestDatabaseError);
  });

  it('rejects a production URL supplied via TEST_DIRECT_URL', () => {
    // Migrations run against the direct URL, so it needs the same scrutiny.
    process.env.TEST_DATABASE_URL = SAFE_URL;
    process.env.TEST_DIRECT_URL = PRODUCTION_URL;

    expect(() => loadIntegrationEnv()).toThrow(/TEST_DIRECT_URL/);
  });

  it('validates both variables, not just the first', () => {
    process.env.TEST_DATABASE_URL = SAFE_URL;
    process.env.TEST_DIRECT_URL = 'postgresql://u:p@localhost:5433/postgres';

    expect(() => loadIntegrationEnv()).toThrow(UnsafeTestDatabaseError);
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('successful load', () => {
  beforeEach(() => {
    process.env.TEST_DATABASE_URL = SAFE_URL;
    process.env.TEST_DIRECT_URL = SAFE_URL;
  });

  it('returns validated, redacted info for both URLs', () => {
    const env = loadIntegrationEnv();

    expect(env.info.database).toBe('meetezri_test');
    expect(env.directInfo.database).toBe('meetezri_test');
    expect(env.info.redactedUrl).not.toContain('meetezri_test:meetezri_test@');
  });

  it('lets exported variables win over the .env.test file', () => {
    // dotenv does not override an already-set variable, so CI can export its own values.
    const env = loadIntegrationEnv();
    expect(env.databaseUrl).toBe(SAFE_URL);
  });

  it('points Prisma at the test database only when explicitly applied', () => {
    process.env.DATABASE_URL = PRODUCTION_URL;
    const env = loadIntegrationEnv();

    // Loading alone must not mutate DATABASE_URL — the caller decides, in a documented order.
    expect(process.env.DATABASE_URL).toBe(PRODUCTION_URL);

    applyIntegrationDatabaseEnv(env);

    expect(process.env.DATABASE_URL).toBe(SAFE_URL);
    expect(process.env.DIRECT_URL).toBe(SAFE_URL);
  });

  it('disables Redis so integration tests never reach a cache server', () => {
    process.env.REDIS_URL = 'redis://someone-elses-redis:6379';

    applyIntegrationDatabaseEnv(loadIntegrationEnv());

    // `sharedCache` treats any falsy value as "no cache configured" and never builds a client.
    expect(process.env.REDIS_URL).toBeFalsy();
  });

  it('EMPTIES rather than deletes REDIS_URL, so a later dotenv.config() cannot restore it', () => {
    process.env.REDIS_URL = 'redis://someone-elses-redis:6379';

    applyIntegrationDatabaseEnv(loadIntegrationEnv());

    // This distinction is load-bearing, not cosmetic. `config/supabase.ts` calls bare
    // `dotenv.config()` at import time, which loads apps/api/.env — and dotenv populates keys
    // that are ABSENT while leaving existing keys alone. Deleting the variable therefore invited
    // the real Redis URL straight back mid-run, leaving a live socket that stopped Jest exiting.
    expect(Object.prototype.hasOwnProperty.call(process.env, 'REDIS_URL')).toBe(true);
    expect(process.env.REDIS_URL).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Unit-suite isolation
// ---------------------------------------------------------------------------

describe('unit suite isolation', () => {
  it('is not wired into the unit jest setup', () => {
    // `src/test-setup.ts` runs for every unit suite; it must never load .env.test or touch
    // TEST_* variables, otherwise unit runs would depend on integration configuration.
    const unitSetup = require('fs').readFileSync(`${__dirname}/../test-setup.ts`, 'utf8');

    expect(unitSetup).not.toContain('.env.test');
    expect(unitSetup).not.toContain('TEST_DATABASE_URL');
    expect(unitSetup).not.toContain('test-integration');
  });

  it('is not referenced by the unit jest config', () => {
    const unitConfig = require('fs').readFileSync(`${__dirname}/../../jest.config.cjs`, 'utf8');

    expect(unitConfig).not.toContain('test-integration');
    // And integration suites are excluded from the unit project entirely.
    expect(unitConfig).toContain('integration');
  });
});
