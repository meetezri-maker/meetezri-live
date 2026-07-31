/**
 * PHASE 2C — safety guard for the integration database.
 *
 * A UNIT test (runs in the normal suite, needs no database) because it is the guard that protects
 * the database — it must pass before any integration machinery is trusted.
 *
 * The production URL shape used in the rejection cases is taken from `apps/api/.env` so the test
 * proves the guard rejects the URL that actually exists on this machine. Passwords are dummies.
 */

import {
  UnsafeTestDatabaseError,
  assertSafeTestDatabaseUrl,
  redactDatabaseUrl,
  REQUIRED_TEST_DATABASE_NAME,
  INTEGRATION_ENV_VARS,
} from './safe-database';

const SAFE_URL = 'postgresql://meetezri_test:meetezri_test@localhost:5433/meetezri_test';

describe('assertSafeTestDatabaseUrl — accepts the disposable test database', () => {
  it('accepts the local test URL', () => {
    const info = assertSafeTestDatabaseUrl(SAFE_URL);

    expect(info).toMatchObject({ host: 'localhost', port: '5433', database: 'meetezri_test' });
  });

  it('accepts the docker service hostname', () => {
    expect(
      assertSafeTestDatabaseUrl('postgresql://u:p@postgres-test:5432/meetezri_test').host
    ).toBe('postgres-test');
  });

  it('accepts loopback addresses', () => {
    expect(assertSafeTestDatabaseUrl('postgresql://u:p@127.0.0.1:5433/meetezri_test').host).toBe(
      '127.0.0.1'
    );
  });

  it('accepts the postgres: protocol alias', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgres://u:p@localhost:5433/meetezri_test')
    ).not.toThrow();
  });
});

describe('assertSafeTestDatabaseUrl — rejects production', () => {
  it('rejects the real production Supabase pooler URL shape', () => {
    // This is the URL shape sitting in apps/api/.env. It must never be usable by a test.
    const productionish =
      'postgresql://postgres.oebtxvmldckdezcpfkai:REDACTED@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1';

    expect(() => assertSafeTestDatabaseUrl(productionish)).toThrow(UnsafeTestDatabaseError);
    expect(() => assertSafeTestDatabaseUrl(productionish)).toThrow(/managed\/production database/);
  });

  it.each([
    ['supabase host', 'postgresql://u:p@db.abcdefg.supabase.co:5432/meetezri_test'],
    ['supabase pooler', 'postgresql://u:p@aws-1.pooler.supabase.com:6543/meetezri_test'],
    ['neon', 'postgresql://u:p@ep-cool.neon.tech:5432/meetezri_test'],
    ['aws rds', 'postgresql://u:p@db.abc.us-east-1.rds.amazonaws.com:5432/meetezri_test'],
    ['railway', 'postgresql://u:p@containers.railway.app:5432/meetezri_test'],
    ['heroku', 'postgresql://u:p@ec2-1-2-3.compute.heroku.com:5432/meetezri_test'],
  ])('rejects a %s host even with the right database name', (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(UnsafeTestDatabaseError);
  });

  it('rejects an unrecognised host outright (allow-list, not deny-list)', () => {
    // A brand-new provider nobody has thought of must fail closed.
    expect(() => assertSafeTestDatabaseUrl('postgresql://u:p@db.some-new-cloud.io:5432/meetezri_test')).toThrow(
      /not an allowed test host/
    );
  });

  it.each([
    ['postgres', 'postgresql://u:p@localhost:5433/postgres'],
    ['production', 'postgresql://u:p@localhost:5433/production'],
    ['prod', 'postgresql://u:p@localhost:5433/prod'],
    ['meetezri', 'postgresql://u:p@localhost:5433/meetezri'],
    ['meetezri_prod', 'postgresql://u:p@localhost:5433/meetezri_prod'],
  ])('rejects the forbidden database name "%s" even on localhost', (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(UnsafeTestDatabaseError);
  });

  it('requires the exact test database name', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://u:p@localhost:5433/something_else')).toThrow(
      new RegExp(`must name database exactly "${REQUIRED_TEST_DATABASE_NAME}"`)
    );
  });

  it('rejects a pooled connection', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@localhost:5433/meetezri_test?pgbouncer=true')
    ).toThrow(/pooled\/managed/);
  });

  it('rejects connection_limit=1, which would fake a passing concurrency test', () => {
    // With one connection the second transaction cannot even start, so it would look serialized
    // whether or not the advisory lock worked.
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@localhost:5433/meetezri_test?connection_limit=1')
    ).toThrow(/concurrency proof requires a real pool/);
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('rejects a %s url with guidance', (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/TEST_DATABASE_URL is not set/);
  });

  it('rejects a malformed url', () => {
    expect(() => assertSafeTestDatabaseUrl('not-a-url')).toThrow(/not a valid URL/);
  });

  it('rejects a non-postgres protocol', () => {
    expect(() => assertSafeTestDatabaseUrl('mysql://u:p@localhost:5433/meetezri_test')).toThrow(
      /unsupported protocol/
    );
  });
});

describe('redactDatabaseUrl', () => {
  it('removes the password and username', () => {
    const redacted = redactDatabaseUrl('postgresql://secretuser:hunter2@localhost:5433/meetezri_test');

    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('secretuser');
    expect(redacted).toContain('localhost:5433');
  });

  it('never echoes an unparseable url back', () => {
    expect(redactDatabaseUrl('postgres://oops:hunter2@@@')).toBe('<unparseable database url>');
  });

  it('is used for the info returned to callers', () => {
    const info = assertSafeTestDatabaseUrl('postgresql://meetezri_test:hunter2@localhost:5433/meetezri_test');
    expect(info.redactedUrl).not.toContain('hunter2');
  });
});

describe('variable naming in failures', () => {
  it('names TEST_DIRECT_URL when that is the offending variable', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@db.abc.supabase.co:5432/meetezri_test', 'TEST_DIRECT_URL')
    ).toThrow(/TEST_DIRECT_URL/);
  });

  it('defaults to naming TEST_DATABASE_URL', () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(/TEST_DATABASE_URL/);
  });

  it('points a missing variable at the template file', () => {
    expect(() => assertSafeTestDatabaseUrl('')).toThrow(/\.env\.test\.example/);
  });

  it('states that DATABASE_URL is never a fallback', () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(/never fall back to DATABASE_URL/);
  });

  it('lists only TEST_* variables as inputs', () => {
    // `DATABASE_URL` must never appear here — a fallback to it is how a test reaches production.
    expect(INTEGRATION_ENV_VARS).toEqual(['TEST_DATABASE_URL', 'TEST_DIRECT_URL']);
    expect(INTEGRATION_ENV_VARS as readonly string[]).not.toContain('DATABASE_URL');
  });
});

describe('no password ever reaches an error message', () => {
  it.each([
    ['forbidden host', 'postgresql://admin:sup3rs3cret@db.abc.supabase.co:5432/meetezri_test'],
    ['wrong database', 'postgresql://admin:sup3rs3cret@localhost:5433/postgres'],
    ['pooled', 'postgresql://admin:sup3rs3cret@localhost:5433/meetezri_test?pgbouncer=true'],
  ])('keeps the password out of the %s failure', (_label, url) => {
    try {
      assertSafeTestDatabaseUrl(url);
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as Error).message).not.toContain('sup3rs3cret');
    }
  });
});
