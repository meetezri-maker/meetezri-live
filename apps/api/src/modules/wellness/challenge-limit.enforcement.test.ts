/**
 * PHASE 2A — active-challenge limit enforcement.
 *
 * Covers the approved policy (DISCOVER 1 / GROW 3 / THRIVE unlimited) end to end through
 * `joinWellnessChallenge`, plus the transaction/lock ordering that makes it race-safe.
 *
 * The transaction mock records the ORDER of operations, because ordering is the whole safety
 * argument: the advisory lock must be taken before the count is read, and the write must not
 * happen when the limit is reached.
 */

const txCalls: string[] = [];

const mockTx = {
  user_challenge_participation: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
};

const mockPrisma = {
  wellness_challenges: { findUnique: jest.fn(), findMany: jest.fn() },
  user_challenge_participation: { upsert: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
  profiles: { findUnique: jest.fn() },
  subscriptions: { findFirst: jest.fn() },
  mood_entries: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(async (fn: any) => fn(mockTx)),
};

const mockBilling = { getSubscription: jest.fn() };

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../billing/services/subscription.service', () => mockBilling);
jest.mock('../system-achievements/system-achievements.triggers', () => ({
  onUserActivity: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../lib/sharedCache', () => ({
  sharedDel: jest.fn(),
  sharedGetJson: jest.fn().mockResolvedValue(null),
  sharedSetJson: jest.fn(),
}));

import { joinWellnessChallenge } from './wellness.service';
import { ActiveChallengeLimitError } from './challenge-limit.error';

const CHALLENGE_ID = 'challenge-1';

let seq = 0;
/** `getSubscription` memoizes per user for 30s. */
function nextUserId(label: string) {
  seq += 1;
  return `limit-${label}-${seq}`;
}

/** Arrange membership + how many challenges the member currently has active. */
function arrange(planType: string | null, activeCount: number, alreadyJoined = false) {
  mockPrisma.wellness_challenges.findUnique.mockResolvedValue({
    id: CHALLENGE_ID,
    title: 'A challenge',
  });
  mockBilling.getSubscription.mockResolvedValue(
    planType ? { plan_type: planType, status: 'active', end_date: null } : null
  );
  mockPrisma.profiles.findUnique.mockResolvedValue({
    credits: 100,
    credits_seconds: 6000,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
  });

  mockTx.$executeRaw.mockImplementation(async () => {
    txCalls.push('lock');
    return 1;
  });
  mockTx.user_challenge_participation.findUnique.mockImplementation(async () => {
    txCalls.push('idempotency-check');
    return alreadyJoined ? { user_id: 'u', challenge_id: CHALLENGE_ID } : null;
  });
  mockTx.$queryRaw.mockImplementation(async () => {
    txCalls.push('count');
    return [{ count: BigInt(activeCount) }];
  });
  mockTx.user_challenge_participation.upsert.mockImplementation(async () => {
    txCalls.push('write');
    return { user_id: 'u', challenge_id: CHALLENGE_ID, is_completed: false };
  });
  mockPrisma.user_challenge_participation.upsert.mockImplementation(async () => {
    txCalls.push('write-unlimited');
    return { user_id: 'u', challenge_id: CHALLENGE_ID, is_completed: false };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  txCalls.length = 0;
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
});

// ---------------------------------------------------------------------------
// DISCOVER — limit 1
// ---------------------------------------------------------------------------

describe('DISCOVER — maxActiveChallenges = 1', () => {
  it('allows the first active challenge', async () => {
    arrange('trial', 0);

    await expect(joinWellnessChallenge(nextUserId('d0'), CHALLENGE_ID)).resolves.toMatchObject({
      challenge_id: CHALLENGE_ID,
    });
    expect(txCalls).toContain('write');
  });

  it('rejects the second', async () => {
    arrange('trial', 1);

    await expect(joinWellnessChallenge(nextUserId('d1'), CHALLENGE_ID)).rejects.toBeInstanceOf(
      ActiveChallengeLimitError
    );
  });

  it('creates no partial record when rejected', async () => {
    arrange('trial', 1);

    await expect(joinWellnessChallenge(nextUserId('d-partial'), CHALLENGE_ID)).rejects.toThrow();

    expect(txCalls).not.toContain('write');
    expect(mockTx.user_challenge_participation.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.user_challenge_participation.upsert).not.toHaveBeenCalled();
  });

  it('carries the membership, cap, count and upgrade target', async () => {
    arrange('trial', 1);

    try {
      await joinWellnessChallenge(nextUserId('d-details'), CHALLENGE_ID);
      throw new Error('expected rejection');
    } catch (error) {
      const e = error as ActiveChallengeLimitError;
      expect(e.membership).toBe('DISCOVER');
      expect(e.limit).toBe(1);
      expect(e.activeCount).toBe(1);
      expect(e.upgradeMembership).toBe('GROW');
    }
  });

  it('rejects when the count somehow exceeds the cap', async () => {
    // Defensive: a member who was over the limit before enforcement existed must not be able to
    // add more. `>=` rather than `===` is what guarantees this.
    arrange('trial', 5);

    await expect(joinWellnessChallenge(nextUserId('d-over'), CHALLENGE_ID)).rejects.toBeInstanceOf(
      ActiveChallengeLimitError
    );
  });
});

// ---------------------------------------------------------------------------
// GROW — limit 3
// ---------------------------------------------------------------------------

describe('GROW — maxActiveChallenges = 3', () => {
  it.each([0, 1, 2])('allows the next challenge at %i active', async (count) => {
    arrange('core', count);

    await expect(joinWellnessChallenge(nextUserId(`g${count}`), CHALLENGE_ID)).resolves.toBeDefined();
    expect(txCalls).toContain('write');
  });

  it('rejects the fourth', async () => {
    arrange('core', 3);

    await expect(joinWellnessChallenge(nextUserId('g3'), CHALLENGE_ID)).rejects.toBeInstanceOf(
      ActiveChallengeLimitError
    );
  });

  it('reports GROW with a cap of 3 and THRIVE as the upgrade', async () => {
    arrange('core', 3);

    try {
      await joinWellnessChallenge(nextUserId('g-details'), CHALLENGE_ID);
      throw new Error('expected rejection');
    } catch (error) {
      const e = error as ActiveChallengeLimitError;
      expect(e.membership).toBe('GROW');
      expect(e.limit).toBe(3);
      expect(e.upgradeMembership).toBe('THRIVE');
    }
  });
});

// ---------------------------------------------------------------------------
// THRIVE — unlimited
// ---------------------------------------------------------------------------

describe('THRIVE — maxActiveChallenges = null (unlimited)', () => {
  it('allows a join with many already active', async () => {
    arrange('pro', 99);

    await expect(joinWellnessChallenge(nextUserId('t99'), CHALLENGE_ID)).resolves.toBeDefined();
  });

  it('treats null as unlimited, never as zero', async () => {
    arrange('pro', 0);

    await expect(joinWellnessChallenge(nextUserId('t0'), CHALLENGE_ID)).resolves.toBeDefined();
    expect(mockPrisma.user_challenge_participation.upsert).toHaveBeenCalled();
  });

  it('skips the transaction, lock and count entirely', async () => {
    arrange('pro', 50);

    await joinWellnessChallenge(nextUserId('t-cheap'), CHALLENGE_ID);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(txCalls).toEqual(['write-unlimited']);
  });
});

// ---------------------------------------------------------------------------
// Membership and lifecycle states
// ---------------------------------------------------------------------------

describe('membership and lifecycle states', () => {
  it('missing subscription resolves to DISCOVER and its limit of 1', async () => {
    arrange(null, 1);

    await expect(joinWellnessChallenge(nextUserId('no-sub'), CHALLENGE_ID)).rejects.toMatchObject({
      membership: 'DISCOVER',
      limit: 1,
    });
  });

  it('unknown plan follows the canonical DISCOVER fallback', async () => {
    arrange('enterprise', 1);

    await expect(joinWellnessChallenge(nextUserId('unknown'), CHALLENGE_ID)).rejects.toMatchObject({
      membership: 'DISCOVER',
    });
  });

  it('cancelled but still in-period paid membership keeps its paid limit', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'pro',
      status: 'canceled',
      end_date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    arrange('pro', 10);
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'pro',
      status: 'canceled',
      end_date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    await expect(joinWellnessChallenge(nextUserId('cancel-in-period'), CHALLENGE_ID)).resolves.toBeDefined();
  });

  it('past_due paid membership keeps its paid limit', async () => {
    arrange('core', 2);
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'core',
      status: 'past_due',
      end_date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    await expect(joinWellnessChallenge(nextUserId('past-due'), CHALLENGE_ID)).resolves.toBeDefined();
  });

  it('expired Discover keeps the APPROVED limit of 1, not the provisional expiry collapse', async () => {
    arrange('trial', 0);
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });

    // The resolver collapses `maxActiveChallenges` to 0 on expiry, but that part of the expired
    // baseline is PROVISIONAL. Enforcing it would restrict expired members from a feature that
    // is unrestricted today, on a rule product never approved.
    await expect(joinWellnessChallenge(nextUserId('expired-first'), CHALLENGE_ID)).resolves.toBeDefined();
  });

  it('expired Discover is still held to 1, not given unlimited', async () => {
    arrange('trial', 1);
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });

    await expect(joinWellnessChallenge(nextUserId('expired-second'), CHALLENGE_ID)).rejects.toMatchObject({
      membership: 'DISCOVER',
      limit: 1,
    });
  });

  it('reflects an admin membership change once the subscription cache is invalidated', async () => {
    const userId = nextUserId('admin-change');
    arrange('trial', 1);

    await expect(joinWellnessChallenge(userId, CHALLENGE_ID)).rejects.toBeInstanceOf(
      ActiveChallengeLimitError
    );

    // Admin upgrades the member; `applyUserSubscriptionPlan` invalidates the cache (Phase 1B).
    const { invalidateUserSubscriptionCache } = require('../billing/services/subscription.service');
    if (typeof invalidateUserSubscriptionCache === 'function') invalidateUserSubscriptionCache(userId);
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'pro',
      status: 'active',
      end_date: null,
    });

    await expect(joinWellnessChallenge(userId, CHALLENGE_ID)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Idempotency and existing behaviour
// ---------------------------------------------------------------------------

describe('preserved existing behaviour', () => {
  it('still 404s for a missing challenge, before any membership work', async () => {
    mockPrisma.wellness_challenges.findUnique.mockResolvedValue(null);

    await expect(joinWellnessChallenge(nextUserId('404'), CHALLENGE_ID)).rejects.toThrow(
      'Challenge not found'
    );
    expect(mockBilling.getSubscription).not.toHaveBeenCalled();
  });

  it('re-joining a challenge the member is already in stays a no-op, even at the limit', async () => {
    // The row already counts toward the limit, so re-checking would reject an idempotent call.
    arrange('trial', 1, /* alreadyJoined */ true);

    await expect(joinWellnessChallenge(nextUserId('rejoin'), CHALLENGE_ID)).resolves.toBeDefined();
    expect(txCalls).toContain('write');
    expect(txCalls).not.toContain('count');
  });

  it('propagates a write failure and writes nothing', async () => {
    arrange('trial', 0);
    mockTx.user_challenge_participation.upsert.mockRejectedValue(new Error('db write failed'));

    await expect(joinWellnessChallenge(nextUserId('write-fail'), CHALLENGE_ID)).rejects.toThrow(
      'db write failed'
    );
  });
});

// ---------------------------------------------------------------------------
// Concurrency / transaction design
// ---------------------------------------------------------------------------

describe('transaction and concurrency design', () => {
  it('performs the whole check-and-write in one transaction', async () => {
    arrange('trial', 0);

    await joinWellnessChallenge(nextUserId('tx'), CHALLENGE_ID);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('takes the advisory lock BEFORE reading the count', async () => {
    arrange('trial', 0);

    await joinWellnessChallenge(nextUserId('lock-order'), CHALLENGE_ID);

    // This ordering is the entire race-safety argument: a count read before the lock could be
    // observed concurrently by a second request.
    expect(txCalls).toEqual(['lock', 'idempotency-check', 'count', 'write']);
  });

  it('scopes the advisory lock to the user and to this concern', async () => {
    arrange('trial', 0);
    const userId = nextUserId('lock-scope');

    await joinWellnessChallenge(userId, CHALLENGE_ID);

    const sqlArg = mockTx.$executeRaw.mock.calls[0][0];
    const values = (sqlArg as { values?: unknown[] }).values ?? [];
    expect(values).toContain(`challenge-participation:${userId}`);
    expect(String((sqlArg as { sql?: string }).sql)).toContain('pg_advisory_xact_lock');
  });

  it('resolves entitlements outside the transaction', async () => {
    arrange('trial', 0);
    let resolvedInsideTx = false;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const before = mockBilling.getSubscription.mock.calls.length;
      const result = await fn(mockTx);
      resolvedInsideTx = mockBilling.getSubscription.mock.calls.length > before;
      return result;
    });

    await joinWellnessChallenge(nextUserId('tx-scope'), CHALLENGE_ID);

    // Keeps the lock hold time short and keeps cache/network work out of the transaction.
    expect(resolvedInsideTx).toBe(false);
  });

  it('serializes two concurrent joins so the limit cannot be exceeded', async () => {
    const userId = nextUserId('concurrent');
    arrange('trial', 0);

    // Model the lock: the second transaction cannot enter until the first commits, and by then
    // the first join is visible to the count.
    let committedActive = 0;
    let lockHeld: Promise<void> | null = null;

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      while (lockHeld) await lockHeld;
      let release!: () => void;
      lockHeld = new Promise<void>((r) => {
        release = () => {
          lockHeld = null;
          r();
        };
      });
      try {
        mockTx.$queryRaw.mockImplementation(async () => [{ count: BigInt(committedActive) }]);
        const result = await fn(mockTx);
        committedActive += 1; // commit
        return result;
      } finally {
        release();
      }
    });

    const results = await Promise.allSettled([
      joinWellnessChallenge(userId, 'challenge-a'),
      joinWellnessChallenge(userId, 'challenge-b'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ActiveChallengeLimitError);
  });
});
