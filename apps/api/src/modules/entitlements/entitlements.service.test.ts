/**
 * Membership Entitlements V1 — fact-gathering tests.
 *
 * Covers the impure shell: which sources are read, how a missing profile is handled, the admin
 * override hook, and the cache-invalidation contract (entitlements are derived, never stored, so
 * they must follow their upstream sources on the very next read).
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn() },
};

const mockBilling = {
  getSubscription: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../billing/services/subscription.service', () => mockBilling);

import {
  getMembershipEntitlements,
  loadEntitlementFacts,
} from './entitlements.service';
import {
  clearEntitlementOverrideProvider,
  registerEntitlementOverrideProvider,
  hasEntitlementOverrideProvider,
  resolveEntitlementOverride,
} from './entitlements.overrides';

const USER_ID = 'user-entitlements';
const NOW = new Date('2026-07-28T12:00:00.000Z');

function profile(overrides: Record<string, number | null> = {}) {
  return {
    credits: 30,
    credits_seconds: 1800,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
    ...overrides,
  };
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    plan_type: 'core',
    status: 'active',
    end_date: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearEntitlementOverrideProvider();
  mockBilling.getSubscription.mockResolvedValue(subscription());
  mockPrisma.profiles.findUnique.mockResolvedValue(profile());
});

afterEach(() => {
  clearEntitlementOverrideProvider();
});

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

describe('loadEntitlementFacts', () => {
  it('reads membership through the canonical billing service, not a local subscriptions query', async () => {
    await loadEntitlementFacts(USER_ID, { now: NOW });

    expect(mockBilling.getSubscription).toHaveBeenCalledTimes(1);
    expect(mockBilling.getSubscription).toHaveBeenCalledWith(USER_ID);
  });

  it('reads only the balance columns from the profile', async () => {
    await loadEntitlementFacts(USER_ID, { now: NOW });

    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: {
        credits: true,
        credits_seconds: true,
        purchased_credits: true,
        purchased_credits_seconds: true,
      },
    });
  });

  it('carries the raw subscription fields through unmapped', async () => {
    const endDate = new Date('2026-09-01T00:00:00.000Z');
    mockBilling.getSubscription.mockResolvedValue(
      subscription({ plan_type: 'pro', status: 'past_due', end_date: endDate })
    );

    const facts = await loadEntitlementFacts(USER_ID, { now: NOW });

    expect(facts).toMatchObject({
      userId: USER_ID,
      internalPlanType: 'pro',
      subscriptionStatus: 'past_due',
      subscriptionEndDate: endDate,
      now: NOW,
    });
  });

  it('sums the subscription and purchased balance buckets', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(
      profile({
        credits: 0,
        credits_seconds: 600,
        purchased_credits: 0,
        purchased_credits_seconds: 300,
      })
    );

    const facts = await loadEntitlementFacts(USER_ID, { now: NOW });
    expect(facts.remainingSeconds).toBe(900);
  });

  it('defers to credit-balance.service for the minutes-vs-seconds reconciliation', async () => {
    // `resolveBucketSeconds` takes the MAX of the whole-minute and sub-minute columns per bucket,
    // so a lagging seconds column never reads as a lower balance. Entitlements must not
    // re-implement that rule — this pins that it is inherited, not duplicated.
    mockPrisma.profiles.findUnique.mockResolvedValue(
      profile({
        credits: 30, // 1800s
        credits_seconds: 600, // stale, lower
        purchased_credits: 0,
        purchased_credits_seconds: 300,
      })
    );

    const facts = await loadEntitlementFacts(USER_ID, { now: NOW });
    expect(facts.remainingSeconds).toBe(2100);
  });

  it('reads a missing subscription as null facts rather than throwing', async () => {
    mockBilling.getSubscription.mockResolvedValue(null);

    const facts = await loadEntitlementFacts(USER_ID, { now: NOW });

    expect(facts.internalPlanType).toBeNull();
    expect(facts.subscriptionStatus).toBeNull();
    expect(facts.subscriptionEndDate).toBeNull();
  });

  it('reads a missing profile as a zero balance rather than throwing', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(null);

    const facts = await loadEntitlementFacts(USER_ID, { now: NOW });
    expect(facts.remainingSeconds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-end resolution
// ---------------------------------------------------------------------------

describe('getMembershipEntitlements', () => {
  it('resolves a paid subscription to its membership', async () => {
    mockBilling.getSubscription.mockResolvedValue(subscription({ plan_type: 'pro' }));

    const result = await getMembershipEntitlements(USER_ID, { now: NOW });

    expect(result.membership).toBe('THRIVE');
    expect(result.status).toBe('ACTIVE');
    expect(result.canExportReports).toBe(true);
  });

  it('resolves a user with no subscription to active Discover', async () => {
    mockBilling.getSubscription.mockResolvedValue(null);

    const result = await getMembershipEntitlements(USER_ID, { now: NOW });

    expect(result.membership).toBe('DISCOVER');
    expect(result.status).toBe('NONE');
    expect(result.canUseAI).toBe(true);
  });

  it('resolves an expired trial to the locked baseline', async () => {
    mockBilling.getSubscription.mockResolvedValue(
      subscription({ plan_type: 'trial', status: 'active', end_date: new Date('2026-07-01T00:00:00.000Z') })
    );

    const result = await getMembershipEntitlements(USER_ID, { now: NOW });

    expect(result.status).toBe('EXPIRED');
    expect(result.canUseAI).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cache invalidation contract
// ---------------------------------------------------------------------------

describe('cache invalidation', () => {
  /**
   * Entitlements introduce no cache of their own. The contract these tests pin down is that a
   * change at the source is visible on the very next resolve — there is no entitlement-layer TTL
   * that could hold a stale answer past its upstream invalidation.
   */

  it('follows a membership change on the next resolve', async () => {
    mockBilling.getSubscription.mockResolvedValueOnce(subscription({ plan_type: 'trial' }));
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).membership).toBe('DISCOVER');

    mockBilling.getSubscription.mockResolvedValueOnce(subscription({ plan_type: 'pro' }));
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).membership).toBe('THRIVE');
  });

  it('follows a subscription status change on the next resolve', async () => {
    mockBilling.getSubscription.mockResolvedValueOnce(subscription({ status: 'active' }));
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).status).toBe('ACTIVE');

    mockBilling.getSubscription.mockResolvedValueOnce(subscription({ status: 'past_due' }));
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).status).toBe('PAST_DUE');
  });

  it('follows a credit change on the next resolve', async () => {
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).canUseAI).toBe(true);

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profile({ credits: 0, credits_seconds: 0, purchased_credits: 0, purchased_credits_seconds: 0 })
    );

    const drained = await getMembershipEntitlements(USER_ID, { now: NOW });
    expect(drained.canUseAI).toBe(false);
    expect(drained.remainingSeconds).toBe(0);
  });

  it('expires a trial from the clock alone, with no invalidation step', async () => {
    const endsAt = new Date('2026-07-28T12:00:00.000Z');
    mockBilling.getSubscription.mockResolvedValue(
      subscription({ plan_type: 'trial', status: 'active', end_date: endsAt })
    );

    const before = await getMembershipEntitlements(USER_ID, {
      now: new Date('2026-07-28T11:59:59.000Z'),
    });
    const after = await getMembershipEntitlements(USER_ID, {
      now: new Date('2026-07-28T12:00:01.000Z'),
    });

    expect(before.status).toBe('ACTIVE');
    expect(after.status).toBe('EXPIRED');
  });

  it('re-reads both sources on every resolve rather than memoizing', async () => {
    await getMembershipEntitlements(USER_ID, { now: NOW });
    await getMembershipEntitlements(USER_ID, { now: NOW });

    expect(mockBilling.getSubscription).toHaveBeenCalledTimes(2);
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(2);
  });

  it('follows an admin membership change on the next resolve', async () => {
    // Mirrors `admin.service.applyUserSubscriptionPlan`: the subscriptions row is rewritten,
    // and entitlements pick that up because they hold no copy of it.
    mockBilling.getSubscription.mockResolvedValueOnce(subscription({ plan_type: 'trial' }));
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).canViewInsights).toBe(false);

    mockBilling.getSubscription.mockResolvedValueOnce(subscription({ plan_type: 'core' }));
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).canViewInsights).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Admin override hook
// ---------------------------------------------------------------------------

describe('admin override hook', () => {
  it('applies no override when no provider is registered', async () => {
    expect(hasEntitlementOverrideProvider()).toBe(false);

    const result = await getMembershipEntitlements(USER_ID, { now: NOW });
    expect(result.source.overrideApplied).toBe(false);
    expect(result.membership).toBe('GROW');
  });

  it('applies an override supplied by a registered provider', async () => {
    registerEntitlementOverrideProvider(() => ({ membership: 'THRIVE', reason: 'support grant' }));

    const result = await getMembershipEntitlements(USER_ID, { now: NOW });

    expect(result.membership).toBe('THRIVE');
    expect(result.source.overrideApplied).toBe(true);
  });

  it('passes the user id to the provider', async () => {
    const provider = jest.fn().mockResolvedValue(null);
    registerEntitlementOverrideProvider(provider);

    await getMembershipEntitlements(USER_ID, { now: NOW });

    expect(provider).toHaveBeenCalledWith(USER_ID);
  });

  it('degrades to no override when the provider throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    registerEntitlementOverrideProvider(() => {
      throw new Error('override store unavailable');
    });

    const result = await getMembershipEntitlements(USER_ID, { now: NOW });

    // A broken override store must never deny a member their real membership.
    expect(result.membership).toBe('GROW');
    expect(result.source.overrideApplied).toBe(false);
    warn.mockRestore();
  });

  it('degrades to no override when the provider rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    registerEntitlementOverrideProvider(async () => {
      throw new Error('timeout');
    });

    await expect(resolveEntitlementOverride(USER_ID)).resolves.toBeNull();
    warn.mockRestore();
  });

  it('skips the provider when asked', async () => {
    const provider = jest.fn().mockReturnValue({ membership: 'THRIVE' });
    registerEntitlementOverrideProvider(provider);

    const result = await getMembershipEntitlements(USER_ID, { now: NOW, skipOverride: true });

    expect(provider).not.toHaveBeenCalled();
    expect(result.membership).toBe('GROW');
  });

  it('lets an explicit override argument bypass the provider', async () => {
    const provider = jest.fn().mockReturnValue({ membership: 'DISCOVER' });
    registerEntitlementOverrideProvider(provider);

    const result = await getMembershipEntitlements(USER_ID, {
      now: NOW,
      override: { membership: 'THRIVE' },
    });

    expect(provider).not.toHaveBeenCalled();
    expect(result.membership).toBe('THRIVE');
  });

  it('replaces a previously registered provider', async () => {
    registerEntitlementOverrideProvider(() => ({ membership: 'DISCOVER' }));
    registerEntitlementOverrideProvider(() => ({ membership: 'THRIVE' }));

    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).membership).toBe('THRIVE');
  });

  it('clears the provider', async () => {
    registerEntitlementOverrideProvider(() => ({ membership: 'THRIVE' }));
    clearEntitlementOverrideProvider();

    expect(hasEntitlementOverrideProvider()).toBe(false);
    expect((await getMembershipEntitlements(USER_ID, { now: NOW })).membership).toBe('GROW');
  });
});
