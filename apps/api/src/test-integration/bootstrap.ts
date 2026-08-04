/**
 * Deterministic integration-database bootstrap.
 *
 * Ordered exactly as required, and every step is verified rather than assumed:
 *
 *   1. wait for PostgreSQL to accept connections
 *   2. validate the target is a disposable test database   <- fails closed
 *   3. create the `auth` schema if required
 *   4. install required extensions
 *   5. `prisma migrate deploy`
 *   6. generate the client if required
 *   7. verify the schema actually landed
 *
 * `migrate deploy` is NOT silently swapped for `db push`. The whole point is to prove the real
 * migration history initialises a blank database; `db push` would prove something weaker and hide
 * exactly the class of problem worth knowing about.
 */

import { execFileSync } from 'child_process';
import { Client } from 'pg';
import { loadIntegrationEnv } from './env';
import type { SafeDatabaseInfo } from './safe-database';

const API_ROOT = `${__dirname}/../..`;

/** Extensions the migrations depend on. */
const REQUIRED_EXTENSIONS = [
  // `uuid_generate_v4()` — used as a column default across the baseline schema.
  'uuid-ossp',
  // `gen_random_uuid()` — built into PostgreSQL 13+, but installing pgcrypto keeps the bootstrap
  // correct if the image is ever pinned lower.
  'pgcrypto',
];

/** Tables whose presence proves the migration history actually applied. */
const VERIFY_TABLES: Array<{ schema: string; table: string }> = [
  { schema: 'public', table: 'profiles' },
  { schema: 'public', table: 'subscriptions' },
  { schema: 'public', table: 'wellness_challenges' },
  { schema: 'public', table: 'user_challenge_participation' },
  { schema: 'auth', table: 'users' },
];

function log(step: string, detail = '') {
  // eslint-disable-next-line no-console
  console.log(`[integration-bootstrap] ${step}${detail ? ` — ${detail}` : ''}`);
}

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/** Step 1 — poll until the server accepts a connection, or give up with a clear message. */
async function waitForPostgres(url: string, info: SafeDatabaseInfo): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const client = await connect(url);
      await client.query('SELECT 1');
      await client.end();
      log('1/7 postgres is accepting connections', `${info.host}:${info.port}`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `PostgreSQL at ${info.host}:${info.port} did not become ready within 60s. ` +
      `Start it with \`pnpm test:integration:up\`. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
  );
}

/** Steps 3 and 4 — schema and extensions the migrations assume already exist. */
async function prepareDatabase(url: string): Promise<void> {
  const client = await connect(url);
  try {
    // The baseline migration creates `auth` itself, but creating it here first makes the
    // bootstrap independent of that detail and keeps re-runs idempotent.
    await client.query('CREATE SCHEMA IF NOT EXISTS "auth"');
    log('3/7 auth schema ensured');

    for (const extension of REQUIRED_EXTENSIONS) {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    }
    log('4/7 extensions installed', REQUIRED_EXTENSIONS.join(', '));
  } finally {
    await client.end();
  }
}

/** Step 5 — the real migration history against a blank database. */
function runMigrateDeploy(databaseUrl: string, directUrl: string): void {
  try {
    const output = execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        // Prisma uses `directUrl` for migrations. Both are set from the validated TEST_* values.
        //
        // This is also what stops the Prisma CLI resolving production out of `apps/api/.env`:
        // the CLI auto-loads that file, but dotenv never overrides an already-set variable, so
        // these explicit values win. `verifySchema` then re-checks against the test URL, so a
        // migration that somehow landed elsewhere would fail the bootstrap rather than pass it.
        DATABASE_URL: databaseUrl,
        DIRECT_URL: directUrl,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const applied = (output.match(/(\d+) migrations? found/)?.[1] ?? '?').toString();
    log('5/7 prisma migrate deploy succeeded', `${applied} migrations in history`);
  } catch (error) {
    const err = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout = err.stdout?.toString() ?? '';
    const stderr = err.stderr?.toString() ?? '';

    throw new Error(
      `prisma migrate deploy FAILED against the blank test database.\n` +
        `This is a real migration-history problem, not a test-harness problem.\n` +
        `${diagnoseMigrationFailure(stderr)}\n` +
        `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`
    );
  }
}

/**
 * Recognise the known blocker so whoever runs this gets the diagnosis, not just a stack trace.
 *
 * Documented in the Phase 2C report. Kept here because the person hitting the failure is not
 * necessarily the person who read the report.
 */
function diagnoseMigrationFailure(stderr: string): string {
  if (!/cannot use column reference in DEFAULT expression/.test(stderr)) return '';

  return [
    '',
    'KNOWN BLOCKER — Supabase generated columns mis-introspected as DEFAULT expressions.',
    '',
    'The baseline migration (20260317104100_baseline) was produced by introspecting the live',
    'Supabase database. Two `auth` columns are GENERATED ALWAYS ... STORED there, but Prisma',
    'recorded them as DEFAULT expressions, and PostgreSQL forbids column references in a DEFAULT:',
    '',
    "  line 125  auth.identities.email       DEFAULT lower((identity_data ->> 'email'::text))",
    '  line 384  auth.users.confirmed_at     DEFAULT LEAST(email_confirmed_at, phone_confirmed_at)',
    '',
    'Verified: correcting only those two lines lets all 29 migrations apply cleanly to a blank',
    'database. The fix is NOT applied here because editing an already-applied migration changes',
    'its checksum, which would require repairing production migration history — an explicit',
    'STOP condition requiring approval. See MEMBERSHIP_ENTITLEMENTS_V1_PHASE2C_REPORT.md.',
    '',
  ].join('\n');
}

/** Step 6 — the Prisma client must exist before any test imports it. */
function ensureClientGenerated(): void {
  try {
    require.resolve('@prisma/client');
    log('6/7 prisma client present');
  } catch {
    execFileSync('npx', ['prisma', 'generate'], { cwd: API_ROOT, stdio: 'ignore' });
    log('6/7 prisma client generated');
  }
}

/** Step 7 — prove the schema landed rather than trusting the exit code. */
async function verifySchema(url: string): Promise<void> {
  const client = await connect(url);
  try {
    const missing: string[] = [];

    for (const { schema, table } of VERIFY_TABLES) {
      const result = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
        [schema, table]
      );
      if (result.rowCount === 0) missing.push(`${schema}.${table}`);
    }

    if (missing.length > 0) {
      throw new Error(`schema verification failed; missing table(s): ${missing.join(', ')}`);
    }

    // The advisory-lock proof depends on this function existing — assert it explicitly rather
    // than discovering it inside a concurrency test.
    const lockFn = await client.query(
      `SELECT 1 FROM pg_proc WHERE proname = 'pg_advisory_xact_lock' LIMIT 1`
    );
    if (lockFn.rowCount === 0) throw new Error('pg_advisory_xact_lock is unavailable');

    await verifyGeneratedColumns(client);

    log('7/7 schema verified', `${VERIFY_TABLES.length} tables + generated columns + advisory locks`);
  } finally {
    await client.end();
  }
}

/**
 * Assert both corrected columns landed as STORED generated columns with the exact expressions
 * production reports.
 *
 * The expected strings are PostgreSQL's own normalised forms (taken from `pg_get_expr` against
 * production), not the migration's source text — so this proves the migrated database is
 * EQUIVALENT to production, rather than merely that the file contains the right words.
 */
const EXPECTED_GENERATED_COLUMNS: Array<{ table: string; column: string; expression: string }> = [
  { table: 'identities', column: 'email', expression: "lower((identity_data ->> 'email'::text))" },
  {
    table: 'users',
    column: 'confirmed_at',
    expression: 'LEAST(email_confirmed_at, phone_confirmed_at)',
  },
];

async function verifyGeneratedColumns(client: Client): Promise<void> {
  for (const expected of EXPECTED_GENERATED_COLUMNS) {
    const result = await client.query<{ generated: string; expression: string | null }>(
      `SELECT a.attgenerated::text AS generated,
              pg_get_expr(d.adbin, d.adrelid) AS expression
         FROM pg_attribute a
         JOIN pg_class c     ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'auth' AND c.relname = $1 AND a.attname = $2
          AND a.attnum > 0 AND NOT a.attisdropped`,
      [expected.table, expected.column]
    );

    const row = result.rows[0];
    const where = `auth.${expected.table}.${expected.column}`;

    if (!row) throw new Error(`${where} is missing from the migrated database`);
    if (row.generated !== 's') {
      throw new Error(
        `${where} is not a STORED generated column (attgenerated='${row.generated}'). ` +
          'The baseline migration has regressed to a plain column or a DEFAULT.'
      );
    }
    if (row.expression !== expected.expression) {
      throw new Error(
        `${where} generation expression does not match production.\n` +
          `  expected: ${expected.expression}\n` +
          `  actual:   ${row.expression}`
      );
    }
  }
}

/**
 * Run the whole bootstrap. Safe to call repeatedly; every step is idempotent.
 *
 * `loadIntegrationEnv()` performs env loading AND validation, so no connection, migration, raw
 * SQL, or factory can run before the target has been proven to be a disposable test database.
 */
export async function bootstrapIntegrationDatabase(): Promise<SafeDatabaseInfo> {
  const env = loadIntegrationEnv();
  log(
    '2/7 environment loaded and validated',
    `${env.info.redactedUrl}${env.loadedFromFile ? ' (from .env.test)' : ' (from exported vars)'}`
  );

  await waitForPostgres(env.databaseUrl, env.info);
  await prepareDatabase(env.databaseUrl);
  runMigrateDeploy(env.databaseUrl, env.directUrl);
  ensureClientGenerated();
  await verifySchema(env.databaseUrl);

  return env.info;
}
