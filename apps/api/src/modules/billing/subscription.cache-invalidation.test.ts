/**
 * PHASE 1B — canonical subscription cache invalidation.
 *
 * `getSubscription` memoizes per user for 30s. Every membership writer inside the billing module
 * self-invalidates; `admin.service.applyUserSubscriptionPlan` writes the `subscriptions` row from
 * outside and previously could not, because the invalidator was module-private.
 *
 * Now that membership is an authorization input, a 30s stale read is an access-control problem,
 * not a display lag. These tests pin the exposed invalidator's behaviour and its narrowness.
 */

const mockPrisma = {
  subscriptions: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  profiles: { findUnique: jest.fn(), update: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../config/stripe', () => ({ stripe: {} }));

import {
  getSubscription,
  invalidateUserSubscriptionCache,
} from './services/subscription.service';

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

let seq = 0;
function nextUserId(label: string) {
  seq += 1;
  return `cache-${label}-${seq}`;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSubscription caching', () => {
  it('serves a repeat read from cache without touching the database', async () => {
    const userId = nextUserId('cached');
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: FUTURE,
    });

    await getSubscription(userId);
    await getSubscription(userId);

    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledTimes(1);
  });

  it('would otherwise serve a stale membership after an out-of-module write', async () => {
    const userId = nextUserId('stale');
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: FUTURE,
    });
    await getSubscription(userId);

    // Simulate the admin rewriting the row directly, as applyUserSubscriptionPlan does.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'pro',
      status: 'active',
      end_date: FUTURE,
    });

    // Without invalidation the cache still answers with the pre-change membership.
    expect((await getSubscription(userId))?.plan_type).toBe('trial');
  });
});

describe('invalidateUserSubscriptionCache', () => {
  it('forces the next read to hit the database and observe the new membership', async () => {
    const userId = nextUserId('invalidated');
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: FUTURE,
    });
    await getSubscription(userId);

    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'pro',
      status: 'active',
      end_date: FUTURE,
    });

    invalidateUserSubscriptionCache(userId);

    expect((await getSubscription(userId))?.plan_type).toBe('pro');
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledTimes(2);
  });

  it('only affects the named user', async () => {
    const target = nextUserId('target');
    const bystander = nextUserId('bystander');
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'core',
      status: 'active',
      end_date: FUTURE,
    });

    await getSubscription(target);
    await getSubscription(bystander);
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledTimes(2);

    invalidateUserSubscriptionCache(target);

    await getSubscription(bystander); // still cached
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledTimes(2);

    await getSubscription(target); // re-reads
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledTimes(3);
  });

  it('is safe to call for a user with nothing cached', () => {
    expect(() => invalidateUserSubscriptionCache(nextUserId('uncached'))).not.toThrow();
  });

  it('returns nothing, exposing no cache internals to callers', () => {
    expect(invalidateUserSubscriptionCache(nextUserId('surface'))).toBeUndefined();
  });
});
