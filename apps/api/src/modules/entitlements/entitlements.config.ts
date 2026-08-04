/**
 * Membership Entitlements V1 — configuration.
 *
 * The ONE place tier capability data lives. Everything downstream (resolver, guards, future
 * enforcement) reads this table; nothing hardcodes a per-tier answer of its own.
 *
 * AUTHORITY OF EACH VALUE — every dimension carries an explicit `PolicyStatus` (below). Marketing
 * copy is NOT an authorization source: it was used in Phase 1 only to seed values that nothing
 * enforced, and each such value is now labelled PROVISIONAL until product signs it off.
 *
 *   APPROVED    — confirmed by product. Safe to enforce.
 *   ENFORCED    — already enforced in production today; this table mirrors observed behaviour
 *                 rather than deciding it. Authoritative because it is what the system does.
 *   PROVISIONAL — inferred (mostly from `PLAN_LIMITS[*].features` copy). MUST NOT be enforced.
 *
 * `PLAN_LIMITS` remains the authority for minute allowances, prices and the PAYG rate; this file
 * does not duplicate any of them. It only decides *whether* an action is permitted — never how
 * much it costs. See `ENTITLEMENT_POLICY_STATUS` for the full per-dimension ledger.
 */

import type {
  CapabilityMap,
  ChallengeAccessLevel,
  EntitlementFeatureFlag,
  HistoryWindow,
  MembershipTier,
} from './entitlements.types';

// ---------------------------------------------------------------------------
// Billing plan → product membership
// ---------------------------------------------------------------------------

/**
 * Maps the billing value to the product value. Keys are `subscriptions.plan_type` exactly as
 * stored; they are NEVER renamed — the billing consolidation owns those strings.
 */
export const INTERNAL_PLAN_TO_MEMBERSHIP: Readonly<Record<string, MembershipTier>> = {
  trial: 'DISCOVER',
  core: 'GROW',
  pro: 'THRIVE',
};

/**
 * Where an unknown or missing plan lands.
 *
 * DISCOVER is chosen to preserve existing behaviour exactly: every current caller already
 * defaults a missing subscription to `'trial'` (`billing.controller.ts`, `user.service.ts`,
 * `payg.service.ts`). Changing this to a deny-all default would be a behaviour change, which
 * this project is not permitted to make.
 */
export const DEFAULT_MEMBERSHIP: MembershipTier = 'DISCOVER';

/** Ordinal rank for `assertMembership` and for computing the cheapest tier granting a capability. */
export const MEMBERSHIP_RANK: Readonly<Record<MembershipTier, number>> = {
  DISCOVER: 0,
  GROW: 1,
  THRIVE: 2,
};

/** Ordinal rank for challenge depth comparisons. */
export const CHALLENGE_ACCESS_RANK: Readonly<Record<ChallengeAccessLevel, number>> = {
  NONE: 0,
  CORE: 1,
  FULL: 2,
};

// ---------------------------------------------------------------------------
// Policy status ledger
// ---------------------------------------------------------------------------

/**
 * How much authority each dimension's value carries.
 *
 * A gate MUST NOT be built on a PROVISIONAL dimension. `assertEnforceable()` makes that a runtime
 * error rather than a review comment, so a Phase 2 author cannot enforce an inferred rule by
 * accident.
 */
export type PolicyStatus =
  /** Product-confirmed. Safe to enforce. */
  | 'APPROVED'
  /** Mirrors behaviour already enforced in production. Authoritative by observation. */
  | 'ENFORCED'
  /** Inferred, never enforced, awaiting product sign-off. Must not gate anything. */
  | 'PROVISIONAL';

/**
 * Per-dimension ledger. Keys cover every capability plus the non-boolean dimensions and the
 * lifecycle behaviours, so nothing in the model is silently unaccounted for.
 */
export const ENTITLEMENT_POLICY_STATUS: Readonly<Record<string, PolicyStatus>> = {
  // --- Enforced in production today; this table mirrors, it does not decide ---
  // `sessions.service.assertSessionStartAllowed` lets every membership start a session.
  canUseAI: 'ENFORCED',
  // `payg.service` throws when `PLAN_LIMITS[plan].payAsYouGoRate` is null — trial only.
  canPurchaseMinutes: 'ENFORCED',
  // `sessions.service` blocks an expired trial; no other feature has an expiry rule.
  expiredMembership: 'ENFORCED',
  // No code path restricts on `past_due` today.
  pastDueMembership: 'ENFORCED',
  // `getSubscription` keeps a cancelled row until `end_date` passes.
  canceledInPeriod: 'ENFORCED',
  // Every existing caller defaults a missing subscription to `'trial'`.
  missingSubscription: 'ENFORCED',
  // No caller validates `plan_type`; unknown values fall through to trial-level access.
  unknownPlan: 'ENFORCED',

  // --- Product-confirmed ---
  maxActiveChallenges: 'APPROVED',
  /**
   * APPROVED (Phase 2B): membership EXPIRY does not reduce the active-challenge limit.
   * An expired DISCOVER member keeps their 1 active challenge.
   *
   * This is a standalone approved policy, not a side effect of `maxActiveChallenges` — it is the
   * explicit decision that the PROVISIONAL `EXPIRED_CAPABILITIES` / `EXPIRED_MAX_ACTIVE_CHALLENGES`
   * baseline must NOT govern challenges. Only AI-session and PAYG expiry restrictions are approved.
   */
  expiredMembershipChallengeLimit: 'APPROVED',

  /**
   * APPROVED (Phase 7 — Option A). Discover does NOT include journalling, mood history,
   * the wellness tool library, or talking history; they are Grow/Thrive capabilities.
   *
   * These were PROVISIONAL through Phase 6 while the shipped frontend already gated them, which
   * is the contradiction Phase 5 and 6 refused to resolve without a product decision. The
   * decision is now made and the matrix matches the product.
   *
   * `canUseMoodTracking` gates mood HISTORY, not mood CHECK-INS — Discover keeps daily check-ins.
   */
  canCreateJournal: 'APPROVED',
  canUseMoodTracking: 'APPROVED',
  canUseWellnessTools: 'APPROVED',
  canViewSessionHistory: 'APPROVED',

  // --- Inferred. Unenforced. Do not gate on these. ---
  canUseSleepTracking: 'PROVISIONAL',
  canUseBrainHealth: 'PROVISIONAL',
  canUseCommunity: 'PROVISIONAL',
  canViewInsights: 'PROVISIONAL',
  canExportReports: 'PROVISIONAL',
  challengeAccessLevel: 'PROVISIONAL',
  historyWindow: 'PROVISIONAL',
  featureFlags: 'PROVISIONAL',
  // The hook exists and is tested; the policy for what an override may grant is unreviewed.
  adminOverrides: 'PROVISIONAL',
};

/**
 * THE approved active-challenge limit for a membership: DISCOVER 1, GROW 3, THRIVE unlimited.
 *
 * =========================================================================================
 * APPROVED POLICY (Phase 2B) — membership expiry does NOT reduce the challenge limit.
 * =========================================================================================
 *
 * This function reads `MEMBERSHIP_TIER_MATRIX` and deliberately does NOT apply
 * `EXPIRED_MAX_ACTIVE_CHALLENGES`. That is the ratified product decision recorded as
 * `expiredMembershipChallengeLimit: 'APPROVED'` in `ENTITLEMENT_POLICY_STATUS` — not a temporary
 * engineering exception, and not something to "clean up" later:
 *
 *   - DISCOVER, active or expired  -> 1
 *   - GROW                         -> 3
 *   - THRIVE                       -> unlimited (null)
 *
 * Only AI-session and PAYG restrictions are approved to trigger on expiry. The rest of
 * `EXPIRED_CAPABILITIES` remains PROVISIONAL and must not govern any gate, challenges included.
 *
 * ORDER MATTERS: enforcement must call THIS, never `entitlements.maxActiveChallenges` — the
 * latter has already had the provisional expiry collapse applied by the resolver.
 * `challenge-limit.policy.test.ts` pins that distinction so it cannot regress silently.
 *
 * The numbers still come from `MEMBERSHIP_TIER_MATRIX` alone — nothing is duplicated here.
 */
export function getApprovedMaxActiveChallenges(membership: MembershipTier): number | null {
  return MEMBERSHIP_TIER_MATRIX[membership].maxActiveChallenges;
}

export function getPolicyStatus(dimension: string): PolicyStatus {
  // Unlisted dimensions are provisional by default: a new dimension is unreviewed until someone
  // reviews it, and defaulting the other way would make omission look like approval.
  return ENTITLEMENT_POLICY_STATUS[dimension] ?? 'PROVISIONAL';
}

/**
 * Guard for Phase 2 authors: throws unless `dimension` is cleared for enforcement.
 *
 * Call this at the top of any new gate. It is deliberately a hard failure — a provisional rule
 * silently becoming a production restriction is exactly the outcome this ledger exists to stop.
 */
export function assertEnforceable(dimension: string): void {
  const status = getPolicyStatus(dimension);
  if (status === 'PROVISIONAL') {
    throw new Error(
      `Entitlement dimension "${dimension}" is PROVISIONAL and must not gate a feature. ` +
        `Obtain product sign-off and set it to APPROVED in ENTITLEMENT_POLICY_STATUS first.`
    );
  }
}

// ---------------------------------------------------------------------------
// Tier matrix
// ---------------------------------------------------------------------------

export interface TierDefinition {
  readonly capabilities: CapabilityMap;
  readonly challengeAccessLevel: ChallengeAccessLevel;
  /** `null` means unlimited. */
  readonly maxActiveChallenges: number | null;
  readonly historyWindow: HistoryWindow;
  readonly featureFlags: Readonly<Record<EntitlementFeatureFlag, boolean>>;
}

export const MEMBERSHIP_TIER_MATRIX: Readonly<Record<MembershipTier, TierDefinition>> = {
  DISCOVER: {
    capabilities: {
      // 'FaceTime Basic' — Discover can talk to the companion, bounded by its 30-minute grant.
      canUseAI: true,
      // `PLAN_LIMITS.trial.payAsYouGoRate === null`; `payg.service.ts` already throws for trial.
      canPurchaseMinutes: false,
      // APPROVED (Phase 7, Option A): journalling and mood HISTORY are Grow/Thrive capabilities.
      // These read `true` until Phase 7 while the shipped frontend blocked them — the matrix now
      // matches the product instead of contradicting it.
      canCreateJournal: false,
      canUseMoodTracking: false,
      // APPROVED (Phase 7, Option A): both were frontend-gated with no capability behind them.
      canUseWellnessTools: false,
      canViewSessionHistory: false,
      // Still open on Discover: mood CHECK-INS (distinct from mood history) and community are how
      // a member experiences the product before paying.
      canUseSleepTracking: true,
      canUseCommunity: true,
      // PROVISIONAL: analysis depth is assumed to be the Grow/Thrive value proposition.
      canUseBrainHealth: false,
      canViewInsights: false,
      canExportReports: false,
    },
    // PROVISIONAL: Discover is assumed to sample challenges rather than run a programme.
    challengeAccessLevel: 'NONE',
    // APPROVED (Phase 1B): Discover may run one active challenge. Corrected from 0 — a zero
    // limit would have locked Discover out of challenges entirely, which is not the policy and
    // is not today's behaviour (challenges are wholly unrestricted in production).
    maxActiveChallenges: 1,
    // PROVISIONAL: a 7-day window mirrors the 7-day trial provisioning window.
    historyWindow: { days: 7 },
    featureFlags: {
      usageDashboard: false,
      avatarCustomization: false,
      fullWellnessLibrary: false,
      detailedSessionLogs: false,
      prioritySupport: false,
    },
  },

  GROW: {
    capabilities: {
      canUseAI: true, // 'Full FaceTime'
      canPurchaseMinutes: true, // `PLAN_LIMITS.core.payAsYouGoRate === 0.20`
      canCreateJournal: true, // APPROVED (Phase 7) — 'Unlimited journals'
      canUseMoodTracking: true, // APPROVED (Phase 7) — 'Daily mood check-in & history'
      canUseWellnessTools: true, // APPROVED (Phase 7)
      canViewSessionHistory: true, // APPROVED (Phase 7)
      canUseSleepTracking: true,
      canUseCommunity: true,
      canUseBrainHealth: true,
      canViewInsights: true, // 'Usage dashboard'
      canExportReports: false, // PROVISIONAL: 'Export-ready journaling' is listed under pro only.
    },
    challengeAccessLevel: 'CORE', // PROVISIONAL
    maxActiveChallenges: 3, // APPROVED (Phase 1B)
    historyWindow: { days: 30 }, // PROVISIONAL
    featureFlags: {
      usageDashboard: true, // 'Usage dashboard'
      avatarCustomization: true, // 'Avatar customization'
      fullWellnessLibrary: false, // 'Curated wellness tools' — curated, not full.
      detailedSessionLogs: false,
      prioritySupport: false,
    },
  },

  THRIVE: {
    capabilities: {
      canUseAI: true,
      canPurchaseMinutes: true, // `PLAN_LIMITS.pro.payAsYouGoRate === 0.20`
      canCreateJournal: true, // APPROVED (Phase 7)
      canUseMoodTracking: true, // APPROVED (Phase 7)
      canUseWellnessTools: true, // APPROVED (Phase 7)
      canViewSessionHistory: true, // APPROVED (Phase 7)
      canUseSleepTracking: true,
      canUseCommunity: true,
      canUseBrainHealth: true,
      canViewInsights: true,
      canExportReports: true, // 'Export-ready journaling'
    },
    challengeAccessLevel: 'FULL', // PROVISIONAL
    maxActiveChallenges: null, // APPROVED (Phase 1B) — unlimited
    // PROVISIONAL: copy promises a '90-day mood trend' as a floor; unlimited is the superset and
    // keeps the window monotonic across tiers. Retune here if product wants the literal 90.
    historyWindow: { days: null },
    featureFlags: {
      usageDashboard: true,
      avatarCustomization: true,
      fullWellnessLibrary: true, // 'Full wellness library'
      detailedSessionLogs: true, // 'Detailed session logs'
      prioritySupport: true, // 'Priority system handling'
    },
  },
};

// ---------------------------------------------------------------------------
// Expired baseline
// ---------------------------------------------------------------------------

/**
 * What an EXPIRED membership collapses to.
 *
 * Read-only survival: the member keeps their own data visible and can still be reached by
 * community, but cannot consume AI minutes, buy more, or write new tracked entries.
 *
 * STATUS: `canUseAI: false` and `canPurchaseMinutes: false` are ENFORCED — they reproduce what
 * `sessions.service` and `payg.service` already do to an expired trial. Every other `false` here
 * is PROVISIONAL and must not gate anything (nothing enforces journal/mood/sleep today, so
 * enforcing them on expiry would be a brand-new customer-visible restriction).
 *
 * REACHABILITY: through `getMembershipEntitlements`, EXPIRED is only ever reached by a DISCOVER
 * membership — see `resolveMembershipStatus` for why. An expired PAID membership arrives as
 * `canceled` + past `end_date`, which `getSubscription` already collapses to "no subscription",
 * landing the member on the normal DISCOVER baseline exactly as it does today.
 */
export const EXPIRED_CAPABILITIES: CapabilityMap = {
  canUseAI: false,
  canPurchaseMinutes: false,
  canCreateJournal: false,
  canUseMoodTracking: false,
  canUseWellnessTools: false,
  canViewSessionHistory: false,
  canUseSleepTracking: false,
  canUseBrainHealth: false,
  canUseCommunity: true,
  canViewInsights: false,
  canExportReports: false,
};

export const EXPIRED_CHALLENGE_ACCESS: ChallengeAccessLevel = 'NONE';
export const EXPIRED_MAX_ACTIVE_CHALLENGES = 0;

// ---------------------------------------------------------------------------
// Status normalization
// ---------------------------------------------------------------------------

/**
 * Raw `subscriptions.status` values seen in production, grouped by meaning.
 *
 * Both `canceled` and `cancelled` appear in the codebase (Stripe writes the single-l spelling;
 * some local paths wrote the double-l one). `getSubscription` already checks both, so this
 * table does too.
 */
export const RAW_STATUS_GROUPS = {
  active: ['active'],
  trialing: ['trialing'],
  pastDue: ['past_due'],
  canceled: ['canceled', 'cancelled'],
  /** Filtered out by `getSubscription`; handled defensively so a direct caller cannot surprise us. */
  incomplete: ['incomplete', 'incomplete_expired'],
} as const;
