/**
 * Membership Entitlements V1 — fact gathering.
 *
 * The impure shell around the pure resolver. Its entire job is to collect the four facts the
 * resolver needs and hand them over; it contains no policy of its own.
 *
 * CACHING — no new cache is introduced, by design.
 *
 *   Entitlements are DERIVED, never stored. Every read recomputes them from upstream sources
 *   that already own their own caching and, critically, their own invalidation:
 *
 *     - membership + status  ← `billing.getSubscription()`, 30s in-memory cache, invalidated by
 *                              `clearUserBillingCaches()` on every subscription mutation inside
 *                              `subscription.service.ts` (checkout link, update, cancel, sync).
 *     - remaining balance    ← a direct, uncached `profiles` read. Deliberate: this is the same
 *                              freshness contract `assertSessionStartAllowed` already uses for
 *                              the balance check, and minutes move mid-session.
 *
 *   Because nothing is stored, there is nothing to invalidate. The required invalidation triggers
 *   from the brief — membership change, subscription change, credit change, trial expiry, admin
 *   membership change — are satisfied structurally rather than by a second invalidation graph
 *   that could drift out of sync with the billing one. Trial expiry needs no invalidation at all:
 *   it is computed from `end_date` against the injected clock on every call.
 *
 *   A second cache would be strictly worse here: it would have to subscribe to billing's
 *   invalidation points (which are module-private), and a stale entitlement is an access-control
 *   defect, not just a stale display value.
 */

import prisma from '../../lib/prisma';
// Imported from the subscription service directly, NOT from the `../billing` barrel.
//
// The barrel re-exports `payg.service`, and `payg.service` now asks this module for the
// `canPurchaseMinutes` entitlement — going through the barrel would close that loop into a
// circular import. Depending on the narrower module keeps the dependency arrow one-way
// (entitlements -> subscription resolution) and is what the barrel would have resolved to anyway.
import { getSubscription } from '../billing/services/subscription.service';
import { resolveProfileRemainingSeconds } from '../billing/credit-balance.service';
import { resolveEntitlements } from './entitlements.resolver';
import { resolveEntitlementOverride } from './entitlements.overrides';
import type {
  EntitlementFacts,
  EntitlementOverride,
  MembershipEntitlements,
} from './entitlements.types';

export interface GetEntitlementsOptions {
  /**
   * Override the clock. Test-only affordance that keeps expiry assertions deterministic without
   * mocking global time.
   */
  now?: Date;
  /**
   * Skip the registered override provider. Used by any future admin screen that needs to show
   * "what would this member get without their override".
   */
  skipOverride?: boolean;
  /**
   * Supply an override directly, bypassing the provider. Takes precedence over `skipOverride`.
   */
  override?: EntitlementOverride | null;
}

/**
 * THE resolver entry point. Every permission decision in the product must eventually come
 * through this function (or through `resolveEntitlements` directly, when the caller already
 * holds the facts).
 */
export async function getMembershipEntitlements(
  userId: string,
  options: GetEntitlementsOptions = {}
): Promise<MembershipEntitlements> {
  const facts = await loadEntitlementFacts(userId, options);
  const entitlements = resolveEntitlements(facts);
  reportUnrecognizedValues(userId, entitlements);
  return entitlements;
}

/**
 * Surface corrupt or newly-introduced database values instead of absorbing them into a default.
 *
 * `plan_type` and `status` are unconstrained string columns, so a typo or a Stripe status this
 * engine has never seen would otherwise silently resolve to Discover / NONE. Logging lives here,
 * in the impure shell — the resolver stays pure and merely sets the flags.
 *
 * Logs the offending column values (operational data, already in application logs elsewhere) and
 * the user id; never balances, names, emails, or Stripe identifiers.
 */
function reportUnrecognizedValues(userId: string, entitlements: MembershipEntitlements): void {
  const { planUnrecognized, statusUnrecognized, internalPlanType, internalStatus } =
    entitlements.source;

  if (!planUnrecognized && !statusUnrecognized) return;

  console.warn('[entitlements] unrecognized subscription value; resolved with safe defaults', {
    userId,
    ...(planUnrecognized ? { unrecognizedPlanType: internalPlanType } : {}),
    ...(statusUnrecognized ? { unrecognizedStatus: internalStatus } : {}),
    resolvedMembership: entitlements.membership,
    resolvedStatus: entitlements.status,
  });
}

/**
 * Gather the resolver's inputs.
 *
 * Exported so a future batch/admin path can collect facts differently (a join across many users,
 * say) and still resolve through the one canonical resolver.
 */
export async function loadEntitlementFacts(
  userId: string,
  options: GetEntitlementsOptions = {}
): Promise<EntitlementFacts> {
  const [subscription, profile] = await Promise.all([
    // Canonical membership source. Delegating — rather than querying `subscriptions` here — is
    // what keeps "which row counts" a billing decision: newest non-incomplete row, with
    // cancelled-and-past-end already collapsed to null.
    getSubscription(userId),
    prisma.profiles.findUnique({
      where: { id: userId },
      select: {
        credits: true,
        credits_seconds: true,
        purchased_credits: true,
        purchased_credits_seconds: true,
      },
    }),
  ]);

  const override = options.override !== undefined
    ? options.override
    : options.skipOverride
      ? null
      : await resolveEntitlementOverride(userId);

  return {
    userId,
    internalPlanType: subscription?.plan_type ?? null,
    subscriptionStatus: subscription?.status ?? null,
    subscriptionEndDate: subscription?.end_date ?? null,
    // A missing profile reads as a zero balance rather than an error: the resolver's job is to
    // describe access, and "no profile" is unambiguously "no minutes".
    remainingSeconds: profile ? resolveProfileRemainingSeconds(profile) : 0,
    now: options.now ?? new Date(),
    override,
  };
}
