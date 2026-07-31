/**
 * Membership Entitlements V1 — the canonical resolver.
 *
 * `resolveEntitlements` is the ONLY function in the product allowed to decide what a member may
 * do. It is pure: same facts in, same entitlements out, no I/O, no clock read, no globals.
 * All fact-gathering lives in `entitlements.service.ts`, which is the impure shell around this.
 *
 * PIPELINE (order is load-bearing and is asserted by the tests):
 *   1. membership   — map raw `plan_type` → tier, defaulting unknown/missing to DISCOVER
 *   2. status       — normalize raw `subscriptions.status` + `end_date` against the clock
 *   3. baseline     — read the tier row out of `MEMBERSHIP_TIER_MATRIX`
 *   4. degrade      — expiry collapses the baseline; balance zero closes `canUseAI`
 *   5. override     — an admin override wins over everything above, including expiry
 *   6. explain      — restrictions and upgrade reasons are derived from the FINAL values
 *
 * Step 5 sits after step 4 so support can genuinely unblock a member. Step 6 sits after step 5
 * so the explanation can never contradict the answer it accompanies.
 */

import {
  CHALLENGE_ACCESS_RANK,
  DEFAULT_MEMBERSHIP,
  EXPIRED_CAPABILITIES,
  EXPIRED_CHALLENGE_ACCESS,
  EXPIRED_MAX_ACTIVE_CHALLENGES,
  INTERNAL_PLAN_TO_MEMBERSHIP,
  MEMBERSHIP_RANK,
  MEMBERSHIP_TIER_MATRIX,
  RAW_STATUS_GROUPS,
} from './entitlements.config';
import {
  ENTITLEMENT_CAPABILITIES,
  MEMBERSHIP_TIERS,
  type CapabilityMap,
  type ChallengeAccessLevel,
  type EntitlementCapability,
  type EntitlementFacts,
  type FeatureFlagMap,
  type HistoryWindow,
  type MembershipEntitlements,
  type MembershipStatus,
  type MembershipTier,
  type Restriction,
  type UpgradeReason,
} from './entitlements.types';

// ---------------------------------------------------------------------------
// Step 1 — membership
// ---------------------------------------------------------------------------

/**
 * Map a raw billing plan value to a product membership.
 *
 * Case- and whitespace-tolerant because `plan_type` is an unconstrained string column: the audit
 * found `as keyof typeof PLAN_LIMITS` casts across the billing code with no runtime validation,
 * so a stray `'Core '` must not silently become DISCOVER.
 */
export function mapInternalPlanToMembership(planType: string | null | undefined): {
  membership: MembershipTier;
  recognized: boolean;
} {
  if (typeof planType !== 'string') return { membership: DEFAULT_MEMBERSHIP, recognized: false };

  const normalized = planType.trim().toLowerCase();
  if (!normalized) return { membership: DEFAULT_MEMBERSHIP, recognized: false };

  const mapped = INTERNAL_PLAN_TO_MEMBERSHIP[normalized];
  if (mapped) return { membership: mapped, recognized: true };

  // Tolerate a caller that already speaks product vocabulary (e.g. an override sourced upstream).
  const asTier = normalized.toUpperCase() as MembershipTier;
  if ((MEMBERSHIP_TIERS as readonly string[]).includes(asTier)) {
    return { membership: asTier, recognized: true };
  }

  return { membership: DEFAULT_MEMBERSHIP, recognized: false };
}

// ---------------------------------------------------------------------------
// Step 2 — status
// ---------------------------------------------------------------------------

function includesStatus(group: readonly string[], value: string): boolean {
  return group.includes(value);
}

/**
 * Normalize the billing lifecycle into a membership lifecycle.
 *
 * Expiry is decided here and nowhere else. The rule reproduces the two places the codebase
 * already expresses expiry, so it introduces no new behaviour:
 *
 *   - `getSubscription`         : canceled AND `end_date < now`                → no subscription
 *   - `assertSessionStartAllowed`: NO active paid row AND active trial row
 *                                  AND `now > end_date`                        → trial expired
 *
 * Two properties of those rules are load-bearing and were corrected in Phase 1B:
 *
 * 1. STRICT comparison. Both production paths use `<` / `>`, so an `end_date` exactly equal to
 *    `now` is NOT expired. Phase 1 used `<=`, which would have expired members one instant early
 *    — a new customer-visible restriction, however small.
 *
 * 2. ACTIVE/TRIALING expiry is DISCOVER-ONLY. `assertSessionStartAllowed` checks trial expiry
 *    *only when the member has no active paid row*, so an `active` PAID row whose `end_date` has
 *    passed is not treated as expired today. That state is webhook drift, not a lapse: a genuine
 *    paid lapse arrives from Stripe as `canceled`/`past_due`, never as `active` with a stale
 *    date. Expiring it here would have invented a restriction in exactly the situation where the
 *    member is least at fault. `canceled` expiry stays tier-uniform, matching `getSubscription`.
 *
 * `membership` is therefore an input: expiry is a tier-scoped policy in production, and this
 * function's job is to reproduce production, not to tidy it.
 */
export function resolveMembershipStatus(
  rawStatus: string | null | undefined,
  endDate: Date | null | undefined,
  now: Date,
  membership: MembershipTier = DEFAULT_MEMBERSHIP
): MembershipStatus {
  if (typeof rawStatus !== 'string' || !rawStatus.trim()) return 'NONE';

  const status = rawStatus.trim().toLowerCase();
  const ended = endDate instanceof Date && !Number.isNaN(endDate.getTime()) && endDate < now;

  if (includesStatus(RAW_STATUS_GROUPS.incomplete, status)) {
    // `getSubscription` never returns these; a direct caller that hands one over has no usable
    // membership, not a broken one.
    return 'NONE';
  }

  if (includesStatus(RAW_STATUS_GROUPS.canceled, status)) {
    // Cancelled-but-inside-the-paid-period keeps full access, which is what Stripe's
    // `cancel_at_period_end` flow and `cancelSubscription` already encode.
    return ended ? 'EXPIRED' : 'CANCELED';
  }

  if (includesStatus(RAW_STATUS_GROUPS.pastDue, status)) {
    // Access is intentionally retained: nothing in the codebase restricts on `past_due` today,
    // and this engine is not permitted to change behaviour. The state is surfaced as a
    // restriction so Phase 2 can decide the policy explicitly.
    return 'PAST_DUE';
  }

  // Property 2 above: a stale `end_date` on a live row only expires DISCOVER.
  const liveRowCanExpire = ended && membership === 'DISCOVER';

  if (includesStatus(RAW_STATUS_GROUPS.trialing, status)) {
    return liveRowCanExpire ? 'EXPIRED' : 'TRIALING';
  }

  if (includesStatus(RAW_STATUS_GROUPS.active, status)) {
    return liveRowCanExpire ? 'EXPIRED' : 'ACTIVE';
  }

  // Unknown status from Stripe (`unpaid`, `paused`, a future value). Treat as no usable
  // membership rather than guessing it is active.
  return 'NONE';
}

/**
 * Only EXPIRED degrades the tier baseline.
 *
 * NONE deliberately does not: "no subscription row" is the ordinary state of a fresh member, and
 * every existing caller already treats it as trial-level access. Degrading it here would lock
 * out real users — a behaviour change this project is not permitted to make.
 */
function statusDegradesAccess(status: MembershipStatus): boolean {
  return status === 'EXPIRED';
}

// ---------------------------------------------------------------------------
// Step 6 helpers — the cheapest tier granting a capability
// ---------------------------------------------------------------------------

/**
 * Lowest membership whose matrix row grants `capability`, or `null` if no tier does.
 * Computed from the matrix rather than hardcoded, so retuning the matrix retunes the upsell.
 */
export function lowestMembershipGranting(
  capability: EntitlementCapability
): MembershipTier | null {
  for (const tier of MEMBERSHIP_TIERS) {
    if (MEMBERSHIP_TIER_MATRIX[tier].capabilities[capability]) return tier;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

export function resolveEntitlements(facts: EntitlementFacts): MembershipEntitlements {
  const now = facts.now;
  const remainingSeconds = normalizeSeconds(facts.remainingSeconds);

  // --- 1. membership ---
  const { membership: resolvedMembership, recognized } = mapInternalPlanToMembership(
    facts.internalPlanType
  );

  // --- 2. status ---
  // Membership is passed in because expiry of a live row is DISCOVER-scoped in production.
  const resolvedStatus = resolveMembershipStatus(
    facts.subscriptionStatus,
    facts.subscriptionEndDate,
    now,
    resolvedMembership
  );

  // --- 3. baseline ---
  const tier = MEMBERSHIP_TIER_MATRIX[resolvedMembership];
  let capabilities: CapabilityMap = { ...tier.capabilities };
  let challengeAccessLevel: ChallengeAccessLevel = tier.challengeAccessLevel;
  let maxActiveChallenges: number | null = tier.maxActiveChallenges;
  let historyWindow: HistoryWindow = tier.historyWindow;
  let featureFlags: Record<string, boolean> = { ...tier.featureFlags };

  // --- 4. degrade ---
  const expired = statusDegradesAccess(resolvedStatus);
  if (expired) {
    capabilities = { ...EXPIRED_CAPABILITIES };
    challengeAccessLevel = EXPIRED_CHALLENGE_ACCESS;
    maxActiveChallenges = EXPIRED_MAX_ACTIVE_CHALLENGES;
    // History window and feature flags are deliberately NOT collapsed: an expired member may
    // still read and export what they already produced. Phase 2 owns the retention policy.
  }

  // Balance is orthogonal to membership: a fully-entitled Thrive member with an empty wallet
  // cannot start a session either. Mirrors `assertSessionStartAllowed`'s second check.
  const hasBalance = remainingSeconds > 0;
  if (!hasBalance) {
    capabilities = { ...capabilities, canUseAI: false };
  }

  let membership = resolvedMembership;
  let status = resolvedStatus;

  // --- 5. override ---
  const override = facts.override ?? null;
  let overrideApplied = false;

  if (override) {
    if (override.membership && override.membership !== membership) {
      membership = override.membership;
      // Re-baseline from the granted tier so an override to THRIVE grants THRIVE's whole row,
      // not THRIVE's name over DISCOVER's capabilities.
      const grantedTier = MEMBERSHIP_TIER_MATRIX[membership];
      capabilities = { ...grantedTier.capabilities };
      challengeAccessLevel = grantedTier.challengeAccessLevel;
      maxActiveChallenges = grantedTier.maxActiveChallenges;
      historyWindow = grantedTier.historyWindow;
      featureFlags = { ...grantedTier.featureFlags };
      // The wallet is still the wallet — an override grants entitlement, never minutes.
      if (!hasBalance) capabilities = { ...capabilities, canUseAI: false };
      overrideApplied = true;
    }

    if (override.status && override.status !== status) {
      status = override.status;
      overrideApplied = true;
    }

    if (override.capabilities) {
      for (const capability of ENTITLEMENT_CAPABILITIES) {
        const value = override.capabilities[capability];
        if (typeof value === 'boolean' && capabilities[capability] !== value) {
          capabilities = { ...capabilities, [capability]: value };
          overrideApplied = true;
        }
      }
    }

    if (override.challengeAccessLevel && override.challengeAccessLevel !== challengeAccessLevel) {
      challengeAccessLevel = override.challengeAccessLevel;
      overrideApplied = true;
    }

    if (override.maxActiveChallenges !== undefined) {
      if (override.maxActiveChallenges !== maxActiveChallenges) overrideApplied = true;
      maxActiveChallenges = override.maxActiveChallenges;
    }

    if (override.historyWindow && override.historyWindow.days !== historyWindow.days) {
      historyWindow = { days: override.historyWindow.days };
      overrideApplied = true;
    }

    if (override.featureFlags) {
      for (const [flag, value] of Object.entries(override.featureFlags)) {
        if (typeof value === 'boolean' && featureFlags[flag] !== value) {
          featureFlags = { ...featureFlags, [flag]: value };
          overrideApplied = true;
        }
      }
    }
  }

  // --- 6. explain ---
  const restrictions = buildRestrictions({
    status,
    membership,
    capabilities,
    hasBalance,
    expired,
  });
  const upgradeReasons = buildUpgradeReasons(membership, capabilities);

  return Object.freeze({
    ...capabilities,
    membership,
    status,
    remainingSeconds,
    remainingMinutes: remainingSeconds === 0 ? 0 : Math.ceil(remainingSeconds / 60),
    challengeAccessLevel,
    maxActiveChallenges,
    historyWindow: Object.freeze({ ...historyWindow }),
    featureFlags: Object.freeze(featureFlags) as FeatureFlagMap,
    restrictions: Object.freeze(restrictions),
    upgradeReasons: Object.freeze(upgradeReasons),
    source: Object.freeze({
      internalPlanType: facts.internalPlanType ?? null,
      internalStatus: facts.subscriptionStatus ?? null,
      subscriptionEndsAt: toIsoOrNull(facts.subscriptionEndDate),
      planUnrecognized: !recognized,
      statusUnrecognized: !isRecognizedStatus(facts.subscriptionStatus),
      overrideApplied,
      resolvedAt: now.toISOString(),
    }),
  }) as MembershipEntitlements;
}

// ---------------------------------------------------------------------------
// Explanation builders
// ---------------------------------------------------------------------------

function buildRestrictions(input: {
  status: MembershipStatus;
  membership: MembershipTier;
  capabilities: CapabilityMap;
  hasBalance: boolean;
  expired: boolean;
}): Restriction[] {
  const out: Restriction[] = [];

  // Read from the FINAL status, so an override that un-expires a member removes the restriction.
  if (input.status === 'EXPIRED') {
    out.push({
      code: 'MEMBERSHIP_EXPIRED',
      message: `Membership ${input.membership} has expired.`,
    });
  }

  if (input.status === 'PAST_DUE') {
    out.push({
      code: 'PAYMENT_PAST_DUE',
      message: 'Payment is past due. Access is retained as a grace period.',
    });
  }

  if (!input.hasBalance && !input.capabilities.canUseAI) {
    out.push({
      code: 'NO_MINUTES_REMAINING',
      message: 'No remaining minutes.',
      capability: 'canUseAI',
    });
  }

  if (!input.capabilities.canPurchaseMinutes && input.status !== 'EXPIRED') {
    out.push({
      code: 'PAYG_REQUIRES_PAID_MEMBERSHIP',
      message: 'Additional minutes require a paid membership.',
      capability: 'canPurchaseMinutes',
    });
  }

  return out;
}

function buildUpgradeReasons(
  membership: MembershipTier,
  capabilities: CapabilityMap
): UpgradeReason[] {
  const out: UpgradeReason[] = [];
  const currentRank = MEMBERSHIP_RANK[membership];

  for (const capability of ENTITLEMENT_CAPABILITIES) {
    if (capabilities[capability]) continue;

    const required = lowestMembershipGranting(capability);
    // Only an upgrade can fix it. A capability denied at or below the member's own rank is a
    // degradation (expiry, empty wallet), not an upsell — surfacing it would tell a Thrive
    // member to upgrade to Thrive.
    if (!required || MEMBERSHIP_RANK[required] <= currentRank) continue;

    out.push({ capability, currentMembership: membership, requiredMembership: required });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function normalizeSeconds(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function toIsoOrNull(date: Date | null | undefined): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Whether a raw `subscriptions.status` is one this engine knows.
 *
 * An absent/blank status is "no subscription", not an unrecognized one — only a populated value
 * the engine cannot classify counts, which is what makes the diagnostic flag actionable.
 */
export function isRecognizedStatus(rawStatus: string | null | undefined): boolean {
  if (typeof rawStatus !== 'string' || !rawStatus.trim()) return true;
  const status = rawStatus.trim().toLowerCase();
  return Object.values(RAW_STATUS_GROUPS).some((group) =>
    (group as readonly string[]).includes(status)
  );
}

/** Ordinal comparison for `assertMembership` and any future tier gate. */
export function isAtLeastMembership(actual: MembershipTier, minimum: MembershipTier): boolean {
  return MEMBERSHIP_RANK[actual] >= MEMBERSHIP_RANK[minimum];
}

/** Ordinal comparison for challenge depth. */
export function isAtLeastChallengeAccess(
  actual: ChallengeAccessLevel,
  minimum: ChallengeAccessLevel
): boolean {
  return CHALLENGE_ACCESS_RANK[actual] >= CHALLENGE_ACCESS_RANK[minimum];
}
