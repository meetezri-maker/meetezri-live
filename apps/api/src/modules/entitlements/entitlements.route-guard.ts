/**
 * Membership Entitlements — Fastify route guard (Phase 2A).
 *
 * Declarative membership gating for routes, composable with the existing auth middleware:
 *
 *   preHandler: [app.authenticate, requireEntitlementRoute('canExportReports')]
 *   preHandler: [app.authenticate, app.authorize(['super_admin']), requireEntitlementRoute('canX')]
 *
 * ORTHOGONAL TO ROLE. `app.authorize()` gates on app ROLE (super_admin / org_admin / team_admin);
 * this gates on MEMBERSHIP. A route may use both, in either order, and neither is expressed in
 * terms of the other. Keeping them separate is a Phase 1 invariant.
 *
 * A plain factory rather than a Fastify decorator, deliberately: it composes inside the existing
 * `preHandler` arrays with no plugin-registration order to get wrong, and it stays unit-testable
 * without booting a server.
 *
 * NOT APPLIED TO ANY PRODUCTION ROUTE IN PHASE 2A. The infrastructure ships now; wiring it is
 * Phase 2B, and only for dimensions product has approved.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { assertEnforceable } from './entitlements.config';
import { getMembershipEntitlements } from './entitlements.service';
import { hasEntitlement } from './entitlements.guards';
import type { EntitlementCapability, MembershipEntitlements } from './entitlements.types';

/** Stable machine-readable codes. Clients may branch on these; do not rename. */
export const ENTITLEMENT_ROUTE_ERROR_CODES = {
  /** The guard ran without an authenticated user — `app.authenticate` was not registered first. */
  unauthenticated: 'UNAUTHENTICATED',
  /** Authenticated, but the membership does not grant the capability. */
  denied: 'ENTITLEMENT_REQUIRED',
  /** Entitlements could not be resolved. Not an authorization decision — see below. */
  unavailable: 'ENTITLEMENT_RESOLUTION_UNAVAILABLE',
} as const;

export interface RequireEntitlementRouteOptions {
  /**
   * Overrides the default denial message. Keep it short and user-appropriate; it may be surfaced
   * verbatim by a client. Never interpolate diagnostics into it.
   */
  message?: string;
}

/**
 * Where the authenticated user id lives on the request.
 *
 * `request.user.sub` is what every existing handler reads (see `wellness.controller.ts`,
 * `sessions` routes); `id` is accepted as a defensive fallback only.
 */
function readUserId(request: FastifyRequest): string | null {
  const user = request.user as { sub?: unknown; id?: unknown } | undefined;
  if (!user) return null;
  if (typeof user.sub === 'string' && user.sub) return user.sub;
  if (typeof user.id === 'string' && user.id) return user.id;
  return null;
}

/**
 * Build a `preHandler` that requires `capability`.
 *
 * `assertEnforceable` runs at CONSTRUCTION time, not per request: wiring a PROVISIONAL capability
 * to a route then fails at module load / route registration — loudly, at deploy — rather than
 * silently restricting members at runtime. This is the backstop that stops an inferred policy
 * from becoming a production restriction by accident.
 */
export function requireEntitlementRoute(
  capability: EntitlementCapability,
  options: RequireEntitlementRouteOptions = {}
) {
  assertEnforceable(capability);

  return async function entitlementPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const userId = readUserId(request);

    if (!userId) {
      // Should be unreachable when composed after `app.authenticate`. Fail closed rather than
      // resolving entitlements for an anonymous caller.
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: ENTITLEMENT_ROUTE_ERROR_CODES.unauthenticated,
        message: 'Authentication required',
      });
      return reply;
    }

    let entitlements: MembershipEntitlements;
    try {
      entitlements = await getMembershipEntitlements(userId);
    } catch (error) {
      // Fail CLOSED, but do not lie about why. A resolver outage is an infrastructure fault, not
      // a membership decision — answering 403 "upgrade your membership" would send members to a
      // checkout page to fix our database. 503 denies access and stays honest.
      request.log?.error?.(
        { err: error, userId, capability },
        '[entitlements] route guard could not resolve entitlements'
      );
      reply.code(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        code: ENTITLEMENT_ROUTE_ERROR_CODES.unavailable,
        message: 'Unable to verify your membership right now. Please try again.',
      });
      return reply;
    }

    if (hasEntitlement(entitlements, capability)) {
      return; // Allowed — fall through to the next preHandler / the handler.
    }

    // Only the membership tier and the required tier leave the process. No subscription row,
    // no plan_type, no balance, no `source` diagnostics, no Stripe identifiers.
    const upgrade = entitlements.upgradeReasons.find((r) => r.capability === capability);

    reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      code: ENTITLEMENT_ROUTE_ERROR_CODES.denied,
      message: options.message ?? 'This feature is not available on your membership.',
      membership: entitlements.membership,
      // Present only when a higher membership actually grants it — never as a blanket upsell.
      ...(upgrade ? { requiredMembership: upgrade.requiredMembership } : {}),
    });
    return reply;
  };
}
