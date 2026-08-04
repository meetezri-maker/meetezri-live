/**
 * PHASE 2C CONTINUATION — baseline migration representation, pinned.
 *
 * A UNIT test (no database): it scans the committed SQL, so it fails in the ordinary suite the
 * moment the defect is reintroduced — including by a `prisma db pull` / `migrate diff` that
 * re-emits generated columns as DEFAULT expressions, which is exactly how this arose.
 *
 * BACKGROUND. `auth.identities.email` and `auth.users.confirmed_at` are
 * `GENERATED ALWAYS AS (...) STORED` in production (verified against pg_catalog and
 * information_schema). Prisma 5.22 cannot model generated columns, so introspection degraded them
 * to `@default(dbgenerated(...))` and the migration emitted `DEFAULT <expr>`. PostgreSQL rejects
 * a DEFAULT that references another column (SQLSTATE 0A000), so the baseline could not create a
 * database at all — undetected for months because nothing ever migrated from blank.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASELINE = join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260317104100_baseline',
  'migration.sql'
);

const sql = readFileSync(BASELINE, 'utf8');

/** The two columns, with the definitions production actually has. */
const GENERATED_COLUMNS = [
  {
    label: 'auth.identities.email',
    column: '"email"',
    type: 'TEXT',
    expression: "lower(identity_data ->> 'email')",
  },
  {
    label: 'auth.users.confirmed_at',
    column: '"confirmed_at"',
    type: 'TIMESTAMPTZ(6)',
    expression: 'LEAST(email_confirmed_at, phone_confirmed_at)',
  },
] as const;

/**
 * All lines declaring `column`.
 *
 * Note that a bare column name is NOT unique across the file — `"email"` appears in
 * `auth.identities`, `auth.users`, `public.profiles` and others. Assertions below therefore key
 * off the generation expression, which is unique, rather than the column name alone.
 */
function declarationsOf(column: string): string[] {
  return sql.split('\n').filter((line) => line.trim().startsWith(`${column} `));
}

/** The line carrying this column's GENERATED ALWAYS declaration, or undefined. */
function generatedLineFor(column: string, expression: string): string | undefined {
  return declarationsOf(column).find(
    (line) => line.includes('GENERATED ALWAYS AS') && line.includes(expression)
  );
}

describe('baseline migration — generated columns', () => {
  it.each(GENERATED_COLUMNS)('$label has exactly one generated declaration', ({ column, expression }) => {
    const generated = declarationsOf(column).filter((line) => line.includes('GENERATED ALWAYS AS'));

    expect(generated).toHaveLength(1);
    expect(generated[0]).toContain(expression);
  });

  it.each(GENERATED_COLUMNS)('$label generation expression appears exactly once in the file', ({ expression }) => {
    const occurrences = sql.split('\n').filter((line) => line.includes(expression));

    // Pins that the expression was moved, not duplicated — a leftover DEFAULT elsewhere would
    // still break `CREATE TABLE`.
    expect(occurrences).toHaveLength(1);
  });

  it.each(GENERATED_COLUMNS)('$label uses GENERATED ALWAYS ... STORED', ({ column, expression }) => {
    const line = generatedLineFor(column, expression);

    expect(line).toBeDefined();
    expect(line).toContain('GENERATED ALWAYS AS');
    expect(line).toContain('STORED');
  });

  it.each(GENERATED_COLUMNS)('$label does NOT use a DEFAULT', ({ column, expression }) => {
    // The defect being guarded against: a DEFAULT that references another column. PostgreSQL
    // rejects it outright, so this single assertion is what keeps the schema creatable.
    expect(generatedLineFor(column, expression)).not.toMatch(/\bDEFAULT\b/);
  });

  it.each(GENERATED_COLUMNS)('$label declares the production data type', ({ column, type, expression }) => {
    expect(generatedLineFor(column, expression)).toContain(type);
  });
});

describe('baseline migration — no column-referencing DEFAULT anywhere', () => {
  /**
   * Broader net than the two known columns: ANY `DEFAULT` whose expression names another column
   * breaks `CREATE TABLE`. Catching the class, not just the two instances, means a third such
   * column cannot slip in through a future introspection.
   */
  it('has no DEFAULT referencing a json/jsonb extraction', () => {
    const offenders = sql
      .split('\n')
      .filter((line) => /\bDEFAULT\b/.test(line) && /->>/.test(line));

    expect(offenders).toEqual([]);
  });

  it('has no DEFAULT built from LEAST/GREATEST over columns', () => {
    const offenders = sql
      .split('\n')
      .filter((line) => /\bDEFAULT\s+(LEAST|GREATEST)\s*\(/i.test(line));

    expect(offenders).toEqual([]);
  });

  it('has no DEFAULT lower(...) over a column reference', () => {
    // `DEFAULT lower('literal')` would be legal; `DEFAULT lower(some_column)` is not.
    const offenders = sql
      .split('\n')
      .filter((line) => /\bDEFAULT\s+lower\s*\(\s*[a-z_]+[^')]*\)/i.test(line));

    expect(offenders).toEqual([]);
  });
});

describe('baseline migration — scope of the correction', () => {
  it('still creates both schemas', () => {
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "auth"');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "public"');
  });

  it('still creates the tables the entitlement engine depends on', () => {
    for (const table of [
      '"public"."profiles"',
      '"public"."subscriptions"',
      '"public"."wellness_challenges"',
      '"public"."user_challenge_participation"',
      '"auth"."users"',
      '"auth"."identities"',
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
  });

  it('introduces GENERATED ALWAYS only for the two approved columns', () => {
    const generated = sql.split('\n').filter((line) => line.includes('GENERATED ALWAYS'));

    expect(generated).toHaveLength(2);
  });
});
