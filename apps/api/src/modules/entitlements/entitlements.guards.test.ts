/**
 * Membership Entitlements V1 — authorization helper tests.
 *
 * The guards are pure functions over a resolved entitlements object, so these tests build that
 * object through the real resolver rather than hand-rolling a fixture — a guard test that passes
 * against a fake shape would prove nothing about the engine.
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
  EntitlementError,
  assertChallengeAccess,
  assertMembership,
  assertMembershipForUser,
  hasChallengeAccess,
  hasEntitlement,
  hasEntitlementForUser,
  hasFeatureFlag,
  hasMembership,
  requireEntitlement,
  requireEntitlementForUser,
} from './entitlements.guards';
import { resolveEntitlements } from './entitlements.resolver';
import type { EntitlementFacts, MembershipEntitlements } from './entitlements.types';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const USER_ID = 'user-guards';

function entitlementsFor(overrides: Partial<EntitlementFacts> = {}): MembershipEntitlements {
  return resolveEntitlements({
    userId: USER_ID,
    internalPlanType: 'trial',
    subscriptionStatus: 'active',
    subscriptionEndDate: null,
    remainingSeconds: 1800,
    now: NOW,
    ...overrides,
  });
}

const discover = entitlementsFor({ internalPlanType: 'trial' });
const grow = entitlementsFor({ internalPlanType: 'core' });
const thrive = entitlementsFor({ internalPlanType: 'pro' });

// ---------------------------------------------------------------------------
// hasEntitlement / requireEntitlement
// ---------------------------------------------------------------------------

describe('hasEntitlement', () => {
  it('answers from the resolved capability', () => {
    expect(hasEntitlement(discover, 'canUseAI')).toBe(true);
    expect(hasEntitlement(discover, 'canExportReports')).toBe(false);
    expect(hasEntitlement(thrive, 'canExportReports')).toBe(true);
  });
});

describe('requireEntitlement', () => {
  it('passes silently when the capability is granted', () => {
    expect(() => requireEntitlement(thrive, 'canExportReports')).not.toThrow();
  });

  it('throws a 403 EntitlementError when the capability is denied', () => {
    try {
      requireEntitlement(discover, 'canExportReports');
      throw new Error('expected requireEntitlement to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError);
      const e = error as EntitlementError;
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe('ENTITLEMENT_DENIED');
      expect(e.capability).toBe('canExportReports');
      expect(e.membership).toBe('DISCOVER');
    }
  });

  it('names the membership that would grant the capability', () => {
    expect(() => requireEntitlement(discover, 'canExportReports')).toThrow(/Requires THRIVE/);
    expect(() => requireEntitlement(discover, 'canViewInsights')).toThrow(/Requires GROW/);
  });

  it('explains an empty wallet as a balance problem, not an upsell', () => {
    const drained = entitlementsFor({ internalPlanType: 'pro', remainingSeconds: 0 });

    try {
      requireEntitlement(drained, 'canUseAI');
      throw new Error('expected requireEntitlement to throw');
    } catch (error) {
      const e = error as EntitlementError;
      expect(e.message).toMatch(/No remaining minutes/);
      expect(e.restrictions.map((r) => r.code)).toContain('NO_MINUTES_REMAINING');
    }
  });

  it('explains an expired membership as expiry', () => {
    const expired = entitlementsFor({
      internalPlanType: 'trial',
      subscriptionEndDate: new Date('2026-07-01T00:00:00.000Z'),
    });

    try {
      requireEntitlement(expired, 'canCreateJournal');
      throw new Error('expected requireEntitlement to throw');
    } catch (error) {
      const e = error as EntitlementError;
      expect(e.restrictions.map((r) => r.code)).toContain('MEMBERSHIP_EXPIRED');
    }
  });

  it('honours an admin override that grants the capability', () => {
    const granted = entitlementsFor({
      internalPlanType: 'trial',
      override: { capabilities: { canExportReports: true } },
    });

    expect(() => requireEntitlement(granted, 'canExportReports')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertMembership
// ---------------------------------------------------------------------------

describe('hasMembership / assertMembership', () => {
  it('treats the floor as inclusive', () => {
    expect(hasMembership(grow, 'GROW')).toBe(true);
    expect(hasMembership(thrive, 'GROW')).toBe(true);
    expect(hasMembership(discover, 'GROW')).toBe(false);
  });

  it('passes silently at or above the floor', () => {
    expect(() => assertMembership(thrive, 'GROW')).not.toThrow();
    expect(() => assertMembership(grow, 'GROW')).not.toThrow();
  });

  it('throws a 403 naming both the required and the current membership', () => {
    try {
      assertMembership(discover, 'THRIVE');
      throw new Error('expected assertMembership to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError);
      const e = error as EntitlementError;
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe('MEMBERSHIP_REQUIRED');
      expect(e.message).toMatch(/THRIVE/);
      expect(e.message).toMatch(/DISCOVER/);
    }
  });

  it('reads the overridden membership, not the billing plan', () => {
    const overridden = entitlementsFor({
      internalPlanType: 'trial',
      override: { membership: 'THRIVE' },
    });

    expect(() => assertMembership(overridden, 'THRIVE')).not.toThrow();
  });

  it('still reports the expired tier by name, since expiry does not downgrade the label', () => {
    const expired = entitlementsFor({
      internalPlanType: 'pro',
      // A paid membership only expires via cancellation — a live `active` row with a stale date
      // is drift and stays entitled (see resolveMembershipStatus).
      subscriptionStatus: 'canceled',
      subscriptionEndDate: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(hasMembership(expired, 'THRIVE')).toBe(true);
    // Capability gates — not tier gates — are what enforce expiry.
    expect(hasEntitlement(expired, 'canUseAI')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Challenge access and feature flags
// ---------------------------------------------------------------------------

describe('challenge access guards', () => {
  it('compares challenge depth ordinally', () => {
    expect(hasChallengeAccess(thrive, 'CORE')).toBe(true);
    expect(hasChallengeAccess(grow, 'CORE')).toBe(true);
    expect(hasChallengeAccess(grow, 'FULL')).toBe(false);
    expect(hasChallengeAccess(discover, 'CORE')).toBe(false);
  });

  it('throws a 403 with the challenge code', () => {
    try {
      assertChallengeAccess(grow, 'FULL');
      throw new Error('expected assertChallengeAccess to throw');
    } catch (error) {
      const e = error as EntitlementError;
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe('CHALLENGE_ACCESS_REQUIRED');
    }
  });
});

describe('hasFeatureFlag', () => {
  it('reads flags from the resolved membership', () => {
    expect(hasFeatureFlag(thrive, 'prioritySupport')).toBe(true);
    expect(hasFeatureFlag(grow, 'prioritySupport')).toBe(false);
    expect(hasFeatureFlag(grow, 'avatarCustomization')).toBe(true);
  });

  it('reads an unknown flag as false rather than undefined', () => {
    expect(hasFeatureFlag(thrive, 'somethingNobodyDefined')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

describe('async guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.findUnique.mockResolvedValue({
      credits: 30,
      credits_seconds: 1800,
      purchased_credits: 0,
      purchased_credits_seconds: 0,
    });
  });

  it('resolves then allows, returning the entitlements for reuse', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'pro',
      status: 'active',
      end_date: null,
    });

    const result = await requireEntitlementForUser(USER_ID, 'canExportReports', { now: NOW });
    expect(result.membership).toBe('THRIVE');
  });

  it('resolves then denies', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: null,
    });

    await expect(requireEntitlementForUser(USER_ID, 'canExportReports', { now: NOW })).rejects.toBeInstanceOf(
      EntitlementError
    );
  });

  it('answers hasEntitlementForUser without throwing', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: null,
    });

    await expect(hasEntitlementForUser(USER_ID, 'canExportReports', { now: NOW })).resolves.toBe(
      false
    );
    await expect(hasEntitlementForUser(USER_ID, 'canUseAI', { now: NOW })).resolves.toBe(true);
  });

  it('asserts a membership floor for a user', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      plan_type: 'core',
      status: 'active',
      end_date: null,
    });

    await expect(assertMembershipForUser(USER_ID, 'GROW', { now: NOW })).resolves.toMatchObject({
      membership: 'GROW',
    });
    await expect(assertMembershipForUser(USER_ID, 'THRIVE', { now: NOW })).rejects.toBeInstanceOf(
      EntitlementError
    );
  });
});
