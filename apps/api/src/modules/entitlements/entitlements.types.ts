/**
 * Membership Entitlements V1 — canonical model.
 *
 * This file defines the ONLY vocabulary the application may use to talk about what a member is
 * allowed to do. Feature modules must never re-derive access from `subscriptions.plan_type`,
 * `PLAN_LIMITS`, credit columns, or `profiles.role`; they consume a `MembershipEntitlements`
 * object produced by the single resolver in `entitlements.resolver.ts`.
 *
 * Relationship to billing (deliberate, do not collapse):
 *   - `subscriptions.plan_type` ('trial' | 'core' | 'pro') is a BILLING value. It is owned by the
 *     billing consolidation and is never renamed here.
 *   - `MembershipTier` ('DISCOVER' | 'GROW' | 'THRIVE') is a PRODUCT value. It is derived from the
 *     billing value by the resolver and is the only tier vocabulary features may branch on.
 */

// ---------------------------------------------------------------------------
// Membership tiers
// ---------------------------------------------------------------------------

/** The only three memberships that exist. Ordered lowest → highest. */
export const MEMBERSHIP_TIERS = ['DISCOVER', 'GROW', 'THRIVE'] as const;
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

/**
 * Lifecycle state of the membership, normalized from the raw `subscriptions.status` string.
 *
 * `NONE` means "no subscription row resolved" — which the rest of the system already treats as
 * Discover (every existing caller defaults a missing subscription to `'trial'`). It is kept
 * distinct from `ACTIVE` so diagnostics can tell "fresh Discover" from "provisioned Discover".
 */
export const MEMBERSHIP_STATUSES = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
  'NONE',
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Depth of challenge content a membership may reach. Ordered lowest → highest. */
export const CHALLENGE_ACCESS_LEVELS = ['NONE', 'CORE', 'FULL'] as const;
export type ChallengeAccessLevel = (typeof CHALLENGE_ACCESS_LEVELS)[number];

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Every boolean capability the engine answers. Adding a member here is a compile-time contract:
 * `MEMBERSHIP_TIER_MATRIX` must supply a value for it on all three tiers, and
 * `MembershipEntitlements` gains the field automatically.
 */
export const ENTITLEMENT_CAPABILITIES = [
  'canUseAI',
  'canPurchaseMinutes',
  'canCreateJournal',
  'canUseMoodTracking',
  'canUseSleepTracking',
  'canUseBrainHealth',
  'canUseCommunity',
  'canViewInsights',
  'canExportReports',
] as const;
export type EntitlementCapability = (typeof ENTITLEMENT_CAPABILITIES)[number];

export type CapabilityMap = Record<EntitlementCapability, boolean>;

/**
 * Named non-boolean-capability toggles carried through from the tier matrix.
 *
 * These exist so product can express "Thrive gets X" without minting a new top-level capability
 * (and therefore without touching every consumer). Keys are open by design; unknown keys read as
 * `false` via `hasFeatureFlag`.
 */
export const ENTITLEMENT_FEATURE_FLAGS = [
  'usageDashboard',
  'avatarCustomization',
  'fullWellnessLibrary',
  'detailedSessionLogs',
  'prioritySupport',
] as const;
export type EntitlementFeatureFlag = (typeof ENTITLEMENT_FEATURE_FLAGS)[number];

export type FeatureFlagMap = Readonly<Record<string, boolean>>;

// ---------------------------------------------------------------------------
// History window
// ---------------------------------------------------------------------------

/**
 * How far back a member may read their own history.
 *
 * `days: null` means unlimited. Phase 1 does not enforce this — it is published so Phase 2 has a
 * single number to read instead of each feature inventing its own lookback.
 */
export interface HistoryWindow {
  readonly days: number | null;
}

// ---------------------------------------------------------------------------
// Restrictions and upgrade reasons
// ---------------------------------------------------------------------------

export const RESTRICTION_CODES = [
  /** Membership window has passed; access collapses to the locked baseline. */
  'MEMBERSHIP_EXPIRED',
  /** Balance is zero. Distinct from expiry: the membership is fine, the wallet is not. */
  'NO_MINUTES_REMAINING',
  /** Pay-as-you-go is a paid-membership benefit (mirrors `payAsYouGoRate: null` on trial). */
  'PAYG_REQUIRES_PAID_MEMBERSHIP',
  /** Capability sits above the member's tier. */
  'REQUIRES_HIGHER_MEMBERSHIP',
  /** Payment failed but access is retained as a grace period (see resolver notes). */
  'PAYMENT_PAST_DUE',
] as const;
export type RestrictionCode = (typeof RESTRICTION_CODES)[number];

export interface Restriction {
  readonly code: RestrictionCode;
  /** Operator/diagnostic text. NOT user-facing copy — copy is out of scope for this project. */
  readonly message: string;
  /** The capability this restriction denied, when it is capability-specific. */
  readonly capability?: EntitlementCapability;
}

export interface UpgradeReason {
  readonly capability: EntitlementCapability;
  readonly currentMembership: MembershipTier;
  /** Lowest membership that grants `capability`. */
  readonly requiredMembership: MembershipTier;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * The raw evidence the resolver decided from. Carried on every result so a wrong answer can be
 * explained without re-querying, and so tests can assert on the mapping rather than the outcome.
 */
export interface EntitlementSource {
  /** Raw `subscriptions.plan_type`, unmapped. `null` when no subscription resolved. */
  readonly internalPlanType: string | null;
  /** Raw `subscriptions.status`, unmapped. */
  readonly internalStatus: string | null;
  /** Raw `subscriptions.end_date`, as an ISO string for log/serialization safety. */
  readonly subscriptionEndsAt: string | null;
  /** True when the internal plan value was not recognized and the default membership was used. */
  readonly planUnrecognized: boolean;
  /**
   * True when a NON-EMPTY `subscriptions.status` was not recognized and the membership fell
   * through to `NONE`. A genuinely absent status is not "unrecognized" and does not set this.
   *
   * Both flags exist so a corrupt or newly-introduced database value is observable rather than
   * silently absorbed by a default — they are the diagnostic contract for the unconstrained
   * `plan_type` / `status` string columns.
   */
  readonly statusUnrecognized: boolean;
  /** True when an admin override changed any field of the result. */
  readonly overrideApplied: boolean;
  /** Instant the decision was made, from the injected clock. */
  readonly resolvedAt: string;
}

// ---------------------------------------------------------------------------
// The canonical result
// ---------------------------------------------------------------------------

/**
 * The single object every permission decision in the product is derived from.
 *
 * Fully materialized on purpose: no lazy getters, no promises, no back-references to Prisma. It
 * is a plain value, safe to log, snapshot in a test, or serialize to the client later.
 */
export interface MembershipEntitlements extends CapabilityMap {
  readonly membership: MembershipTier;
  readonly status: MembershipStatus;

  /**
   * Whole minutes remaining, `ceil`-rounded to match what `/users/me` already reports.
   * Use `remainingSeconds` for any comparison — that is the authoritative figure.
   */
  readonly remainingMinutes: number;
  readonly remainingSeconds: number;

  readonly challengeAccessLevel: ChallengeAccessLevel;
  /** `null` means unlimited. */
  readonly maxActiveChallenges: number | null;
  readonly historyWindow: HistoryWindow;

  readonly featureFlags: FeatureFlagMap;
  readonly restrictions: readonly Restriction[];
  readonly upgradeReasons: readonly UpgradeReason[];

  readonly source: EntitlementSource;
}

// ---------------------------------------------------------------------------
// Resolver input
// ---------------------------------------------------------------------------

/**
 * Everything the pure resolver is allowed to see.
 *
 * The clock is an input rather than a call to `Date.now()` so the resolver stays deterministic:
 * the same facts always produce the same entitlements, which is what makes expiry testable.
 */
export interface EntitlementFacts {
  readonly userId: string;
  /** Raw `subscriptions.plan_type`. `null` when the user has no resolvable subscription. */
  readonly internalPlanType: string | null;
  /** Raw `subscriptions.status`. */
  readonly subscriptionStatus: string | null;
  /** Raw `subscriptions.end_date`. */
  readonly subscriptionEndDate: Date | null;
  /** Combined subscription + purchased balance, in seconds. */
  readonly remainingSeconds: number;
  /** Injected clock. */
  readonly now: Date;
  /** Applied last, after every degradation rule. See `entitlements.overrides.ts`. */
  readonly override?: EntitlementOverride | null;
}

// ---------------------------------------------------------------------------
// Admin override
// ---------------------------------------------------------------------------

/**
 * A hook shape only — Phase 1 ships no admin UI, no storage, and no default provider.
 *
 * Every field is optional and every supplied field wins over the resolved value, including
 * re-granting access to an expired membership. That is intentional: support unblocking a member
 * is the whole reason the hook exists.
 */
export interface EntitlementOverride {
  readonly membership?: MembershipTier;
  readonly status?: MembershipStatus;
  readonly capabilities?: Partial<CapabilityMap>;
  readonly challengeAccessLevel?: ChallengeAccessLevel;
  readonly maxActiveChallenges?: number | null;
  readonly historyWindow?: HistoryWindow;
  readonly featureFlags?: Record<string, boolean>;
  /** Free-text audit note. Surfaced in logs, never in product copy. */
  readonly reason?: string;
  /** Admin user id, for audit trails a later phase may add. */
  readonly grantedBy?: string;
}
