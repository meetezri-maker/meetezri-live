/**
 * Integration-test database safety guard.
 *
 * THE ONLY THING STANDING BETWEEN AN INTEGRATION RUN AND A PRODUCTION DATABASE.
 *
 * Integration tests truncate tables and create/destroy rows. If one ever ran against the
 * production Supabase URL that sits in `apps/api/.env`, the damage would be immediate and
 * irreversible. So every entry point — bootstrap, global setup, and each test file — calls
 * `assertSafeTestDatabase()` first, and it fails closed on anything it cannot positively
 * identify as a disposable test database.
 *
 * DESIGN: allow-list, not deny-list. A deny-list of "bad hosts" fails open the moment someone
 * introduces a new provider; this requires the URL to look like the local throwaway database and
 * rejects everything else, so an unrecognised URL is refused rather than trusted.
 *
 * NEVER PRINTS PASSWORDS. Every diagnostic goes through `redactDatabaseUrl()`.
 */

/** Database name the test stack provisions. Anything else is refused. */
export const REQUIRED_TEST_DATABASE_NAME = 'meetezri_test';

/** Hosts a test database may live on. Loopback only — a test must never reach the network. */
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres-test', 'meetezri-postgres-test']);

/**
 * Substrings that identify a managed/production database. Checked in addition to the allow-list
 * so a misconfiguration produces a precise, actionable error instead of a generic one.
 */
const FORBIDDEN_HOST_MARKERS = [
  'supabase.co',
  'supabase.com',
  'pooler.supabase',
  'neon.tech',
  'rds.amazonaws.com',
  'azure.com',
  'render.com',
  'railway.app',
  'heroku',
];

/** Database names that must never be touched by a test, even on an allowed host. */
const FORBIDDEN_DATABASE_NAMES = ['postgres', 'production', 'prod', 'main', 'meetezri', 'meetezri_prod'];

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string, variableName = 'TEST_DATABASE_URL') {
    super(`REFUSING TO RUN INTEGRATION TESTS: ${variableName} ${message}`);
    this.name = 'UnsafeTestDatabaseError';
  }
}

/**
 * Strip credentials from a database URL so it can be logged.
 *
 * Falls back to a hard-coded placeholder rather than the original string if parsing fails —
 * an unparseable URL must never be echoed, because that is exactly when it might contain
 * something unexpected.
 */
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '<unparseable database url>';
  }
}

export interface SafeDatabaseInfo {
  host: string;
  port: string;
  database: string;
  /** Safe to log. */
  redactedUrl: string;
}

/**
 * Validate that `url` points at a disposable local test database.
 *
 * Throws `UnsafeTestDatabaseError` on anything else. Returns the parsed, non-sensitive parts so
 * callers can log what they connected to.
 *
 * `variableName` is only used to make failures name the offending variable — both
 * TEST_DATABASE_URL and TEST_DIRECT_URL go through here.
 */
export function assertSafeTestDatabaseUrl(
  url: string | undefined,
  variableName = 'TEST_DATABASE_URL'
): SafeDatabaseInfo {
  if (!url || !url.trim()) {
    throw new UnsafeTestDatabaseError(
      'is not set. Integration tests never fall back to DATABASE_URL — that variable points at ' +
        'production. Copy apps/api/.env.test.example to apps/api/.env.test.',
      variableName
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeTestDatabaseError('is not a valid URL.', variableName);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new UnsafeTestDatabaseError(
      `has unsupported protocol "${parsed.protocol}"; expected postgresql:`,
      variableName
    );
  }

  const host = parsed.hostname.toLowerCase();
  const database = parsed.pathname.replace(/^\//, '').split('?')[0];

  for (const marker of FORBIDDEN_HOST_MARKERS) {
    if (host.includes(marker)) {
      throw new UnsafeTestDatabaseError(
        `points at host "${host}", which looks like a managed/production database (matched "${marker}").`,
        variableName
      );
    }
  }

  if (!ALLOWED_HOSTS.has(host)) {
    throw new UnsafeTestDatabaseError(
      `points at host "${host}", which is not an allowed test host. Allowed: ${[...ALLOWED_HOSTS].join(', ')}.`,
      variableName
    );
  }

  if (FORBIDDEN_DATABASE_NAMES.includes(database.toLowerCase())) {
    throw new UnsafeTestDatabaseError(
      `names database "${database}", which is forbidden for tests.`,
      variableName
    );
  }

  if (database !== REQUIRED_TEST_DATABASE_NAME) {
    throw new UnsafeTestDatabaseError(
      `must name database exactly "${REQUIRED_TEST_DATABASE_NAME}", got "${database}".`,
      variableName
    );
  }

  // A pooler in front of the database breaks session-scoped behaviour (and advisory locks in
  // transaction-pooling mode), and its presence is a strong signal of a managed environment.
  if (parsed.searchParams.get('pgbouncer') === 'true') {
    throw new UnsafeTestDatabaseError(
      'sets pgbouncer=true, indicating a pooled/managed database.',
      variableName
    );
  }

  // The production URL pins `connection_limit=1`. The concurrency tests need genuinely parallel
  // transactions, so a single connection would not just be wrong — it would deadlock and could
  // be mistaken for the lock working.
  if (parsed.searchParams.get('connection_limit') === '1') {
    throw new UnsafeTestDatabaseError(
      'sets connection_limit=1, making concurrent transactions impossible; the concurrency proof requires a real pool.',
      variableName
    );
  }

  return {
    host,
    port: parsed.port || '5432',
    database,
    redactedUrl: redactDatabaseUrl(url),
  };
}

/**
 * Names of environment variables this guard will read. `DATABASE_URL` is deliberately absent:
 * a fallback to it is precisely how a test run would reach production.
 */
export const INTEGRATION_ENV_VARS = ['TEST_DATABASE_URL', 'TEST_DIRECT_URL'] as const;
