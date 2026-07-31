/**
 * Membership Entitlements V1 — public API.
 *
 * Import from `'../entitlements'`. Nothing outside this module should reach into its files
 * directly; the barrel is the contract, and keeping it narrow is what stops a second resolver
 * from growing beside the first.
 *
 * =========================================================================================
 * ARCHITECTURE RULE (Phase 1B onward)
 * =========================================================================================
 *
 * A feature module MUST NOT decide membership permissions by:
 *   - querying `subscriptions` directly;
 *   - comparing `plan_type` ('trial' / 'core' / 'pro') directly;
 *   - reading `PLAN_LIMITS` for authorization;
 *   - re-implementing trial-expiry or PAYG-eligibility policy.
 *
 * All of it goes through this module.
 *
 * BILLING KEEPS THE MONEY. `PLAN_LIMITS` remains the authority for prices, included minutes,
 * PAYG rates, Stripe configuration and customer-facing billing metadata. Financial configuration
 * must NOT move here — this module answers "is this permitted", never "what does it cost".
 * `payg.service` is the reference example: entitlements decide eligibility, billing decides rate.
 *
 * STILL ALLOWED, because none of it is authorization: reading `plan_type` or `PLAN_LIMITS` to
 * DISPLAY a plan (`/users/me`, community profile badges) or to run admin reporting and tooling.
 *
 * BEFORE BUILDING A NEW GATE, call `assertEnforceable(dimension)`. Most dimensions in the tier
 * matrix are still PROVISIONAL (inferred, never product-approved) and must not restrict anyone —
 * see `ENTITLEMENT_POLICY_STATUS` in `entitlements.config.ts`.
 */

// --- The resolver ---
export { getMembershipEntitlements, loadEntitlementFacts } from './entitlements.service';
export type { GetEntitlementsOptions } from './entitlements.service';

export {
  resolveEntitlements,
  resolveMembershipStatus,
  mapInternalPlanToMembership,
  lowestMembershipGranting,
  isAtLeastMembership,
  isAtLeastChallengeAccess,
} from './entitlements.resolver';

// --- Authorization helpers ---
export {
  EntitlementError,
  hasEntitlement,
  requireEntitlement,
  hasMembership,
  assertMembership,
  hasChallengeAccess,
  assertChallengeAccess,
  hasFeatureFlag,
  requireEntitlementForUser,
  hasEntitlementForUser,
  assertMembershipForUser,
} from './entitlements.guards';

// --- Fastify route guard (Phase 2A) ---
export {
  requireEntitlementRoute,
  ENTITLEMENT_ROUTE_ERROR_CODES,
} from './entitlements.route-guard';
export type { RequireEntitlementRouteOptions } from './entitlements.route-guard';

// --- Admin override hook (no default provider — see entitlements.overrides.ts) ---
export {
  registerEntitlementOverrideProvider,
  clearEntitlementOverrideProvider,
  hasEntitlementOverrideProvider,
  resolveEntitlementOverride,
} from './entitlements.overrides';
export type { EntitlementOverrideProvider } from './entitlements.overrides';

// --- Configuration (read-only; retuning happens in entitlements.config.ts) ---
export {
  MEMBERSHIP_TIER_MATRIX,
  INTERNAL_PLAN_TO_MEMBERSHIP,
  MEMBERSHIP_RANK,
  CHALLENGE_ACCESS_RANK,
  DEFAULT_MEMBERSHIP,
  ENTITLEMENT_POLICY_STATUS,
  getPolicyStatus,
  assertEnforceable,
  getApprovedMaxActiveChallenges,
} from './entitlements.config';
export type { TierDefinition, PolicyStatus } from './entitlements.config';

// --- Model ---
export {
  MEMBERSHIP_TIERS,
  MEMBERSHIP_STATUSES,
  CHALLENGE_ACCESS_LEVELS,
  ENTITLEMENT_CAPABILITIES,
  ENTITLEMENT_FEATURE_FLAGS,
  RESTRICTION_CODES,
} from './entitlements.types';
export type {
  MembershipTier,
  MembershipStatus,
  ChallengeAccessLevel,
  EntitlementCapability,
  EntitlementFeatureFlag,
  CapabilityMap,
  FeatureFlagMap,
  HistoryWindow,
  Restriction,
  RestrictionCode,
  UpgradeReason,
  EntitlementSource,
  MembershipEntitlements,
  EntitlementFacts,
  EntitlementOverride,
} from './entitlements.types';
