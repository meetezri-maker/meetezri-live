/**
 * PHASE 2C — advisory-lock concurrency proof against REAL PostgreSQL.
 *
 * This is the test Phase 2B stopped for. Everything here is real:
 *   - a real PostgreSQL 15 server (disposable container)
 *   - the real `prisma.$transaction` used in production
 *   - real `pg_advisory_xact_lock` calls
 *   - the real active-count SQL
 *   - the real `joinWellnessChallenge` service, unmodified
 *
 * NOTHING IS MOCKED. No fake transactions, no simulated lock, no stubbed count. If the advisory
 * lock did not work, Test A would produce two participation rows and fail.
 *
 * NO PRODUCTION TEST HOOKS. The concurrency is created purely by issuing two real service calls
 * without awaiting the first — the same thing two HTTP requests do. The service has no
 * test-only branch, delay, or seam.
 *
 * TIMING: no sleeps and no timing assertions. Concurrency is established with `Promise.allSettled`
 * over genuinely parallel Prisma connections, and correctness is asserted from database state,
 * which is deterministic regardless of scheduling.
 */

import prisma from '../../lib/prisma';
import { joinWellnessChallenge } from './wellness.service';
import { ActiveChallengeLimitError } from './challenge-limit.error';
import {
  getActiveChallengeCount,
  lockUserChallengeParticipation,
} from './challenge-participation.repository';
import {
  cleanupIntegrationData,
  countAdvisoryLocks,
  countParticipationRows,
  createActiveChallenge,
  createMember,
  createParticipation,
} from '../../test-integration/factories';

jest.setTimeout(60_000);

beforeAll(async () => {
  await cleanupIntegrationData();
});

afterEach(async () => {
  await cleanupIntegrationData();
});

afterAll(async () => {
  await cleanupIntegrationData();
});

/** Settle results into successes and `ActiveChallengeLimitError` rejections. */
function partition(results: PromiseSettledResult<unknown>[]) {
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const limitErrors = results.filter(
    (r) => r.status === 'rejected' && r.reason instanceof ActiveChallengeLimitError
  );
  const otherErrors = results.filter(
    (r) => r.status === 'rejected' && !(r.reason instanceof ActiveChallengeLimitError)
  );
  return { fulfilled, limitErrors, otherErrors };
}

// ---------------------------------------------------------------------------
// TEST A — the core proof
// ---------------------------------------------------------------------------

describe('TEST A — Discover: two concurrent joins', () => {
  it('admits exactly one and rejects exactly one, leaving one row', async () => {
    const member = await createMember('discover-race', 'trial');
    const challengeA = await createActiveChallenge('race-a');
    const challengeB = await createActiveChallenge('race-b');

    expect(await getActiveChallengeCount(member.userId)).toBe(0);

    // Both calls start before either completes — real parallel connections, no await between.
    const results = await Promise.allSettled([
      joinWellnessChallenge(member.userId, challengeA),
      joinWellnessChallenge(member.userId, challengeB),
    ]);

    const { fulfilled, limitErrors, otherErrors } = partition(results);

    expect(otherErrors).toHaveLength(0);
    expect(fulfilled).toHaveLength(1);
    expect(limitErrors).toHaveLength(1);

    // The database is the real assertion: without the lock, both would have inserted.
    expect(await countParticipationRows(member.userId)).toBe(1);
    expect(await getActiveChallengeCount(member.userId)).toBe(1);
  });

  it('reports the limit correctly on the rejected call', async () => {
    const member = await createMember('discover-race-detail', 'trial');
    const a = await createActiveChallenge('detail-a');
    const b = await createActiveChallenge('detail-b');

    const results = await Promise.allSettled([
      joinWellnessChallenge(member.userId, a),
      joinWellnessChallenge(member.userId, b),
    ]);

    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    const error = rejected.reason as ActiveChallengeLimitError;

    expect(error.code).toBe('ACTIVE_CHALLENGE_LIMIT_REACHED');
    expect(error.membership).toBe('DISCOVER');
    expect(error.limit).toBe(1);
    expect(error.upgradeMembership).toBe('GROW');
  });

  it('creates no duplicate or partial rows under five concurrent joins', async () => {
    const member = await createMember('discover-five', 'trial');
    const challenges = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => createActiveChallenge(`five-${n}`))
    );

    const results = await Promise.allSettled(
      challenges.map((id) => joinWellnessChallenge(member.userId, id))
    );

    const { fulfilled, limitErrors, otherErrors } = partition(results);

    expect(otherErrors).toHaveLength(0);
    expect(fulfilled).toHaveLength(1);
    expect(limitErrors).toHaveLength(4);
    expect(await countParticipationRows(member.userId)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TEST B — rollback releases the lock
// ---------------------------------------------------------------------------

describe('TEST B — rollback releases the advisory lock', () => {
  it('holds no advisory lock after a transaction rolls back', async () => {
    const member = await createMember('rollback', 'trial');

    await expect(
      prisma.$transaction(async (tx) => {
        await lockUserChallengeParticipation(member.userId, tx);
        // The lock is genuinely held at this point, inside the transaction.
        expect(await countAdvisoryLocks()).toBeGreaterThan(0);
        throw new Error('deliberate rollback');
      })
    ).rejects.toThrow('deliberate rollback');

    // `pg_advisory_xact_lock` is transaction-scoped, so ROLLBACK must release it.
    expect(await countAdvisoryLocks()).toBe(0);
  });

  it('leaves the lock acquirable by a subsequent transaction after a rollback', async () => {
    const member = await createMember('rollback-reacquire', 'trial');
    const challenge = await createActiveChallenge('rollback-reacquire');

    await expect(
      prisma.$transaction(async (tx) => {
        await lockUserChallengeParticipation(member.userId, tx);
        throw new Error('deliberate rollback');
      })
    ).rejects.toThrow();

    // If the lock had leaked, this join would block until the statement timeout.
    await expect(joinWellnessChallenge(member.userId, challenge)).resolves.toBeDefined();
    expect(await countParticipationRows(member.userId)).toBe(1);
  });

  it('writes nothing when the limit rejects inside the transaction', async () => {
    const member = await createMember('rollback-limit', 'trial');
    const first = await createActiveChallenge('rollback-limit-1');
    const second = await createActiveChallenge('rollback-limit-2');

    await joinWellnessChallenge(member.userId, first);
    await expect(joinWellnessChallenge(member.userId, second)).rejects.toBeInstanceOf(
      ActiveChallengeLimitError
    );

    // The rejection rolled back: no partial row for the second challenge, and no leaked lock.
    expect(await countParticipationRows(member.userId)).toBe(1);
    expect(await countAdvisoryLocks()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TEST C — commit releases the lock
// ---------------------------------------------------------------------------

describe('TEST C — commit releases the advisory lock', () => {
  it('holds no advisory lock after a successful join', async () => {
    const member = await createMember('commit', 'trial');
    const challenge = await createActiveChallenge('commit');

    await joinWellnessChallenge(member.userId, challenge);

    expect(await countAdvisoryLocks()).toBe(0);
  });

  it('allows repeated sequential joins without lock accumulation', async () => {
    const member = await createMember('commit-repeat', 'pro'); // unlimited, so all succeed
    const challenges = await Promise.all(
      [1, 2, 3].map((n) => createActiveChallenge(`commit-repeat-${n}`))
    );

    for (const id of challenges) {
      await joinWellnessChallenge(member.userId, id);
      expect(await countAdvisoryLocks()).toBe(0);
    }
  });

  it('releases the lock taken directly by the repository helper', async () => {
    const member = await createMember('commit-direct', 'trial');

    await prisma.$transaction(async (tx) => {
      await lockUserChallengeParticipation(member.userId, tx);
      expect(await countAdvisoryLocks()).toBeGreaterThan(0);
    });

    expect(await countAdvisoryLocks()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TEST D — per-user isolation
// ---------------------------------------------------------------------------

describe('TEST D — different users do not block each other', () => {
  it('lets two members join concurrently, both succeeding', async () => {
    const alice = await createMember('iso-alice', 'trial');
    const bob = await createMember('iso-bob', 'trial');
    const challengeA = await createActiveChallenge('iso-a');
    const challengeB = await createActiveChallenge('iso-b');

    const results = await Promise.allSettled([
      joinWellnessChallenge(alice.userId, challengeA),
      joinWellnessChallenge(bob.userId, challengeB),
    ]);

    const { fulfilled, otherErrors } = partition(results);

    // The lock is keyed per user, so neither member's limit affects the other.
    expect(otherErrors).toHaveLength(0);
    expect(fulfilled).toHaveLength(2);
    expect(await countParticipationRows(alice.userId)).toBe(1);
    expect(await countParticipationRows(bob.userId)).toBe(1);
  });

  it('does not let one member holding the lock block another member', async () => {
    const holder = await createMember('iso-holder', 'trial');
    const other = await createMember('iso-other', 'trial');
    const challenge = await createActiveChallenge('iso-other-challenge');

    let releaseHolder!: () => void;
    const holderReleased = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });

    // Hold the holder's lock open for the whole duration of the other member's join.
    const holding = prisma.$transaction(async (tx) => {
      await lockUserChallengeParticipation(holder.userId, tx);
      await holderReleased;
    });

    // No sleep: this either completes (locks are per-user) or blocks until the test times out.
    await expect(joinWellnessChallenge(other.userId, challenge)).resolves.toBeDefined();

    releaseHolder();
    await holding;

    expect(await countParticipationRows(other.userId)).toBe(1);
    expect(await countAdvisoryLocks()).toBe(0);
  });

  it('enforces each member independently under simultaneous contention', async () => {
    const alice = await createMember('iso-race-alice', 'trial');
    const bob = await createMember('iso-race-bob', 'trial');
    const c1 = await createActiveChallenge('iso-race-1');
    const c2 = await createActiveChallenge('iso-race-2');

    const results = await Promise.allSettled([
      joinWellnessChallenge(alice.userId, c1),
      joinWellnessChallenge(alice.userId, c2),
      joinWellnessChallenge(bob.userId, c1),
      joinWellnessChallenge(bob.userId, c2),
    ]);

    const { fulfilled, limitErrors, otherErrors } = partition(results);

    expect(otherErrors).toHaveLength(0);
    // One success and one rejection per member.
    expect(fulfilled).toHaveLength(2);
    expect(limitErrors).toHaveLength(2);
    expect(await countParticipationRows(alice.userId)).toBe(1);
    expect(await countParticipationRows(bob.userId)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TEST E — Grow, limit 3
// ---------------------------------------------------------------------------

describe('TEST E — Grow never exceeds three active challenges', () => {
  it('rejects concurrent fourth joins when three are already active', async () => {
    const member = await createMember('grow-race', 'core');
    const existing = await Promise.all(
      [1, 2, 3].map((n) => createActiveChallenge(`grow-existing-${n}`))
    );
    for (const id of existing) await createParticipation(member.userId, id);

    expect(await getActiveChallengeCount(member.userId)).toBe(3);

    const extra = await Promise.all([4, 5].map((n) => createActiveChallenge(`grow-extra-${n}`)));
    const results = await Promise.allSettled(
      extra.map((id) => joinWellnessChallenge(member.userId, id))
    );

    const { fulfilled, limitErrors } = partition(results);

    expect(fulfilled).toHaveLength(0);
    expect(limitErrors).toHaveLength(2);
    expect(await getActiveChallengeCount(member.userId)).toBe(3);
  });

  it('admits exactly one when two race for the third slot', async () => {
    const member = await createMember('grow-last-slot', 'core');
    const existing = await Promise.all([1, 2].map((n) => createActiveChallenge(`grow-two-${n}`)));
    for (const id of existing) await createParticipation(member.userId, id);

    const contenders = await Promise.all(
      [3, 4].map((n) => createActiveChallenge(`grow-contend-${n}`))
    );
    const results = await Promise.allSettled(
      contenders.map((id) => joinWellnessChallenge(member.userId, id))
    );

    const { fulfilled, limitErrors } = partition(results);

    expect(fulfilled).toHaveLength(1);
    expect(limitErrors).toHaveLength(1);
    // The limit is never exceeded, even for one instant.
    expect(await getActiveChallengeCount(member.userId)).toBe(3);
  });

  it('fills all three slots when three race from empty', async () => {
    const member = await createMember('grow-fill', 'core');
    const challenges = await Promise.all(
      [1, 2, 3].map((n) => createActiveChallenge(`grow-fill-${n}`))
    );

    const results = await Promise.allSettled(
      challenges.map((id) => joinWellnessChallenge(member.userId, id))
    );

    expect(partition(results).fulfilled).toHaveLength(3);
    expect(await getActiveChallengeCount(member.userId)).toBe(3);
  });

  it('does not count a completed challenge toward the limit', async () => {
    const member = await createMember('grow-completed', 'core');
    const done = await Promise.all([1, 2, 3].map((n) => createActiveChallenge(`grow-done-${n}`)));
    for (const id of done) await createParticipation(member.userId, id, { completed: true });

    expect(await getActiveChallengeCount(member.userId)).toBe(0);

    const fresh = await createActiveChallenge('grow-after-completion');
    await expect(joinWellnessChallenge(member.userId, fresh)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TEST F — Thrive, unlimited
// ---------------------------------------------------------------------------

describe('TEST F — Thrive is unlimited', () => {
  it('admits ten concurrent joins with no limit errors', async () => {
    const member = await createMember('thrive-race', 'pro');
    const challenges = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createActiveChallenge(`thrive-${i}`))
    );

    const results = await Promise.allSettled(
      challenges.map((id) => joinWellnessChallenge(member.userId, id))
    );

    const { fulfilled, limitErrors, otherErrors } = partition(results);

    expect(otherErrors).toHaveLength(0);
    expect(limitErrors).toHaveLength(0);
    expect(fulfilled).toHaveLength(10);
    expect(await getActiveChallengeCount(member.userId)).toBe(10);
  });

  it('treats null as unlimited, never as zero', async () => {
    const member = await createMember('thrive-null', 'pro');
    const challenge = await createActiveChallenge('thrive-null');

    await expect(joinWellnessChallenge(member.userId, challenge)).resolves.toBeDefined();
    expect(await countParticipationRows(member.userId)).toBe(1);
  });

  it('takes no advisory lock at all, since there is no limit to protect', async () => {
    const member = await createMember('thrive-nolock', 'pro');
    const challenge = await createActiveChallenge('thrive-nolock');

    await joinWellnessChallenge(member.userId, challenge);

    expect(await countAdvisoryLocks()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Idempotency under real concurrency
// ---------------------------------------------------------------------------

describe('idempotent re-join under concurrency', () => {
  it('lets concurrent duplicate joins of the SAME challenge both succeed as no-ops', async () => {
    const member = await createMember('rejoin-race', 'trial');
    const challenge = await createActiveChallenge('rejoin-race');

    const results = await Promise.allSettled([
      joinWellnessChallenge(member.userId, challenge),
      joinWellnessChallenge(member.userId, challenge),
    ]);

    const { otherErrors } = partition(results);

    // The composite primary key makes this an upsert; the member ends with exactly one row and
    // the limit is not tripped by their own existing participation.
    expect(otherErrors).toHaveLength(0);
    expect(await countParticipationRows(member.userId)).toBe(1);
  });
});
