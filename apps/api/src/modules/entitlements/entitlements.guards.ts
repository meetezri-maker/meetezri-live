/**
 * Membership Entitlements V1 — standard authorization helpers.
 *
 * These become the ONLY way a feature asks "is this allowed". They are deliberately thin: all
 * policy lives in the resolver, and these functions only phrase the question and throw the
 * error.
 *
 * NOT WIRED IN PHASE 1. No feature calls these yet — enforcement is Phase 2 (see the project
 * brief: "Do NOT enforce Journal / Mood / Sleep / Community / Challenges / Reports / Brain
 * Health / AI"). They ship now so Phase 2 is a call-site change, not a design exercise.
 *
 * Relationship to `authorize()` in `plugins/auth.ts`: orthogonal and must stay so. `authorize()`
 * gates on ROLE (`super_admin`/`org_admin`/`team_admin`). These gate on MEMBERSHIP. A route may
 * use both; neither may be expressed in terms of the other.
 */

import { isAtLeastChallengeAccess, isAtLeastMembership } from './entitlements.resolver';
import { getMembershipEntitlements, type GetEntitlementsOptions } from './entitlements.service';
import type {
  ChallengeAccessLevel,
  EntitlementCapability,
  MembershipEntitlements,
  MembershipTier,
  Restriction,
} from './entitlements.types';

/**
 * Thrown when a membership check fails.
 *
 * Carries `statusCode` so the existing Fastify error handling maps it to a 403 the same way
 * `community.service.ts` and `sessions.service.ts` already map their thrown errors, and `code`
 * so a client can branch on the reason without parsing the message.
 */
export class EntitlementError extends Error {
  readonly statusCode = 403;
  readonly code: string;
  readonly capability?: EntitlementCapability;
  readonly membership: MembershipTier;
  readonly restrictions: readonly Restriction[];

  constructor(
    message: string,
    details: {
      code: string;
      membership: MembershipTier;
      capability?: EntitlementCapability;
      restrictions?: readonly Restriction[];
    }
  ) {
    super(message);
    this.name = 'EntitlementError';
    this.code = details.code;
    this.capability = details.capability;
    this.membership = details.membership;
    this.restrictions = details.restrictions ?? [];
  }
}

// ---------------------------------------------------------------------------
// Synchronous helpers — for callers that already hold an entitlements object
// ---------------------------------------------------------------------------

/** Non-throwing capability check. */
export function hasEntitlement(
  entitlements: MembershipEntitlements,
  capability: EntitlementCapability
): boolean {
  return entitlements[capability] === true;
}

/**
 * Throwing capability check.
 *
 * The error carries the resolver's own restriction list, so the reason a member was denied
 * (expired vs. empty wallet vs. wrong tier) is never re-derived at the call site.
 */
export function requireEntitlement(
  entitlements: MembershipEntitlements,
  capability: EntitlementCapability
): void {
  if (hasEntitlement(entitlements, capability)) return;

  const relevant = entitlements.restrictions.filter(
    (r) => r.capability === capability || r.capability === undefined
  );
  const upgrade = entitlements.upgradeReasons.find((r) => r.capability === capability);

  const detail = upgrade
    ? `Requires ${upgrade.requiredMembership} membership.`
    : relevant[0]?.message ?? 'Not available on your membership.';

  throw new EntitlementError(`${capability} is not available. ${detail}`, {
    code: 'ENTITLEMENT_DENIED',
    membership: entitlements.membership,
    capability,
    restrictions: relevant,
  });
}

/** Non-throwing tier floor check. */
export function hasMembership(
  entitlements: MembershipEntitlements,
  minimum: MembershipTier
): boolean {
  return isAtLeastMembership(entitlements.membership, minimum);
}

/**
 * Throwing tier floor check.
 *
 * Prefer `requireEntitlement` wherever a capability exists: gating on a named capability keeps
 * the tier matrix the single place a repricing has to touch. Reach for `assertMembership` only
 * when the gate genuinely is about the tier itself.
 */
export function assertMembership(
  entitlements: MembershipEntitlements,
  minimum: MembershipTier
): void {
  if (hasMembership(entitlements, minimum)) return;

  throw new EntitlementError(
    `This requires a ${minimum} membership or higher (current: ${entitlements.membership}).`,
    {
      code: 'MEMBERSHIP_REQUIRED',
      membership: entitlements.membership,
      restrictions: entitlements.restrictions,
    }
  );
}

/** Non-throwing challenge-depth check. */
export function hasChallengeAccess(
  entitlements: MembershipEntitlements,
  minimum: ChallengeAccessLevel
): boolean {
  return isAtLeastChallengeAccess(entitlements.challengeAccessLevel, minimum);
}

/** Throwing challenge-depth check. */
export function assertChallengeAccess(
  entitlements: MembershipEntitlements,
  minimum: ChallengeAccessLevel
): void {
  if (hasChallengeAccess(entitlements, minimum)) return;

  throw new EntitlementError(
    `This challenge requires ${minimum} access (current: ${entitlements.challengeAccessLevel}).`,
    {
      code: 'CHALLENGE_ACCESS_REQUIRED',
      membership: entitlements.membership,
      restrictions: entitlements.restrictions,
    }
  );
}

/** Non-throwing feature-flag read. Unknown flags read as `false`. */
export function hasFeatureFlag(entitlements: MembershipEntitlements, flag: string): boolean {
  return entitlements.featureFlags[flag] === true;
}

// ---------------------------------------------------------------------------
// Async helpers — for callers that only hold a userId
// ---------------------------------------------------------------------------

/**
 * Resolve then check, in one call.
 *
 * A handler needing more than one gate should call `getMembershipEntitlements` once and use the
 * synchronous helpers, rather than calling these repeatedly — each of these resolves afresh.
 */
export async function requireEntitlementForUser(
  userId: string,
  capability: EntitlementCapability,
  options?: GetEntitlementsOptions
): Promise<MembershipEntitlements> {
  const entitlements = await getMembershipEntitlements(userId, options);
  requireEntitlement(entitlements, capability);
  return entitlements;
}

export async function hasEntitlementForUser(
  userId: string,
  capability: EntitlementCapability,
  options?: GetEntitlementsOptions
): Promise<boolean> {
  const entitlements = await getMembershipEntitlements(userId, options);
  return hasEntitlement(entitlements, capability);
}

export async function assertMembershipForUser(
  userId: string,
  minimum: MembershipTier,
  options?: GetEntitlementsOptions
): Promise<MembershipEntitlements> {
  const entitlements = await getMembershipEntitlements(userId, options);
  assertMembership(entitlements, minimum);
  return entitlements;
}
