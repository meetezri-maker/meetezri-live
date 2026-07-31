/**
 * Active-challenge limit rejection — error contract.
 *
 * Shaped to the project's standard error envelope (`{ statusCode, error, code, message, ... }`,
 * see `app.setErrorHandler` and the `ACCOUNT_INACTIVE` 403 in `plugins/auth.ts`), so the global
 * handler renders it without special-casing.
 *
 * WHAT IS DELIBERATELY NOT ON THIS ERROR: subscription rows, `plan_type`, Stripe identifiers,
 * minute balances, and the resolver's `source` diagnostics. The client gets only the three facts
 * it needs to render a useful message — the membership, the cap, and the current count — plus an
 * upgrade target when, and only when, a higher membership actually raises the cap.
 */

import { MEMBERSHIP_RANK, MEMBERSHIP_TIER_MATRIX } from '../entitlements';
import type { MembershipTier } from '../entitlements';

export const ACTIVE_CHALLENGE_LIMIT_ERROR_CODE = 'ACTIVE_CHALLENGE_LIMIT_REACHED';

export interface ActiveChallengeLimitDetails {
  membership: MembershipTier;
  /** Maximum concurrent active challenges for this membership. Never `null` here — unlimited memberships cannot reach this error. */
  limit: number;
  activeCount: number;
  /** Lowest membership with a strictly higher limit, or `null` when none exists. */
  upgradeMembership: MembershipTier | null;
}

/**
 * The lowest membership whose active-challenge limit is strictly greater than `membership`'s.
 *
 * Read from the tier matrix rather than hardcoded, so retuning the limits retunes the upsell.
 * `null` (unlimited) always counts as higher.
 */
export function nextMembershipWithHigherChallengeLimit(
  membership: MembershipTier
): MembershipTier | null {
  const current = MEMBERSHIP_TIER_MATRIX[membership].maxActiveChallenges;
  if (current === null) return null; // Already unlimited.

  const currentRank = MEMBERSHIP_RANK[membership];

  const candidates = (Object.keys(MEMBERSHIP_TIER_MATRIX) as MembershipTier[])
    .filter((tier) => MEMBERSHIP_RANK[tier] > currentRank)
    .sort((a, b) => MEMBERSHIP_RANK[a] - MEMBERSHIP_RANK[b]);

  for (const tier of candidates) {
    const limit = MEMBERSHIP_TIER_MATRIX[tier].maxActiveChallenges;
    if (limit === null || limit > current) return tier;
  }

  return null;
}

export class ActiveChallengeLimitError extends Error {
  readonly statusCode = 403;
  readonly code = ACTIVE_CHALLENGE_LIMIT_ERROR_CODE;
  readonly membership: MembershipTier;
  readonly limit: number;
  readonly activeCount: number;
  readonly upgradeMembership: MembershipTier | null;

  constructor(details: ActiveChallengeLimitDetails) {
    super(
      details.limit === 1
        ? 'You can have 1 active challenge at a time. Finish or leave your current one to start another.'
        : `You can have ${details.limit} active challenges at a time. Finish or leave one to start another.`
    );
    this.name = 'ActiveChallengeLimitError';
    this.membership = details.membership;
    this.limit = details.limit;
    this.activeCount = details.activeCount;
    this.upgradeMembership = details.upgradeMembership;
  }

  /** The response body for this rejection. Keep in sync with the controller. */
  toResponse() {
    return {
      statusCode: this.statusCode,
      error: 'Forbidden',
      code: this.code,
      message: this.message,
      membership: this.membership,
      maxActiveChallenges: this.limit,
      activeChallengeCount: this.activeCount,
      ...(this.upgradeMembership ? { upgradeMembership: this.upgradeMembership } : {}),
    };
  }
}
