/**
 * PHASE 2B — the approved active-challenge policy, pinned.
 *
 * APPROVED RULE (ratified Phase 2B):
 *   DISCOVER, active OR expired -> 1
 *   GROW                        -> 3
 *   THRIVE                      -> unlimited (null)
 *
 * Membership expiry does NOT reduce the challenge limit. Only AI-session and PAYG restrictions
 * are approved to trigger on expiry; the rest of `EXPIRED_CAPABILITIES` stays PROVISIONAL.
 *
 * These tests exist to stop that decision being undone by accident — most plausibly by someone
 * "simplifying" enforcement to read `entitlements.maxActiveChallenges`, which has already had the
 * provisional expiry collapse applied.
 */

import {
  ENTITLEMENT_POLICY_STATUS,
  MEMBERSHIP_TIER_MATRIX,
  getApprovedMaxActiveChallenges,
  getPolicyStatus,
  assertEnforceable,
  resolveEntitlements,
  MEMBERSHIP_TIERS,
} from '../entitlements';
import type { EntitlementFacts } from '../entitlements';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const PAST = new Date('2026-07-01T00:00:00.000Z');

function facts(overrides: Partial<EntitlementFacts> = {}): EntitlementFacts {
  return {
    userId: 'policy-user',
    internalPlanType: 'trial',
    subscriptionStatus: 'active',
    subscriptionEndDate: null,
    remainingSeconds: 1800,
    now: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The approved limits
// ---------------------------------------------------------------------------

describe('approved active-challenge limits', () => {
  it('is 1 for DISCOVER, 3 for GROW, unlimited for THRIVE', () => {
    expect(getApprovedMaxActiveChallenges('DISCOVER')).toBe(1);
    expect(getApprovedMaxActiveChallenges('GROW')).toBe(3);
    expect(getApprovedMaxActiveChallenges('THRIVE')).toBeNull();
  });

  it('reads the tier matrix, so the matrix stays the single source', () => {
    for (const tier of MEMBERSHIP_TIERS) {
      expect(getApprovedMaxActiveChallenges(tier)).toBe(
        MEMBERSHIP_TIER_MATRIX[tier].maxActiveChallenges
      );
    }
  });

  it('never returns zero — null means unlimited, not "none"', () => {
    for (const tier of MEMBERSHIP_TIERS) {
      expect(getApprovedMaxActiveChallenges(tier)).not.toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Expiry must not reduce the limit
// ---------------------------------------------------------------------------

describe('expiry does not reduce the approved limit', () => {
  it('an expired DISCOVER membership keeps its 1 active challenge', () => {
    const expired = resolveEntitlements(
      facts({ internalPlanType: 'trial', subscriptionEndDate: PAST })
    );

    expect(expired.status).toBe('EXPIRED');
    expect(getApprovedMaxActiveChallenges(expired.membership)).toBe(1);
  });

  it('the resolver still expresses the provisional collapse — enforcement just must not read it', () => {
    const expired = resolveEntitlements(
      facts({ internalPlanType: 'trial', subscriptionEndDate: PAST })
    );

    // The resolver's job is to express policy, including provisional policy. The approved
    // accessor is what enforcement reads. These two intentionally disagree for expired members.
    expect(expired.maxActiveChallenges).toBe(0);
    expect(getApprovedMaxActiveChallenges(expired.membership)).toBe(1);
  });

  it('no paid membership is newly restricted by expiry either', () => {
    for (const [plan, tier, expected] of [
      ['core', 'GROW', 3],
      ['pro', 'THRIVE', null],
    ] as const) {
      const expired = resolveEntitlements(
        facts({ internalPlanType: plan, subscriptionStatus: 'canceled', subscriptionEndDate: PAST })
      );
      expect(expired.status).toBe('EXPIRED');
      expect(expired.membership).toBe(tier);
      expect(getApprovedMaxActiveChallenges(expired.membership)).toBe(expected);
    }
  });

  it('is immune to the provisional EXPIRED baseline changing', () => {
    // The guarantee under test is structural: the approved accessor never consults
    // EXPIRED_MAX_ACTIVE_CHALLENGES, so editing that constant cannot move the enforced limit.
    const config = require('../entitlements/entitlements.config');
    expect(config.EXPIRED_MAX_ACTIVE_CHALLENGES).toBe(0);
    expect(getApprovedMaxActiveChallenges('DISCOVER')).toBe(1);

    const source = getApprovedMaxActiveChallenges.toString();
    expect(source).toContain('MEMBERSHIP_TIER_MATRIX');
    expect(source).not.toContain('EXPIRED');
  });
});

// ---------------------------------------------------------------------------
// Ledger state
// ---------------------------------------------------------------------------

describe('policy ledger', () => {
  it('records both challenge-limit decisions as APPROVED', () => {
    expect(getPolicyStatus('maxActiveChallenges')).toBe('APPROVED');
    expect(getPolicyStatus('expiredMembershipChallengeLimit')).toBe('APPROVED');
    expect(() => assertEnforceable('maxActiveChallenges')).not.toThrow();
    expect(() => assertEnforceable('expiredMembershipChallengeLimit')).not.toThrow();
  });

  it('keeps the still-undecided dimensions PROVISIONAL', () => {
    expect(getPolicyStatus('expiredMembership')).toBe('ENFORCED');
    // Phase 7 promoted journal / mood history / wellness tools / talking history under Option A.
    // Everything below remains undecided and must stay ungateable.
    for (const provisional of [
      'canUseSleepTracking',
      'canUseBrainHealth',
      'canUseCommunity',
      'canViewInsights',
      'canExportReports',
      'challengeAccessLevel',
      'historyWindow',
      'featureFlags',
    ]) {
      expect(getPolicyStatus(provisional)).toBe('PROVISIONAL');
      expect(() => assertEnforceable(provisional)).toThrow(/PROVISIONAL/);
    }
  });

  it('records the Phase 7 Option A promotions as APPROVED', () => {
    for (const approved of [
      'canCreateJournal',
      'canUseMoodTracking',
      'canUseWellnessTools',
      'canViewSessionHistory',
    ]) {
      expect(getPolicyStatus(approved)).toBe('APPROVED');
      expect(() => assertEnforceable(approved)).not.toThrow();
    }
  });

  it('has an entry for every approved challenge decision', () => {
    expect(ENTITLEMENT_POLICY_STATUS).toHaveProperty('maxActiveChallenges');
    expect(ENTITLEMENT_POLICY_STATUS).toHaveProperty('expiredMembershipChallengeLimit');
  });
});
