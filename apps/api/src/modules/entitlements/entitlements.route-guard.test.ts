/**
 * PHASE 2A — Fastify entitlement route guard.
 *
 * Exercises the guard as a `preHandler` against a stubbed request/reply pair rather than a booted
 * server: the guard's contract is entirely "what does it send and does it fall through", which is
 * fully observable here and stays fast.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn() },
};
const mockBilling = { getSubscription: jest.fn() };

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../billing/services/subscription.service', () => mockBilling);

import {
  requireEntitlementRoute,
  ENTITLEMENT_ROUTE_ERROR_CODES,
} from './entitlements.route-guard';

const USER_ID = 'guard-user';

function buildReply() {
  const reply: any = {
    statusCode: undefined as number | undefined,
    payload: undefined as any,
    code(status: number) {
      reply.statusCode = status;
      return reply;
    },
    send(body: unknown) {
      reply.payload = body;
      return reply;
    },
  };
  return reply;
}

function buildRequest(user?: unknown) {
  return {
    user,
    log: { error: jest.fn(), warn: jest.fn() },
  } as any;
}

function arrangeMembership(planType: string | null) {
  mockBilling.getSubscription.mockResolvedValue(
    planType ? { plan_type: planType, status: 'active', end_date: null } : null
  );
  mockPrisma.profiles.findUnique.mockResolvedValue({
    credits: 100,
    credits_seconds: 6000,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
  });
}

let seq = 0;
/** `getSubscription` memoizes per user for 30s, so each case needs its own id. */
function nextUserId(label: string) {
  seq += 1;
  return `${USER_ID}-${label}-${seq}`;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Construction-time policy protection
// ---------------------------------------------------------------------------

describe('provisional capability rejection', () => {
  it('refuses to build a guard for a PROVISIONAL capability', () => {
    // Fails at route registration, not per request — an unapproved policy can never reach a member.
    expect(() => requireEntitlementRoute('canExportReports')).toThrow(/PROVISIONAL/);
    expect(() => requireEntitlementRoute('canViewInsights')).toThrow(/PROVISIONAL/);
    expect(() => requireEntitlementRoute('canUseBrainHealth')).toThrow(/PROVISIONAL/);
  });

  it('builds a guard for an ENFORCED capability', () => {
    expect(() => requireEntitlementRoute('canUseAI')).not.toThrow();
    expect(() => requireEntitlementRoute('canPurchaseMinutes')).not.toThrow();
  });

  it('builds a guard for the Phase 7 APPROVED capabilities', () => {
    // Option A promoted these four, which is what makes them gateable at all.
    expect(() => requireEntitlementRoute('canCreateJournal')).not.toThrow();
    expect(() => requireEntitlementRoute('canUseMoodTracking')).not.toThrow();
    expect(() => requireEntitlementRoute('canUseWellnessTools')).not.toThrow();
    expect(() => requireEntitlementRoute('canViewSessionHistory')).not.toThrow();
  });

  it('names the dimension and the remedy in the failure', () => {
    expect(() => requireEntitlementRoute('canExportReports')).toThrow(/canExportReports/);
    expect(() => requireEntitlementRoute('canExportReports')).toThrow(/ENTITLEMENT_POLICY_STATUS/);
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe('unauthenticated request', () => {
  it('rejects with 401 when no user is attached', async () => {
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const reply = buildReply();

    await guard(buildRequest(undefined), reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      code: ENTITLEMENT_ROUTE_ERROR_CODES.unauthenticated,
    });
  });

  it('never resolves entitlements for an anonymous caller', async () => {
    const guard = requireEntitlementRoute('canPurchaseMinutes');

    await guard(buildRequest({}), buildReply());

    expect(mockBilling.getSubscription).not.toHaveBeenCalled();
  });

  it('reads the user id from request.user.sub, as every handler does', async () => {
    const userId = nextUserId('sub');
    arrangeMembership('core');
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const reply = buildReply();

    await guard(buildRequest({ sub: userId }), reply);

    expect(mockBilling.getSubscription).toHaveBeenCalledWith(userId);
    expect(reply.statusCode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Authorized / denied
// ---------------------------------------------------------------------------

describe('authenticated and entitled', () => {
  it('falls through without touching the reply', async () => {
    const userId = nextUserId('entitled');
    arrangeMembership('pro');
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const reply = buildReply();

    const result = await guard(buildRequest({ sub: userId }), reply);

    expect(result).toBeUndefined();
    expect(reply.statusCode).toBeUndefined();
    expect(reply.payload).toBeUndefined();
  });
});

describe('authenticated but not entitled', () => {
  it('rejects with 403 and the stable code', async () => {
    const userId = nextUserId('denied');
    arrangeMembership('trial'); // DISCOVER cannot purchase minutes
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const reply = buildReply();

    await guard(buildRequest({ sub: userId }), reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toMatchObject({
      statusCode: 403,
      error: 'Forbidden',
      code: ENTITLEMENT_ROUTE_ERROR_CODES.denied,
      membership: 'DISCOVER',
      requiredMembership: 'GROW',
    });
  });

  it('leaks no subscription, plan, balance, or resolver diagnostics', async () => {
    const userId = nextUserId('leak');
    arrangeMembership('trial');
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const reply = buildReply();

    await guard(buildRequest({ sub: userId }), reply);

    const keys = Object.keys(reply.payload);
    expect(keys.sort()).toEqual(
      ['code', 'error', 'membership', 'message', 'requiredMembership', 'statusCode'].sort()
    );
    const serialized = JSON.stringify(reply.payload);
    for (const forbidden of ['trial', 'core', 'pro', 'source', 'remainingSeconds', 'stripe']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('omits requiredMembership when no higher tier grants the capability', async () => {
    const userId = nextUserId('no-upgrade');
    arrangeMembership('pro');
    mockPrisma.profiles.findUnique.mockResolvedValue({
      credits: 0,
      credits_seconds: 0,
      purchased_credits: 0,
      purchased_credits_seconds: 0,
    });
    // THRIVE with an empty wallet: canUseAI is false, but upgrading fixes nothing.
    const guard = requireEntitlementRoute('canUseAI');
    const reply = buildReply();

    await guard(buildRequest({ sub: userId }), reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.payload).not.toHaveProperty('requiredMembership');
  });

  it('honours a custom denial message', async () => {
    const userId = nextUserId('custom-msg');
    arrangeMembership('trial');
    const guard = requireEntitlementRoute('canPurchaseMinutes', {
      message: 'Top-ups are a paid-membership benefit.',
    });
    const reply = buildReply();

    await guard(buildRequest({ sub: userId }), reply);

    expect(reply.payload.message).toBe('Top-ups are a paid-membership benefit.');
  });
});

// ---------------------------------------------------------------------------
// Resolver failure
// ---------------------------------------------------------------------------

describe('resolver failure', () => {
  it('fails closed with 503 rather than a misleading 403', async () => {
    const userId = nextUserId('resolver-down');
    mockBilling.getSubscription.mockRejectedValue(new Error('database unavailable'));
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const reply = buildReply();

    await guard(buildRequest({ sub: userId }), reply);

    // Access denied, but not attributed to the member's membership — a 403 here would send them
    // to a checkout page to fix our outage.
    expect(reply.statusCode).toBe(503);
    expect(reply.payload).toMatchObject({
      statusCode: 503,
      code: ENTITLEMENT_ROUTE_ERROR_CODES.unavailable,
    });
    expect(reply.payload).not.toHaveProperty('requiredMembership');
  });

  it('logs the failure without putting the cause in the response', async () => {
    const userId = nextUserId('resolver-log');
    mockBilling.getSubscription.mockRejectedValue(new Error('secret connection string'));
    const guard = requireEntitlementRoute('canPurchaseMinutes');
    const request = buildRequest({ sub: userId });
    const reply = buildReply();

    await guard(request, reply);

    expect(request.log.error).toHaveBeenCalled();
    expect(JSON.stringify(reply.payload)).not.toContain('secret connection string');
  });

  it('does not throw, so it cannot escape into the global 500 handler', async () => {
    const userId = nextUserId('resolver-nothrow');
    mockBilling.getSubscription.mockRejectedValue(new Error('boom'));
    const guard = requireEntitlementRoute('canPurchaseMinutes');

    await expect(guard(buildRequest({ sub: userId }), buildReply())).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Composition with role middleware
// ---------------------------------------------------------------------------

describe('composition with authorize()', () => {
  /** Mirrors `fastify.decorate('authorize', ...)` in plugins/auth.ts. */
  function authorize(allowedRoles: string[]) {
    return async (request: any, reply: any) => {
      const user = request.user;
      if (!user || !user.appRole || !allowedRoles.includes(user.appRole)) {
        reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Access denied: Requires one of [${allowedRoles.join(', ')}] role`,
        });
        return reply;
      }
    };
  }

  /** Runs a preHandler chain the way Fastify does: stop once a reply has been sent. */
  async function runChain(chain: Array<(req: any, rep: any) => Promise<unknown>>, request: any) {
    const reply = buildReply();
    for (const handler of chain) {
      await handler(request, reply);
      if (reply.statusCode !== undefined) break;
    }
    return reply;
  }

  it('passes when both role and membership allow', async () => {
    const userId = nextUserId('role-and-membership-ok');
    arrangeMembership('pro');

    const reply = await runChain(
      [authorize(['super_admin']), requireEntitlementRoute('canPurchaseMinutes')],
      buildRequest({ sub: userId, appRole: 'super_admin' })
    );

    expect(reply.statusCode).toBeUndefined();
  });

  it('role failure short-circuits before entitlements are resolved', async () => {
    const userId = nextUserId('role-fails');
    arrangeMembership('pro');

    const reply = await runChain(
      [authorize(['super_admin']), requireEntitlementRoute('canPurchaseMinutes')],
      buildRequest({ sub: userId, appRole: 'user' })
    );

    expect(reply.statusCode).toBe(403);
    expect(reply.payload.message).toMatch(/Requires one of/);
    expect(mockBilling.getSubscription).not.toHaveBeenCalled();
  });

  it('membership failure is reported separately from role failure', async () => {
    const userId = nextUserId('membership-fails');
    arrangeMembership('trial');

    const reply = await runChain(
      [authorize(['super_admin']), requireEntitlementRoute('canPurchaseMinutes')],
      buildRequest({ sub: userId, appRole: 'super_admin' })
    );

    // An admin on a Discover membership is denied on membership, with the membership code —
    // role and membership stay orthogonal.
    expect(reply.statusCode).toBe(403);
    expect(reply.payload.code).toBe(ENTITLEMENT_ROUTE_ERROR_CODES.denied);
  });

  it('composes in either order', async () => {
    const userId = nextUserId('reverse-order');
    arrangeMembership('trial');

    const reply = await runChain(
      [requireEntitlementRoute('canPurchaseMinutes'), authorize(['super_admin'])],
      buildRequest({ sub: userId, appRole: 'super_admin' })
    );

    expect(reply.statusCode).toBe(403);
    expect(reply.payload.code).toBe(ENTITLEMENT_ROUTE_ERROR_CODES.denied);
  });
});

// ---------------------------------------------------------------------------
// Not wired to production routes yet
// ---------------------------------------------------------------------------

describe('production wiring', () => {
  /**
   * Phase 2A shipped this guard deliberately unwired, and this test asserted that. Phase 7
   * wired it for the first time, so the assertion is inverted rather than deleted: it now pins
   * that the guard reaches production only on routes whose capability is APPROVED.
   *
   * That inversion is the point. A guard on a PROVISIONAL capability cannot be constructed at
   * all (`assertEnforceable` throws), so this list can only ever contain approved policy.
   */
  it('is applied only to routes gating an APPROVED capability', () => {
    const { execSync } = require('child_process');
    const files = execSync(
      "grep -rl 'requireEntitlementRoute' src --include=*.routes.ts || true",
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    // Journal is the one feature whose endpoints map cleanly onto a single gated capability.
    expect(files).toEqual(['src/modules/journal/journal.routes.ts']);
  });

  it('gates every member journal route and no admin route', () => {
    const source = require('fs').readFileSync('src/modules/journal/journal.routes.ts', 'utf8');

    // Admin journal routes keep role authorization only — staff membership is irrelevant there.
    expect(source.match(/preHandler: \[app\.authenticate, requireJournal\]/g)).toHaveLength(6);
    expect(source.match(/app\.authorize\(\[/g)).toHaveLength(2);
  });
});
