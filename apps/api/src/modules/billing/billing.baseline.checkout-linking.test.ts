/**
 * BASELINE SUITE — Billing Consolidation, Step 2.
 *
 * Purpose: capture the behaviour of checkout-session linking EXACTLY as it exists today,
 * before any implementation work begins (BILLING_CONSOLIDATION_IMPLEMENTATION_PLAN.md §12.1).
 *
 * These tests are deliberately NOT assertions of correctness. Several of them document
 * behaviour the plan classifies as defective. Where that is the case the test name is
 * prefixed `[DOCUMENTS DEFECT]` and a comment states which plan step is expected to change it.
 *
 * No production code is modified by this file.
 *
 * Covers task requirements 1 (guest checkout linking), 2 (customer-wide subscription
 * selection) and 3 (sequential duplicate linking).
 */

const mockStripe = {
  checkout: {
    sessions: {
      retrieve: jest.fn(),
    },
  },
  subscriptions: {
    retrieve: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
  customers: {
    create: jest.fn(),
  },
  billingPortal: {
    sessions: { create: jest.fn() },
  },
};

const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  subscriptions: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../../config/stripe', () => ({
  stripe: mockStripe,
}));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const CORE_PRICE_ID = 'price_1SzbZVBt6JG9FijPPF89RTfX';
const PRO_PRICE_ID = 'price_1T45gWBt6JG9FijPOV0hXeF3';

const USER_ID = 'user-baseline-1';
const SESSION_ID = 'cs_test_baseline_1';

/**
 * Both services hold module-level caches (`userSubscriptionCache` etc). Reload per test so
 * cache state never leaks between cases, matching `billing.webhook.test.ts:44-47`.
 */
async function loadServices() {
  jest.resetModules();
  const legacy = await import('./index');
  const canonical = await import('./services/subscription.service');
  return { legacy, canonical };
}

function stripeSubscriptionFixture(overrides: Record<string, any> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    id: 'sub_baseline_core',
    status: 'active',
    current_period_start: nowSec,
    current_period_end: nowSec + 30 * 24 * 60 * 60,
    metadata: {},
    items: {
      data: [
        {
          price: {
            id: CORE_PRICE_ID,
            unit_amount: 2500,
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    ...overrides,
  };
}


/**
 * ---------------------------------------------------------------------------------------
 * STEP 10 — legacy `billing.service` is now a THIN WRAPPER over the canonical barrel.
 *
 * This block replaces the Step 2 "BASELINE — guest checkout linking (legacy…)" tests, which
 * documented the legacy implementation's defects (returns `undefined`, non-atomic grant,
 * `stripe_sub_id`-only lookup, silent no-ops). That separate legacy implementation no longer
 * exists: `billing.service.ts` is now `export * from './index'`, so
 * `legacy.linkSubscriptionToUser` IS `canonical.linkSubscriptionToUser`. Every former legacy
 * defect is gone by construction. Canonical behaviour is covered exhaustively by the STEP 5
 * block below and by `subscription.checkout-linking.test.ts`; here we only prove the wrapper
 * delegates.
 * ---------------------------------------------------------------------------------------
 */
describe('STEP 10 — legacy billing.service.linkSubscriptionToUser delegates to canonical', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-1' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-1' });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  /**
   * WAS (Step 2): asserted `legacy.linkSubscriptionToUser !== canonical.linkSubscriptionToUser`
   * — the legacy file shadowed the canonical star re-export with its own implementation.
   * NOW (Step 10): the shadow is gone; the wrapper re-exports canonical, so they are the SAME
   * function reference. This is the load-bearing proof that no second implementation remains.
   */
  it('resolves to the SAME function as canonical (wrapper, not a second implementation)', async () => {
    const { legacy, canonical } = await loadServices();
    expect(typeof legacy.linkSubscriptionToUser).toBe('function');
    expect(legacy.linkSubscriptionToUser).toBe(canonical.linkSubscriptionToUser);
  });

  it('the checkout-return path (via the legacy import) is session-anchored and never lists', async () => {
    const { legacy } = await loadServices();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID, customer: 'cus_baseline_1', subscription: 'sub_baseline_core',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscriptionFixture());

    await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_baseline_core', {
      expand: ['items.data.price'],
    });
    expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();
  });

  /**
   * WAS: legacy returned `undefined` on every path (no classification).
   * NOW: the canonical classified result flows through the wrapper unchanged.
   */
  it('returns a classified result through the wrapper (no longer undefined)', async () => {
    const { legacy } = await loadServices();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: SESSION_ID }); // no customer
    const outcome = await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);
    expect(outcome).toEqual({ result: 'missing_customer', allowanceGranted: false });
  });

  /**
   * WAS: legacy created the row and granted the allowance as two separate, non-atomic
   * statements. NOW: the wrapper runs the canonical single-transaction path and grants once.
   */
  it('grants the allowance inside the canonical transaction (atomic)', async () => {
    const { legacy } = await loadServices();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID, customer: 'cus_baseline_1', subscription: 'sub_baseline_pro',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      stripeSubscriptionFixture({
        id: 'sub_baseline_pro',
        items: { data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }] },
      })
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });

    const outcome = await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(outcome).toMatchObject({ result: 'linked', plan: 'pro', allowanceMinutes: 400 });
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 400, credits_seconds: 24000 },
    });
  });
});

/**
 * ---------------------------------------------------------------------------------------
 * FIXED IN STEP 5. This block previously documented the customer-wide-selection defect.
 *
 * Every assertion below is the CORRECTED expectation. The defective behaviour each one
 * replaces is stated in its own comment so the evidence is not lost — the plan's §3 rebuild
 * is what changed it.
 * ---------------------------------------------------------------------------------------
 */
describe('STEP 5 (was BASELINE defect) — canonical linkSubscriptionToUser is session-anchored', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-1' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-1' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  /**
   * WAS: `[DOCUMENTS DEFECT] ignores session.subscription and resolves from the customer-wide
   * list` — the canonical implementation never read `session.subscription`, delegating to
   * `syncSubscriptionWithStripe` and its `subscriptions.list({ customer, status:'all' })`.
   *
   * NOW: the exact `session.subscription` is retrieved and `subscriptions.list` is never
   * called on this path. Plan §3.2 steps 3-4.
   */
  it('retrieves the exact session.subscription and never calls stripe.subscriptions.list', async () => {
    const { canonical } = await loadServices();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_from_this_checkout',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      stripeSubscriptionFixture({ id: 'sub_from_this_checkout' })
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_from_this_checkout', {
      expand: ['items.data.price'],
    });
    expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();
  });

  /**
   * WAS: `[DOCUMENTS DEFECT] selects the wrong subscription when the customer has a leftover,
   * producing a wrong-plan row and a wrong grant` — with a leftover `incomplete` core
   * subscription listed first, the customer-wide sweep persisted `sub_leftover_core` / `core`
   * and granted the paying pro user nothing.
   *
   * NOW: the session's own subscription wins regardless of what else the customer holds, and
   * the correct plan and allowance are persisted. This is the exact mechanism behind
   * preflight duplicate groups 1-3 (conflicting core/pro rows for one Stripe id).
   */
  it('persists the session subscription and plan even when the customer holds a leftover', async () => {
    const { canonical } = await loadServices();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_from_this_checkout',
    });
    // The leftover the old implementation would have picked. It is never consulted now.
    mockStripe.subscriptions.list.mockResolvedValue({
      data: [stripeSubscriptionFixture({ id: 'sub_leftover_core', status: 'incomplete' })],
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      stripeSubscriptionFixture({
        id: 'sub_from_this_checkout',
        status: 'active',
        items: {
          data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }],
        },
      })
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const outcome = await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    const created = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(created.stripe_sub_id).toBe('sub_from_this_checkout');
    expect(created.plan_type).toBe('pro');
    expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();

    // ...and the pro allowance is actually granted, which the old path skipped entirely.
    expect(outcome).toMatchObject({ result: 'linked', plan: 'pro', allowanceMinutes: 400 });
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 400, credits_seconds: 24000 },
    });
  });

  /**
   * WAS: `falls back to subscription.metadata.planType when the price id is unrecognised`,
   * which exercised the customer-wide sweep's own resolution.
   *
   * NOW: the same fallback is part of the approved checkout hierarchy (§3.2 step 5, level 2),
   * applied to the exact session subscription.
   */
  it('falls back to subscription.metadata.planType when the price id is unrecognised', async () => {
    const { canonical } = await loadServices();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_meta',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      stripeSubscriptionFixture({
        id: 'sub_meta',
        metadata: { planType: 'pro' },
        items: {
          data: [{ price: { id: 'price_unknown', unit_amount: 4900, recurring: { interval: 'month' } } }],
        },
      })
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockPrisma.subscriptions.create.mock.calls[0][0].data.plan_type).toBe('pro');
  });

  /**
   * WAS: `[DOCUMENTS DEFECT] returns undefined — no result classification exists today`.
   * NOW: every path returns a classified outcome (plan §15.3).
   */
  it('returns a classified result instead of undefined', async () => {
    const { canonical } = await loadServices();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: SESSION_ID });

    const outcome = await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toEqual({ result: 'missing_customer', allowanceGranted: false });
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
  });
});

describe('BASELINE — sequential duplicate linking for the same Checkout Session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-1' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-1' });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * SEQUENTIAL (not concurrent) duplicate calls are safe today, but only because the second
   * call's `findFirst` observes the row the first call committed. The safety comes entirely
   * from read ordering — there is no unique constraint on `subscriptions.stripe_sub_id` and
   * no transaction. §7 of the plan adds the constraint that makes this a guarantee.
   *
   * Concurrency is deliberately NOT exercised here; it belongs to a later implementation
   * phase (plan §12.4).
   */
  it('legacy: a second sequential call for the same session creates no second row and grants no second allowance', async () => {
    const { legacy } = await loadServices();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_baseline_core',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscriptionFixture());
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });

    // Call 1 — nothing linked yet.
    mockPrisma.subscriptions.findFirst.mockResolvedValueOnce(null);
    await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);

    // Call 2 — the row from call 1 is now visible.
    mockPrisma.subscriptions.findFirst.mockResolvedValueOnce({ id: 'row-1' });
    await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);

    // Exactly one allowance grant. profiles.update is called 3 times total:
    // stripe_customer_id (x2, once per call) + the single credit grant.
    const creditWrites = mockPrisma.profiles.update.mock.calls.filter(
      (call: any[]) => call[0]?.data?.credits !== undefined
    );
    expect(creditWrites).toHaveLength(1);
    expect(creditWrites[0][0].data).toEqual({ credits: 200, credits_seconds: 12000 });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * This is the CONFIRMED PRODUCTION DEFECT, reproduced deterministically without
   * concurrency. `billing.service.ts:329-349` is a check-then-write with no constraint:
   * if the lookup misses twice — which is exactly what two interleaved requests observe —
   * the code creates a second row AND grants a second full plan allowance.
   *
   * This is the arithmetic behind preflight Finding 2 (user bf112c04: 830 credits against a
   * correct entitlement of 430 — two pro grants for one Stripe subscription).
   *
   * The behaviour is expected to change during Step 3+ (plan §5 atomicity, §7 unique
   * constraint). The over-grant assertion below is precisely the check that must FAIL to
   * reproduce once the constraint is in place.
   */
  it('[DOCUMENTS DEFECT] legacy: when the lookup misses twice, a second row is created and a second full allowance is granted', async () => {
    const { legacy } = await loadServices();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_baseline_pro',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      stripeSubscriptionFixture({
        id: 'sub_baseline_pro',
        items: {
          data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }],
        },
      })
    );

    // Simulates two writers that both read before either wrote: the row is never observed.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    // Balance after the first grant, as the second call would read it.
    mockPrisma.profiles.findUnique
      .mockResolvedValueOnce({ credits: 30, credits_seconds: 1800 })
      .mockResolvedValueOnce({ credits: 430, credits_seconds: 25800 });

    await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);
    await legacy.linkSubscriptionToUser(USER_ID, SESSION_ID);

    // Two rows for one Stripe subscription id — nothing in the DB prevents this today.
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(2);
    const createdIds = mockPrisma.subscriptions.create.mock.calls.map(
      (call: any[]) => call[0].data.stripe_sub_id
    );
    expect(createdIds).toEqual(['sub_baseline_pro', 'sub_baseline_pro']);

    // Two full pro grants: 30 -> 430 -> 830. This reproduces the production over-grant exactly.
    const creditWrites = mockPrisma.profiles.update.mock.calls
      .filter((call: any[]) => call[0]?.data?.credits !== undefined)
      .map((call: any[]) => call[0].data.credits);
    expect(creditWrites).toEqual([430, 830]);
  });

  /**
   * WAS: `canonical: a second sequential call with an unchanged plan updates the row and
   * grants nothing` — correct outcome, but reached through the customer-wide sweep and with
   * no classification.
   *
   * NOW (Step 5): the same outcome, session-anchored, and classified `already_linked`.
   */
  it('canonical: a second sequential call returns already_linked and grants nothing', async () => {
    const { canonical } = await loadServices();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_baseline_core',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscriptionFixture());
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });

    // Call 1 — nothing linked yet.
    mockPrisma.subscriptions.findFirst.mockResolvedValueOnce(null);
    const first = await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    // Call 2 — the row from call 1 is now visible.
    mockPrisma.subscriptions.findFirst.mockResolvedValueOnce({ id: 'row-1', user_id: USER_ID });
    const second = await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(first).toMatchObject({ result: 'linked', allowanceGranted: true });
    expect(second).toMatchObject({ result: 'already_linked', allowanceGranted: false });

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    const creditWrites = mockPrisma.profiles.update.mock.calls.filter(
      (call: any[]) => call[0]?.data?.credits !== undefined
    );
    expect(creditWrites).toHaveLength(1);
    expect(creditWrites[0][0].data).toEqual({ credits: 200, credits_seconds: 12000 });
  });

  /**
   * WAS: `[DOCUMENTS DEFECT] canonical: an existing row whose plan differs is updated AND
   * granted a full allowance again` — `previousPlanType !== planType` made `shouldGrant` true
   * for an already-existing row, so a second full allowance (200 → 600) was stacked. Combined
   * with the customer-wide selection defect this was a second route to repeated grants for one
   * Stripe subscription.
   *
   * NOW (Step 5): checkout linking never re-grants against an existing row. Plan §5.3,
   * "already-linked ⇒ reconcile mutable fields, do not grant again". Reconciliation of a
   * genuinely changed plan remains the job of `syncSubscriptionWithStripe`, not this path.
   */
  it('canonical: an existing row whose plan differs is reconciled WITHOUT a second grant', async () => {
    const { canonical } = await loadServices();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_baseline_1',
      subscription: 'sub_baseline_core',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      stripeSubscriptionFixture({
        items: {
          data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }],
        },
      })
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 200, credits_seconds: 12000 });
    // Row exists for THIS user, stored as core; Stripe now resolves pro.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'row-1', user_id: USER_ID });

    const outcome = await canonical.linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({ result: 'already_linked', allowanceGranted: false });
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.update.mock.calls[0][0].data.plan_type).toBe('pro');
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();

    // The 600-credit over-grant this test previously documented no longer occurs.
    const creditWrites = mockPrisma.profiles.update.mock.calls.filter(
      (call: any[]) => call[0]?.data?.credits !== undefined
    );
    expect(creditWrites).toHaveLength(0);
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
