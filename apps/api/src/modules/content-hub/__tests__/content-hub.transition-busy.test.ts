/**
 * Regression: draft → in_review returned a bare 500 in production (req-y).
 *
 * WHAT HAPPENED. `transitionContent` opened its interactive transaction with `{ timeout: 20_000 }`
 * and nothing else, so `maxWait` stayed at Prisma's 2 000 ms default. `timeout` is how long the
 * transaction may RUN; `maxWait` is how long Prisma will wait to ACQUIRE a connection and issue
 * BEGIN. In production the API is serverless against Supabase's PgBouncer transaction pooler with
 * `connection_limit=1`, so whenever another query held that single connection, acquisition ran past
 * two seconds and Prisma threw P2028 — "Unable to start a transaction in the given time" — before
 * the callback body executed.
 *
 * Two things were wrong, and both are covered here:
 *   1. The wait budget was two seconds while the execution budget sat unused at twenty.
 *   2. P2028 fell through to the generic handler and rendered as
 *      `{"statusCode":500,"error":"PrismaClientKnownRequestError","message":"Something went wrong
 *      on Server side"}` — which reads like a corrupted write, when in fact NOTHING was written.
 *
 * These are unit tests on the error translation and the transaction options. The atomicity of the
 * transition itself — status, revision and audit event together or not at all — is proved against
 * real PostgreSQL in `content-hub.workflow.integration.test.ts`.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ContentHubError,
  isContentHubError,
  mapPrismaTransactionUnavailable,
} from '../content-hub.errors';

/** A faithful stand-in for what Prisma actually threw, per the production error_logs row. */
function prismaError(code: string, message: string) {
  return Object.assign(new Error(message), {
    name: 'PrismaClientKnownRequestError',
    code,
    clientVersion: '5.22.0',
  });
}

const P2028 = prismaError('P2028', 'Transaction API error: Unable to start a transaction in the given time.');
const P2024 = prismaError('P2024', 'Timed out fetching a new connection from the connection pool.');

describe('a starved connection pool is reported as retryable, not as a server fault', () => {
  it('translates the exact production P2028 into a domain error', () => {
    const mapped = mapPrismaTransactionUnavailable(P2028);

    expect(mapped).toBeInstanceOf(ContentHubError);
    expect(mapped).toMatchObject({ statusCode: 503, code: 'TRANSACTION_BUSY' });
  });

  it('translates the pool-timeout sibling P2024 as well', () => {
    expect(mapPrismaTransactionUnavailable(P2024)).toMatchObject({
      statusCode: 503,
      code: 'TRANSACTION_BUSY',
    });
  });

  it('says plainly that nothing changed, because nothing did', () => {
    // The transaction never began. An operator reading this must not be left wondering whether
    // the content is half-transitioned.
    const mapped = mapPrismaTransactionUnavailable(P2028)!;
    expect(mapped.message).toMatch(/nothing was modified/i);
    expect(mapped.message).toMatch(/try again/i);
  });

  it('produces something the module error mapper will actually send', () => {
    // `sendError` only formats a response for errors that pass `isContentHubError`; anything else
    // is re-thrown to the generic 500 handler, which is exactly what used to happen here.
    expect(isContentHubError(mapPrismaTransactionUnavailable(P2028))).toBe(true);
  });

  it('is 503, not 500 — the request is retryable and the server is not broken', () => {
    expect(mapPrismaTransactionUnavailable(P2028)!.statusCode).toBe(503);
  });

  it('leaves every other Prisma error alone', () => {
    // Unique violations, missing rows and validation errors must keep their own handling.
    expect(mapPrismaTransactionUnavailable(prismaError('P2002', 'Unique constraint failed'))).toBeNull();
    expect(mapPrismaTransactionUnavailable(prismaError('P2025', 'Record not found'))).toBeNull();
    expect(mapPrismaTransactionUnavailable(new Error('boom'))).toBeNull();
    expect(mapPrismaTransactionUnavailable(null)).toBeNull();
    expect(mapPrismaTransactionUnavailable(undefined)).toBeNull();
  });

  it('does not swallow a domain error that was already correct', () => {
    const illegal = new ContentHubError(409, 'ILLEGAL_TRANSITION', 'Cannot move content from in_review to in_review.');
    expect(mapPrismaTransactionUnavailable(illegal)).toBeNull();
  });
});

describe('the transition transaction can wait long enough to start', () => {
  const source = readFileSync(
    join(__dirname, '..', 'content-hub.publish.service.ts'),
    'utf8',
  );

  it('passes an explicit maxWait to the transition transaction', () => {
    // Read from source rather than executed, because the value is what failed in production and a
    // mock of `$transaction` would assert only that the mock was called.
    expect(source).toMatch(/maxWait:\s*TRANSACTION_MAX_WAIT_MS/);
    expect(source).toMatch(/const TRANSACTION_MAX_WAIT_MS = 10_000;/);
  });

  it('waits far longer than the 2s default that produced req-y', () => {
    const maxWait = Number(
      /const TRANSACTION_MAX_WAIT_MS = ([\d_]+);/.exec(source)![1].replace(/_/g, ''),
    );
    expect(maxWait).toBeGreaterThan(2_000);
  });

  it('never waits longer for a connection than the transaction may run', () => {
    // A maxWait above the execution budget would let a request sit past its own deadline waiting
    // for a connection it can no longer use.
    const maxWait = Number(
      /const TRANSACTION_MAX_WAIT_MS = ([\d_]+);/.exec(source)![1].replace(/_/g, ''),
    );
    const timeout = Number(
      /const TRANSACTION_TIMEOUT_MS = ([\d_]+);/.exec(source)![1].replace(/_/g, ''),
    );
    expect(maxWait).toBeLessThan(timeout);
  });

  it('still bounds how long the transaction itself may run', () => {
    expect(source).toMatch(/timeout:\s*TRANSACTION_TIMEOUT_MS/);
  });
});
