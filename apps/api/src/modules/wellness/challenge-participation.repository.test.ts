/**
 * PHASE 2A — the canonical active-challenge predicate.
 *
 * `getActiveChallengeCount` is a single raw `COUNT(*)`, so these tests assert two things the
 * predicate's correctness depends on: the SQL contains every required clause (and no forbidden
 * one), and the bigint result is normalized safely. The clause assertions are what would catch
 * someone quietly dropping the completed-challenge filter.
 */

const mockPrisma = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

import {
  getActiveChallengeCount,
  lockUserChallengeParticipation,
} from './challenge-participation.repository';

const USER_ID = '11111111-1111-1111-1111-111111111111';

/** Collapse the tagged-template SQL to a single line for clause matching. */
function sqlTextOf(call: any): string {
  return String(call.sql ?? call.strings?.join('?') ?? call).replace(/\s+/g, ' ');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
});

describe('getActiveChallengeCount — the predicate', () => {
  it('counts in SQL rather than loading participation rows', async () => {
    await getActiveChallengeCount(USER_ID);

    const sql = sqlTextOf(mockPrisma.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('COUNT(*)');
    expect(sql).not.toMatch(/SELECT\s+p\.\*/i);
  });

  it('scopes to the authenticated user', async () => {
    await getActiveChallengeCount(USER_ID);

    const call = mockPrisma.$queryRaw.mock.calls[0][0];
    expect(sqlTextOf(call)).toContain('p.user_id =');
    expect((call as { values?: unknown[] }).values).toContain(USER_ID);
  });

  it('excludes completed challenges, treating NULL as not-completed', async () => {
    await getActiveChallengeCount(USER_ID);

    // `is_completed` is nullable, so a bare `= false` would silently drop NULL rows.
    expect(sqlTextOf(mockPrisma.$queryRaw.mock.calls[0][0])).toContain(
      'COALESCE(p.is_completed, false) = false'
    );
  });

  it('counts only challenges inside their active date window', async () => {
    const sql = sqlTextOf((await getActiveChallengeCount(USER_ID), mockPrisma.$queryRaw.mock.calls[0][0]));

    expect(sql).toContain('c.start_date <= now()');
    expect(sql).toContain('c.end_date >= now()');
  });

  it('excludes draft challenges, matching the member-facing dashboard', async () => {
    await getActiveChallengeCount(USER_ID);

    expect(sqlTextOf(mockPrisma.$queryRaw.mock.calls[0][0])).toContain(
      "COALESCE(c.goal_criteria->>'status', '') <> 'draft'"
    );
  });

  it('joins participation to the challenge template', async () => {
    await getActiveChallengeCount(USER_ID);

    const sql = sqlTextOf(mockPrisma.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('FROM public.user_challenge_participation p');
    expect(sql).toContain('JOIN public.wellness_challenges c ON c.id = p.challenge_id');
  });

  it('relies on row absence for cancelled/abandoned/deleted participation', async () => {
    await getActiveChallengeCount(USER_ID);

    const sql = sqlTextOf(mockPrisma.$queryRaw.mock.calls[0][0]);
    // The schema has no such columns — leaving a challenge hard-deletes the row. If any of these
    // are ever added, this test failing is the reminder to revisit the predicate.
    expect(sql).not.toContain('canceled_at');
    expect(sql).not.toContain('abandoned_at');
    expect(sql).not.toContain('deleted_at');
  });
});

describe('getActiveChallengeCount — result handling', () => {
  it.each([
    [BigInt(0), 0],
    [BigInt(1), 1],
    [BigInt(3), 3],
    [BigInt(42), 42],
  ])('normalizes bigint %s to %i', async (raw, expected) => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: raw }]);
    await expect(getActiveChallengeCount(USER_ID)).resolves.toBe(expected);
  });

  it('returns 0 for a null count', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: null }]);
    await expect(getActiveChallengeCount(USER_ID)).resolves.toBe(0);
  });

  it('returns 0 for an empty result set', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(getActiveChallengeCount(USER_ID)).resolves.toBe(0);
  });

  it('never returns a negative or non-finite count', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(-5) }]);
    await expect(getActiveChallengeCount(USER_ID)).resolves.toBe(0);

    mockPrisma.$queryRaw.mockResolvedValue([{ count: NaN as any }]);
    await expect(getActiveChallengeCount(USER_ID)).resolves.toBe(0);
  });
});

describe('getActiveChallengeCount — transaction client', () => {
  it('uses the Prisma singleton when no client is given', async () => {
    await getActiveChallengeCount(USER_ID);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('enlists in a caller-owned transaction when one is given', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(2) }]) };

    await expect(getActiveChallengeCount(USER_ID, tx as any)).resolves.toBe(2);

    // The enforcement read must share the caller's snapshot and lock, not open its own.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('lockUserChallengeParticipation', () => {
  it('takes a transaction-scoped Postgres advisory lock', async () => {
    const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };

    await lockUserChallengeParticipation(USER_ID, tx as any);

    const sql = sqlTextOf(tx.$executeRaw.mock.calls[0][0]);
    // `_xact_` matters: the lock releases on commit/rollback, so there is no unlock path to leak.
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('hashtext');
  });

  it('namespaces the lock key by user and concern', async () => {
    const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };

    await lockUserChallengeParticipation(USER_ID, tx as any);

    const values = (tx.$executeRaw.mock.calls[0][0] as { values?: unknown[] }).values ?? [];
    // Namespaced so a future advisory lock on the same user for another concern cannot collide.
    expect(values).toContain(`challenge-participation:${USER_ID}`);
  });

  it('gives different users different lock keys', async () => {
    const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };

    await lockUserChallengeParticipation('user-a', tx as any);
    await lockUserChallengeParticipation('user-b', tx as any);

    const first = (tx.$executeRaw.mock.calls[0][0] as { values?: unknown[] }).values ?? [];
    const second = (tx.$executeRaw.mock.calls[1][0] as { values?: unknown[] }).values ?? [];
    expect(first).not.toEqual(second);
  });
});
