/**
 * Membership Entitlements V1 — resolver unit tests.
 *
 * The resolver is pure, so these tests need no mocks at all: facts in, entitlements out. The
 * clock is an injected fact, which is what makes every expiry branch deterministic.
 */

import {
  lowestMembershipGranting,
  mapInternalPlanToMembership,
  resolveEntitlements,
  resolveMembershipStatus,
  isAtLeastMembership,
  isAtLeastChallengeAccess,
} from './entitlements.resolver';
import {
  MEMBERSHIP_TIER_MATRIX,
  ENTITLEMENT_POLICY_STATUS,
  getPolicyStatus,
  assertEnforceable,
} from './entitlements.config';
import {
  ENTITLEMENT_CAPABILITIES,
  MEMBERSHIP_TIERS,
  type EntitlementFacts,
  type MembershipEntitlements,
} from './entitlements.types';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const PAST = new Date('2026-07-01T00:00:00.000Z');
const FUTURE = new Date('2026-12-31T00:00:00.000Z');

function facts(overrides: Partial<EntitlementFacts> = {}): EntitlementFacts {
  return {
    userId: 'user-1',
    internalPlanType: 'trial',
    subscriptionStatus: 'active',
    subscriptionEndDate: null,
    remainingSeconds: 1800,
    now: NOW,
    ...overrides,
  };
}

function codes(result: MembershipEntitlements): string[] {
  return result.restrictions.map((r) => r.code);
}

// ---------------------------------------------------------------------------
// Plan → membership mapping
// ---------------------------------------------------------------------------

describe('mapInternalPlanToMembership', () => {
  it('maps the three billing plan values to the three memberships', () => {
    expect(mapInternalPlanToMembership('trial')).toEqual({
      membership: 'DISCOVER',
      recognized: true,
    });
    expect(mapInternalPlanToMembership('core')).toEqual({ membership: 'GROW', recognized: true });
    expect(mapInternalPlanToMembership('pro')).toEqual({ membership: 'THRIVE', recognized: true });
  });

  it('tolerates casing and surrounding whitespace on the unconstrained plan_type column', () => {
    expect(mapInternalPlanToMembership('  Core ').membership).toBe('GROW');
    expect(mapInternalPlanToMembership('PRO').membership).toBe('THRIVE');
  });

  it('accepts product vocabulary as well as billing vocabulary', () => {
    expect(mapInternalPlanToMembership('thrive')).toEqual({
      membership: 'THRIVE',
      recognized: true,
    });
  });

  it('falls back to DISCOVER and flags the plan as unrecognized', () => {
    for (const value of ['enterprise', '', '   ', null, undefined]) {
      expect(mapInternalPlanToMembership(value as string)).toEqual({
        membership: 'DISCOVER',
        recognized: false,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Status normalization
// ---------------------------------------------------------------------------

describe('resolveMembershipStatus', () => {
  it('maps active and trialing without an end date', () => {
    expect(resolveMembershipStatus('active', null, NOW)).toBe('ACTIVE');
    expect(resolveMembershipStatus('trialing', null, NOW)).toBe('TRIALING');
  });

  it('maps a DISCOVER active/trialing row past its end date to EXPIRED', () => {
    expect(resolveMembershipStatus('active', PAST, NOW, 'DISCOVER')).toBe('EXPIRED');
    expect(resolveMembershipStatus('trialing', PAST, NOW, 'DISCOVER')).toBe('EXPIRED');
  });

  it('does NOT expire a live paid row with a stale end date', () => {
    // Reproduces `assertSessionStartAllowed`, which checks trial expiry only when the member has
    // no active paid row. An `active` paid row with a past date is webhook drift, not a lapse —
    // a genuine paid lapse arrives from Stripe as `canceled`/`past_due`.
    expect(resolveMembershipStatus('active', PAST, NOW, 'GROW')).toBe('ACTIVE');
    expect(resolveMembershipStatus('active', PAST, NOW, 'THRIVE')).toBe('ACTIVE');
    expect(resolveMembershipStatus('trialing', PAST, NOW, 'THRIVE')).toBe('TRIALING');
  });

  it('keeps active/trialing entitled while the end date is still ahead', () => {
    expect(resolveMembershipStatus('active', FUTURE, NOW, 'DISCOVER')).toBe('ACTIVE');
    expect(resolveMembershipStatus('trialing', FUTURE, NOW, 'DISCOVER')).toBe('TRIALING');
  });

  it('treats an end date exactly at now as NOT expired, matching both production paths', () => {
    // `sessions.service` uses `now > end_date`; `getSubscription` uses `end_date < now`. Both are
    // strict, so equality must not expire.
    expect(resolveMembershipStatus('active', new Date(NOW), NOW, 'DISCOVER')).toBe('ACTIVE');
    expect(resolveMembershipStatus('canceled', new Date(NOW), NOW, 'THRIVE')).toBe('CANCELED');
  });

  it('expires a cancelled row uniformly across tiers, matching getSubscription', () => {
    expect(resolveMembershipStatus('canceled', PAST, NOW, 'DISCOVER')).toBe('EXPIRED');
    expect(resolveMembershipStatus('canceled', PAST, NOW, 'THRIVE')).toBe('EXPIRED');
  });

  it('defaults the membership argument to DISCOVER', () => {
    expect(resolveMembershipStatus('active', PAST, NOW)).toBe('EXPIRED');
  });

  it('distinguishes cancelled-in-period from cancelled-and-over, for both spellings', () => {
    expect(resolveMembershipStatus('canceled', FUTURE, NOW)).toBe('CANCELED');
    expect(resolveMembershipStatus('cancelled', FUTURE, NOW)).toBe('CANCELED');
    expect(resolveMembershipStatus('canceled', PAST, NOW)).toBe('EXPIRED');
    expect(resolveMembershipStatus('cancelled', PAST, NOW)).toBe('EXPIRED');
  });

  it('maps past_due to its own status rather than to expired', () => {
    expect(resolveMembershipStatus('past_due', null, NOW)).toBe('PAST_DUE');
  });

  it('maps incomplete states and absent/unknown statuses to NONE', () => {
    expect(resolveMembershipStatus('incomplete', null, NOW)).toBe('NONE');
    expect(resolveMembershipStatus('incomplete_expired', null, NOW)).toBe('NONE');
    expect(resolveMembershipStatus(null, null, NOW)).toBe('NONE');
    expect(resolveMembershipStatus('', null, NOW)).toBe('NONE');
    expect(resolveMembershipStatus('paused', null, NOW)).toBe('NONE');
    expect(resolveMembershipStatus('unpaid', null, NOW)).toBe('NONE');
  });

  it('ignores an invalid end date rather than treating it as expiry', () => {
    expect(resolveMembershipStatus('active', new Date('nonsense'), NOW)).toBe('ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// Tier baselines
// ---------------------------------------------------------------------------

describe('resolveEntitlements — DISCOVER', () => {
  const result = resolveEntitlements(facts({ internalPlanType: 'trial' }));

  it('resolves the Discover membership and an active status', () => {
    expect(result.membership).toBe('DISCOVER');
    expect(result.status).toBe('ACTIVE');
  });

  it('grants AI and capture features but not paid-tier analysis', () => {
    expect(result.canUseAI).toBe(true);
    expect(result.canCreateJournal).toBe(true);
    expect(result.canUseMoodTracking).toBe(true);
    expect(result.canUseSleepTracking).toBe(true);
    expect(result.canUseCommunity).toBe(true);
    expect(result.canUseBrainHealth).toBe(false);
    expect(result.canViewInsights).toBe(false);
    expect(result.canExportReports).toBe(false);
  });

  it('blocks pay-as-you-go, matching PLAN_LIMITS.trial.payAsYouGoRate === null', () => {
    expect(result.canPurchaseMinutes).toBe(false);
    expect(codes(result)).toContain('PAYG_REQUIRES_PAID_MEMBERSHIP');
  });

  it('publishes the Discover challenge and history limits', () => {
    expect(result.challengeAccessLevel).toBe('NONE');
    // APPROVED (Phase 1B): one active challenge, corrected from the Phase 1 value of 0.
    expect(result.maxActiveChallenges).toBe(1);
    expect(result.historyWindow).toEqual({ days: 7 });
  });

  it('names the cheapest membership that fixes each denied capability', () => {
    const byCapability = Object.fromEntries(
      result.upgradeReasons.map((r) => [r.capability, r.requiredMembership])
    );
    expect(byCapability).toEqual({
      canPurchaseMinutes: 'GROW',
      canUseBrainHealth: 'GROW',
      canViewInsights: 'GROW',
      canExportReports: 'THRIVE',
    });
  });
});

describe('resolveEntitlements — GROW', () => {
  const result = resolveEntitlements(facts({ internalPlanType: 'core' }));

  it('resolves the Grow membership', () => {
    expect(result.membership).toBe('GROW');
  });

  it('unlocks pay-as-you-go, brain health and insights', () => {
    expect(result.canPurchaseMinutes).toBe(true);
    expect(result.canUseBrainHealth).toBe(true);
    expect(result.canViewInsights).toBe(true);
  });

  it('still withholds report export, which is a Thrive benefit', () => {
    expect(result.canExportReports).toBe(false);
    expect(result.upgradeReasons).toEqual([
      { capability: 'canExportReports', currentMembership: 'GROW', requiredMembership: 'THRIVE' },
    ]);
  });

  it('publishes the Grow challenge and history limits', () => {
    expect(result.challengeAccessLevel).toBe('CORE');
    expect(result.maxActiveChallenges).toBe(3);
    expect(result.historyWindow).toEqual({ days: 30 });
  });

  it('carries the Grow feature flags', () => {
    expect(result.featureFlags.usageDashboard).toBe(true);
    expect(result.featureFlags.avatarCustomization).toBe(true);
    expect(result.featureFlags.fullWellnessLibrary).toBe(false);
    expect(result.featureFlags.prioritySupport).toBe(false);
  });
});

describe('resolveEntitlements — THRIVE', () => {
  const result = resolveEntitlements(facts({ internalPlanType: 'pro' }));

  it('resolves the Thrive membership and grants every capability', () => {
    expect(result.membership).toBe('THRIVE');
    for (const capability of ENTITLEMENT_CAPABILITIES) {
      expect(result[capability]).toBe(true);
    }
  });

  it('has nothing left to upsell', () => {
    expect(result.upgradeReasons).toEqual([]);
    expect(codes(result)).toEqual([]);
  });

  it('publishes unlimited challenges and an unlimited history window', () => {
    expect(result.challengeAccessLevel).toBe('FULL');
    expect(result.maxActiveChallenges).toBeNull();
    expect(result.historyWindow).toEqual({ days: null });
  });

  it('carries the Thrive feature flags', () => {
    expect(result.featureFlags.fullWellnessLibrary).toBe(true);
    expect(result.featureFlags.detailedSessionLogs).toBe(true);
    expect(result.featureFlags.prioritySupport).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

describe('resolveEntitlements — expired Discover', () => {
  const result = resolveEntitlements(
    facts({ internalPlanType: 'trial', subscriptionStatus: 'active', subscriptionEndDate: PAST })
  );

  it('reports the membership it expired from, not a downgrade', () => {
    expect(result.membership).toBe('DISCOVER');
    expect(result.status).toBe('EXPIRED');
  });

  it('collapses to the locked baseline', () => {
    expect(result.canUseAI).toBe(false);
    expect(result.canCreateJournal).toBe(false);
    expect(result.canUseMoodTracking).toBe(false);
    expect(result.canUseSleepTracking).toBe(false);
    expect(result.canPurchaseMinutes).toBe(false);
    expect(result.challengeAccessLevel).toBe('NONE');
    expect(result.maxActiveChallenges).toBe(0);
  });

  it('keeps community reachable so an expired member is not isolated', () => {
    expect(result.canUseCommunity).toBe(true);
  });

  it('reports expiry and suppresses the PAYG upsell while expired', () => {
    expect(codes(result)).toContain('MEMBERSHIP_EXPIRED');
    expect(codes(result)).not.toContain('PAYG_REQUIRES_PAID_MEMBERSHIP');
  });
});

describe('resolveEntitlements — expired paid membership', () => {
  it('collapses Thrive the same way it collapses Discover, keeping the tier label', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', subscriptionStatus: 'canceled', subscriptionEndDate: PAST })
    );

    expect(result.membership).toBe('THRIVE');
    expect(result.status).toBe('EXPIRED');
    expect(result.canUseAI).toBe(false);
    expect(result.canViewInsights).toBe(false);
    expect(codes(result)).toContain('MEMBERSHIP_EXPIRED');
  });

  it('does not raise upgrade reasons for a Thrive member whose access merely lapsed', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', subscriptionStatus: 'canceled', subscriptionEndDate: PAST })
    );
    // Every denial is a degradation at the top tier, so nothing can be upsold.
    expect(result.upgradeReasons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle states
// ---------------------------------------------------------------------------

describe('resolveEntitlements — lifecycle states', () => {
  it('keeps a cancelled-but-in-period member fully entitled', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', subscriptionStatus: 'canceled', subscriptionEndDate: FUTURE })
    );
    expect(result.status).toBe('CANCELED');
    expect(result.canUseAI).toBe(true);
    expect(result.canExportReports).toBe(true);
  });

  it('keeps a past_due member entitled and records the grace period', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'core', subscriptionStatus: 'past_due' })
    );
    expect(result.status).toBe('PAST_DUE');
    expect(result.canUseAI).toBe(true);
    expect(result.canViewInsights).toBe(true);
    expect(codes(result)).toContain('PAYMENT_PAST_DUE');
  });

  it('keeps a trialing member on the full Discover baseline', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'trial', subscriptionStatus: 'trialing', subscriptionEndDate: FUTURE })
    );
    expect(result.status).toBe('TRIALING');
    expect(result.canUseAI).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Missing / unknown subscription
// ---------------------------------------------------------------------------

describe('resolveEntitlements — missing and unknown subscriptions', () => {
  it('treats a missing subscription as active Discover, matching every existing caller', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: null, subscriptionStatus: null, subscriptionEndDate: null })
    );

    expect(result.membership).toBe('DISCOVER');
    expect(result.status).toBe('NONE');
    // NONE must not degrade: this is the ordinary state of a fresh member.
    expect(result.canUseAI).toBe(true);
    expect(result.canCreateJournal).toBe(true);
    expect(codes(result)).not.toContain('MEMBERSHIP_EXPIRED');
  });

  it('falls back to Discover for an unknown plan and flags it for diagnostics', () => {
    const result = resolveEntitlements(facts({ internalPlanType: 'enterprise' }));

    expect(result.membership).toBe('DISCOVER');
    expect(result.source.planUnrecognized).toBe(true);
    expect(result.source.internalPlanType).toBe('enterprise');
  });

  it('does not flag a recognized plan as unrecognized', () => {
    expect(resolveEntitlements(facts({ internalPlanType: 'pro' })).source.planUnrecognized).toBe(
      false
    );
  });

  it('treats an incomplete checkout row as no membership rather than as access', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', subscriptionStatus: 'incomplete' })
    );
    expect(result.status).toBe('NONE');
    // The plan value still maps — status and tier are independent axes.
    expect(result.membership).toBe('THRIVE');
  });
});

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

describe('resolveEntitlements — remaining balance', () => {
  it('reports minutes with the same ceil rounding /users/me already uses', () => {
    expect(resolveEntitlements(facts({ remainingSeconds: 90 })).remainingMinutes).toBe(2);
    expect(resolveEntitlements(facts({ remainingSeconds: 1800 })).remainingMinutes).toBe(30);
    expect(resolveEntitlements(facts({ remainingSeconds: 0 })).remainingMinutes).toBe(0);
  });

  it('closes canUseAI at a zero balance without touching the rest of the membership', () => {
    const result = resolveEntitlements(facts({ internalPlanType: 'pro', remainingSeconds: 0 }));

    expect(result.canUseAI).toBe(false);
    expect(result.status).toBe('ACTIVE');
    expect(result.canViewInsights).toBe(true);
    expect(result.canPurchaseMinutes).toBe(true);
    expect(codes(result)).toContain('NO_MINUTES_REMAINING');
  });

  it('does not report an empty wallet as an upsell', () => {
    const result = resolveEntitlements(facts({ internalPlanType: 'pro', remainingSeconds: 0 }));
    expect(result.upgradeReasons.map((r) => r.capability)).not.toContain('canUseAI');
  });

  it('normalizes negative, fractional and non-finite balances', () => {
    expect(resolveEntitlements(facts({ remainingSeconds: -50 })).remainingSeconds).toBe(0);
    expect(resolveEntitlements(facts({ remainingSeconds: 90.7 })).remainingSeconds).toBe(90);
    expect(resolveEntitlements(facts({ remainingSeconds: NaN })).remainingSeconds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Admin overrides
// ---------------------------------------------------------------------------

describe('resolveEntitlements — admin overrides', () => {
  it('re-baselines the whole tier row when membership is overridden', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'trial', override: { membership: 'THRIVE', reason: 'support' } })
    );

    expect(result.membership).toBe('THRIVE');
    expect(result.canExportReports).toBe(true);
    expect(result.canViewInsights).toBe(true);
    expect(result.challengeAccessLevel).toBe('FULL');
    expect(result.historyWindow).toEqual({ days: null });
    expect(result.source.overrideApplied).toBe(true);
  });

  it('applies after expiry, so support can genuinely unblock an expired member', () => {
    const result = resolveEntitlements(
      facts({
        internalPlanType: 'trial',
        subscriptionStatus: 'active',
        subscriptionEndDate: PAST,
        override: { membership: 'GROW', status: 'ACTIVE' },
      })
    );

    expect(result.status).toBe('ACTIVE');
    expect(result.canUseAI).toBe(true);
    expect(result.canViewInsights).toBe(true);
    expect(codes(result)).not.toContain('MEMBERSHIP_EXPIRED');
  });

  it('grants entitlement but never minutes — an empty wallet still closes canUseAI', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'trial', remainingSeconds: 0, override: { membership: 'THRIVE' } })
    );

    expect(result.membership).toBe('THRIVE');
    expect(result.canExportReports).toBe(true);
    expect(result.canUseAI).toBe(false);
  });

  it('overrides individual capabilities without changing the membership', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'trial', override: { capabilities: { canExportReports: true } } })
    );

    expect(result.membership).toBe('DISCOVER');
    expect(result.canExportReports).toBe(true);
    expect(result.canViewInsights).toBe(false);
    expect(result.source.overrideApplied).toBe(true);
  });

  it('overrides challenge limits, history window and feature flags', () => {
    const result = resolveEntitlements(
      facts({
        internalPlanType: 'trial',
        override: {
          challengeAccessLevel: 'FULL',
          maxActiveChallenges: null,
          historyWindow: { days: 365 },
          featureFlags: { prioritySupport: true, betaAccess: true },
        },
      })
    );

    expect(result.challengeAccessLevel).toBe('FULL');
    expect(result.maxActiveChallenges).toBeNull();
    expect(result.historyWindow).toEqual({ days: 365 });
    expect(result.featureFlags.prioritySupport).toBe(true);
    expect(result.featureFlags.betaAccess).toBe(true);
  });

  it('can revoke as well as grant', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', override: { capabilities: { canUseCommunity: false } } })
    );

    expect(result.membership).toBe('THRIVE');
    expect(result.canUseCommunity).toBe(false);
  });

  it('rebuilds restrictions and upgrade reasons from the post-override values', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'trial', override: { capabilities: { canPurchaseMinutes: true } } })
    );

    expect(codes(result)).not.toContain('PAYG_REQUIRES_PAID_MEMBERSHIP');
    expect(result.upgradeReasons.map((r) => r.capability)).not.toContain('canPurchaseMinutes');
  });

  it('does not mark an override as applied when it changes nothing', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', override: { membership: 'THRIVE', reason: 'no-op' } })
    );
    expect(result.source.overrideApplied).toBe(false);
  });

  it('treats an absent override as no override', () => {
    expect(resolveEntitlements(facts({ override: null })).source.overrideApplied).toBe(false);
    expect(resolveEntitlements(facts({ override: undefined })).source.overrideApplied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Determinism, purity, diagnostics
// ---------------------------------------------------------------------------

describe('resolveEntitlements — determinism and purity', () => {
  it('returns identical results for identical facts', () => {
    const input = facts({ internalPlanType: 'core', subscriptionEndDate: FUTURE });
    expect(resolveEntitlements(input)).toEqual(resolveEntitlements(input));
  });

  it('never mutates the shared tier matrix', () => {
    const before = JSON.stringify(MEMBERSHIP_TIER_MATRIX);
    const result = resolveEntitlements(
      facts({ internalPlanType: 'pro', override: { capabilities: { canUseAI: false } } })
    );
    expect(result.canUseAI).toBe(false);
    expect(JSON.stringify(MEMBERSHIP_TIER_MATRIX)).toBe(before);
  });

  it('reads the clock only from the injected fact', () => {
    const early = resolveEntitlements(
      facts({ subscriptionEndDate: NOW, now: new Date('2026-07-01T00:00:00.000Z') })
    );
    const late = resolveEntitlements(
      facts({ subscriptionEndDate: NOW, now: new Date('2026-08-01T00:00:00.000Z') })
    );

    expect(early.status).toBe('ACTIVE');
    expect(late.status).toBe('EXPIRED');
  });

  it('carries the raw evidence it decided from', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'core', subscriptionStatus: 'past_due', subscriptionEndDate: FUTURE })
    );

    expect(result.source).toEqual({
      internalPlanType: 'core',
      internalStatus: 'past_due',
      subscriptionEndsAt: FUTURE.toISOString(),
      planUnrecognized: false,
      statusUnrecognized: false,
      overrideApplied: false,
      resolvedAt: NOW.toISOString(),
    });
  });
});

// ---------------------------------------------------------------------------
// Matrix-level invariants
// ---------------------------------------------------------------------------

describe('policy status ledger', () => {
  it('marks the approved challenge limits as enforceable', () => {
    expect(getPolicyStatus('maxActiveChallenges')).toBe('APPROVED');
    expect(() => assertEnforceable('maxActiveChallenges')).not.toThrow();
  });

  it('marks the two already-enforced gates as enforceable', () => {
    expect(getPolicyStatus('canUseAI')).toBe('ENFORCED');
    expect(getPolicyStatus('canPurchaseMinutes')).toBe('ENFORCED');
    expect(() => assertEnforceable('canUseAI')).not.toThrow();
    expect(() => assertEnforceable('canPurchaseMinutes')).not.toThrow();
  });

  it('blocks enforcement of every inferred dimension', () => {
    for (const dimension of [
      'canCreateJournal',
      'canUseMoodTracking',
      'canUseSleepTracking',
      'canUseBrainHealth',
      'canUseCommunity',
      'canViewInsights',
      'canExportReports',
      'challengeAccessLevel',
      'historyWindow',
    ]) {
      expect(getPolicyStatus(dimension)).toBe('PROVISIONAL');
      expect(() => assertEnforceable(dimension)).toThrow(/PROVISIONAL/);
    }
  });

  it('treats an unlisted dimension as provisional, so omission cannot read as approval', () => {
    expect(getPolicyStatus('somethingNobodyReviewed')).toBe('PROVISIONAL');
    expect(() => assertEnforceable('somethingNobodyReviewed')).toThrow();
  });

  it('accounts for every capability in the model', () => {
    for (const capability of ENTITLEMENT_CAPABILITIES) {
      expect(ENTITLEMENT_POLICY_STATUS[capability]).toBeDefined();
    }
  });
});

describe('approved challenge limits', () => {
  it('matches the Phase 1B policy exactly', () => {
    expect(MEMBERSHIP_TIER_MATRIX.DISCOVER.maxActiveChallenges).toBe(1);
    expect(MEMBERSHIP_TIER_MATRIX.GROW.maxActiveChallenges).toBe(3);
    expect(MEMBERSHIP_TIER_MATRIX.THRIVE.maxActiveChallenges).toBeNull();
  });
});

describe('unrecognized-value diagnostics', () => {
  it('flags an unknown status without inventing a membership', () => {
    const result = resolveEntitlements(facts({ subscriptionStatus: 'quantum_superposition' }));

    expect(result.source.statusUnrecognized).toBe(true);
    expect(result.status).toBe('NONE');
    // Unknown must not silently grant a higher tier.
    expect(result.membership).toBe('DISCOVER');
  });

  it('does not flag a recognized or absent status', () => {
    expect(resolveEntitlements(facts({ subscriptionStatus: 'past_due' })).source.statusUnrecognized).toBe(false);
    expect(resolveEntitlements(facts({ subscriptionStatus: null })).source.statusUnrecognized).toBe(false);
    expect(resolveEntitlements(facts({ subscriptionStatus: '  ' })).source.statusUnrecognized).toBe(false);
  });

  it('flags plan and status independently', () => {
    const result = resolveEntitlements(
      facts({ internalPlanType: 'platinum', subscriptionStatus: 'active' })
    );
    expect(result.source.planUnrecognized).toBe(true);
    expect(result.source.statusUnrecognized).toBe(false);
  });
});

describe('tier matrix invariants', () => {
  it('defines every capability on every membership', () => {
    for (const tier of MEMBERSHIP_TIERS) {
      for (const capability of ENTITLEMENT_CAPABILITIES) {
        expect(typeof MEMBERSHIP_TIER_MATRIX[tier].capabilities[capability]).toBe('boolean');
      }
    }
  });

  it('never revokes a capability at a higher membership', () => {
    for (const capability of ENTITLEMENT_CAPABILITIES) {
      const granted = MEMBERSHIP_TIERS.map(
        (tier) => MEMBERSHIP_TIER_MATRIX[tier].capabilities[capability]
      );
      // Once true, must stay true up the ladder — otherwise upgrading could lose a feature.
      const firstGrant = granted.indexOf(true);
      if (firstGrant === -1) continue;
      expect(granted.slice(firstGrant).every(Boolean)).toBe(true);
    }
  });

  it('computes the cheapest granting membership from the matrix', () => {
    expect(lowestMembershipGranting('canUseAI')).toBe('DISCOVER');
    expect(lowestMembershipGranting('canPurchaseMinutes')).toBe('GROW');
    expect(lowestMembershipGranting('canExportReports')).toBe('THRIVE');
  });

  it('orders memberships and challenge access levels', () => {
    expect(isAtLeastMembership('THRIVE', 'GROW')).toBe(true);
    expect(isAtLeastMembership('GROW', 'GROW')).toBe(true);
    expect(isAtLeastMembership('DISCOVER', 'GROW')).toBe(false);

    expect(isAtLeastChallengeAccess('FULL', 'CORE')).toBe(true);
    expect(isAtLeastChallengeAccess('NONE', 'CORE')).toBe(false);
  });
});
