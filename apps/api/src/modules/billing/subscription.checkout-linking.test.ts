/**
 * STEP 5 — canonical checkout linking: session anchoring, plan resolution, atomicity,
 * sequential idempotency, ownership protection, and result classification.
 *
 * Scope note on idempotency (deliberately narrow):
 *   - SEQUENTIAL same-session idempotency is proven here.
 *   - CONCURRENT correctness is NOT, and is not claimed: `subscriptions.stripe_sub_id` has no
 *     unique constraint yet, so two truly concurrent callers can still both miss the lookup.
 *     That is deferred to the approved constraint migration. No `unique_conflict_recovered`
 *     result is emitted or tested at this step.
 */

const mockStripe = {
  checkout: { sessions: { retrieve: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), list: jest.fn(), update: jest.fn() },
  customers: { create: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
};

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  subscriptions: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const CORE_PRICE_ID = 'price_1SzbZVBt6JG9FijPPF89RTfX';
const PRO_PRICE_ID = 'price_1T45gWBt6JG9FijPOV0hXeF3';

const USER_ID = 'user-step5';
const OTHER_USER_ID = 'user-step5-other';
const SESSION_ID = 'cs_test_step5';

async function loadService() {
  jest.resetModules();
  return import('./services/subscription.service');
}

function subFixture(overrides: Record<string, any> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    id: 'sub_session_target',
    status: 'active',
    current_period_start: nowSec,
    current_period_end: nowSec + 30 * 24 * 60 * 60,
    metadata: {},
    items: {
      data: [{ price: { id: CORE_PRICE_ID, unit_amount: 2500, recurring: { interval: 'month' } } }],
    },
    ...overrides,
  };
}

/** A transaction client distinct from the singleton, so tx routing is observable. */
function buildTxClient() {
  return {
    subscriptions: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'row-tx' }),
      update: jest.fn().mockResolvedValue({ id: 'row-tx' }),
    },
    profiles: {
      findUnique: jest.fn().mockResolvedValue({ credits: 0, credits_seconds: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('Step 5 — exact Checkout Session subscription selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  it('resolves session.subscription given as an ID string', async () => {
    const { linkSubscriptionToUser } = await loadService();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_session_target',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_session_target', {
      expand: ['items.data.price'],
    });
    expect(outcome).toMatchObject({ result: 'linked', stripeSubscriptionId: 'sub_session_target' });
  });

  it('resolves session.subscription given as an expanded object without a second retrieve', async () => {
    const { linkSubscriptionToUser } = await loadService();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: subFixture({ id: 'sub_expanded' }),
    });

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ result: 'linked', stripeSubscriptionId: 'sub_expanded' });
    expect(mockPrisma.subscriptions.create.mock.calls[0][0].data.stripe_sub_id).toBe('sub_expanded');
  });

  it('retrieves by id when the expanded object carries no usable price', async () => {
    const { linkSubscriptionToUser } = await loadService();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: { id: 'sub_thin', status: 'active' }, // no items/price
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture({ id: 'sub_thin' }));

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_thin', {
      expand: ['items.data.price'],
    });
    expect(outcome).toMatchObject({ result: 'linked' });
  });

  it('never selects from the customer-wide list even when several subscriptions exist', async () => {
    const { linkSubscriptionToUser } = await loadService();

    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_session_target',
    });
    // Two other subscriptions that would have been picked ahead of the session's own one.
    mockStripe.subscriptions.list.mockResolvedValue({
      data: [
        subFixture({ id: 'sub_other_a', status: 'active' }),
        subFixture({ id: 'sub_other_b', status: 'incomplete' }),
      ],
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      subFixture({
        id: 'sub_session_target',
        items: { data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }] },
      })
    );

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();

    const created = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(created.stripe_sub_id).toBe('sub_session_target');
    expect(created.plan_type).toBe('pro');
    expect(outcome).toMatchObject({ result: 'linked', plan: 'pro', allowanceMinutes: 400 });
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 400, credits_seconds: 24000 },
    });
  });
});

describe('Step 5 — plan resolution hierarchy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  async function link(subscription: any, sessionMetadata?: Record<string, string>) {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_x',
      ...(sessionMetadata ? { metadata: sessionMetadata } : {}),
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subscription);
    return linkSubscriptionToUser(USER_ID, SESSION_ID);
  }

  it('level 1 — price id wins', async () => {
    const outcome = await link(
      subFixture({ id: 'sub_x', metadata: { planType: 'core' } , items: {
        data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }],
      }}),
      { planType: 'core' }
    );
    // Price says pro; both metadata sources say core. Price wins.
    expect(outcome).toMatchObject({ result: 'linked', plan: 'pro' });
  });

  it('level 2 — subscription metadata wins over session metadata', async () => {
    const outcome = await link(
      subFixture({
        id: 'sub_x',
        metadata: { planType: 'pro' },
        items: { data: [{ price: { id: 'price_unknown', unit_amount: 4900, recurring: { interval: 'month' } } }] },
      }),
      { planType: 'core' }
    );
    expect(outcome).toMatchObject({ result: 'linked', plan: 'pro' });
  });

  it('level 3 — session metadata is used when price and subscription metadata cannot resolve', async () => {
    const outcome = await link(
      subFixture({
        id: 'sub_x',
        metadata: {},
        items: { data: [{ price: { id: 'price_unknown', unit_amount: 2500, recurring: { interval: 'month' } } }] },
      }),
      { planType: 'core' }
    );
    expect(outcome).toMatchObject({ result: 'linked', plan: 'core' });
  });

  it('level 4 — plan_unresolved when nothing resolves, with no row and no grant', async () => {
    const outcome = await link(
      subFixture({
        id: 'sub_x',
        metadata: {},
        items: { data: [{ price: { id: 'price_unknown', unit_amount: 2500, recurring: { interval: 'month' } } }] },
      })
    );

    expect(outcome).toMatchObject({ result: 'plan_unresolved', allowanceGranted: false });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
  });

  /**
   * The local row's `plan_type` is deliberately NOT a resolution source — it is the state
   * being synchronized, not an authority. A stored plan cannot perpetuate itself.
   */
  it('never falls back to the local row plan_type', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'row-1', user_id: USER_ID, plan_type: 'pro' });

    const outcome = await link(
      subFixture({
        id: 'sub_x',
        metadata: {},
        items: { data: [{ price: { id: 'price_unknown', unit_amount: 2500, recurring: { interval: 'month' } } }] },
      })
    );

    expect(outcome.result).toBe('plan_unresolved');
  });

  /**
   * A metadata value of `trial` must never resolve — it would silently downgrade a paying
   * user (plan §5.3).
   */
  it('refuses to resolve a trial plan from metadata', async () => {
    const outcome = await link(
      subFixture({
        id: 'sub_x',
        metadata: { planType: 'trial' },
        items: { data: [{ price: { id: 'price_unknown', unit_amount: 0, recurring: { interval: 'month' } } }] },
      }),
      { planType: 'trial' }
    );

    expect(outcome.result).toBe('plan_unresolved');
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
  });

  /**
   * Approved customer-ID persistence: the profile link is written after the customer check
   * and therefore survives an unresolved plan. Nothing else is written.
   */
  it('persists stripe_customer_id even when the plan is unresolved', async () => {
    await link(
      subFixture({
        id: 'sub_x',
        metadata: {},
        items: { data: [{ price: { id: 'price_unknown', unit_amount: 2500, recurring: { interval: 'month' } } }] },
      })
    );

    expect(mockPrisma.profiles.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { stripe_customer_id: 'cus_1' },
    });
  });
});

describe('Step 5 — atomicity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_session_target',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());
  });

  it('routes the row write AND the allowance grant through the same transaction client', async () => {
    const { linkSubscriptionToUser } = await loadService();
    const tx = buildTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome.result).toBe('linked');
    // Row write on tx.
    expect(tx.subscriptions.findFirst).toHaveBeenCalled();
    expect(tx.subscriptions.create).toHaveBeenCalled();
    // Allowance grant on the SAME tx.
    expect(tx.profiles.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { credits: true, credits_seconds: true },
    });
    expect(tx.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 200, credits_seconds: 12000 },
    });

    // The singleton is not used for any of the in-transaction work. Its only write is the
    // pre-transaction stripe_customer_id persist.
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.profiles.update.mock.calls[0][0].data).toEqual({
      stripe_customer_id: 'cus_1',
    });
  });

  it('opens no transaction until every Stripe read has completed', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });

    await linkSubscriptionToUser(USER_ID, SESSION_ID);

    const sessionOrder = mockStripe.checkout.sessions.retrieve.mock.invocationCallOrder[0];
    const subOrder = mockStripe.subscriptions.retrieve.mock.invocationCallOrder[0];
    const txOrder = mockPrisma.$transaction.mock.invocationCallOrder[0];
    expect(sessionOrder).toBeLessThan(txOrder);
    expect(subOrder).toBeLessThan(txOrder);
  });

  it('rolls back and reports failed/db_error when the allowance grant throws', async () => {
    const { linkSubscriptionToUser } = await loadService();
    const tx = buildTxClient();
    tx.profiles.update.mockRejectedValue(new Error('grant exploded'));
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({
      result: 'failed',
      errorCategory: 'db_error',
      allowanceGranted: false,
    });
    // The row create was attempted on tx, and the rejection propagates out of $transaction —
    // so neither write commits.
    expect(tx.subscriptions.create).toHaveBeenCalled();
  });

  it('rolls back and reports failed/db_error when the row write throws', async () => {
    const { linkSubscriptionToUser } = await loadService();
    const tx = buildTxClient();
    tx.subscriptions.create.mockRejectedValue(new Error('row exploded'));
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({ result: 'failed', errorCategory: 'db_error' });
    // The grant is never reached.
    expect(tx.profiles.update).not.toHaveBeenCalled();
  });

  it('does not invalidate billing caches when the transaction fails', async () => {
    const service = await loadService();
    mockPrisma.$transaction.mockImplementation(async () => {
      throw new Error('rollback');
    });

    // Warm the subscription cache.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-warm',
      plan_type: 'core',
      status: 'active',
      end_date: null,
    });
    await service.getSubscription(USER_ID);

    const outcome = await service.linkSubscriptionToUser(USER_ID, SESSION_ID);
    expect(outcome.result).toBe('failed');

    // Still served from the warm cache — a successful link would have cleared it.
    mockPrisma.subscriptions.findFirst.mockClear();
    await service.getSubscription(USER_ID);
    expect(mockPrisma.subscriptions.findFirst).not.toHaveBeenCalled();
  });
});

describe('Step 5 — classification and ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-1' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  it('missing_customer — no customer on the session, nothing written', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: SESSION_ID });

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toEqual({ result: 'missing_customer', allowanceGranted: false });
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('missing_subscription — session carries no subscription reference', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: SESSION_ID, customer: 'cus_1' });

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({ result: 'missing_subscription', allowanceGranted: false });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    // The customer link was still persisted, per the approved ordering.
    expect(mockPrisma.profiles.update).toHaveBeenCalledTimes(1);
  });

  it('missing_subscription — unsupported subscription shape', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: { object: 'subscription' }, // no id
    });

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome.result).toBe('missing_subscription');
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('failed/stripe_error — the Checkout Session does not exist', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('No such checkout.session'));

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({ result: 'failed', errorCategory: 'stripe_error' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('failed/stripe_error — the exact subscription retrieval fails', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_gone',
    });
    mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('resource_missing'));

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({ result: 'failed', errorCategory: 'stripe_error' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('surfaces no raw Stripe or database error text in the outcome', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockRejectedValue(
      new Error('sk_test_secret leaked in message')
    );

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(JSON.stringify(outcome)).not.toContain('sk_test_secret');
    expect(Object.keys(outcome).sort()).toEqual(['allowanceGranted', 'errorCategory', 'result']);
  });

  /**
   * Ownership conflict: the Stripe subscription is already linked to a DIFFERENT user.
   * Never silently reassign — no row write, no grant.
   */
  it('ownership_conflict — never reassigns a subscription to another user', async () => {
    const { linkSubscriptionToUser } = await loadService();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_session_target',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-owned-elsewhere',
      user_id: OTHER_USER_ID,
    });

    const outcome = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(outcome).toMatchObject({
      result: 'ownership_conflict',
      errorCategory: 'db_conflict',
      localSubscriptionId: 'row-owned-elsewhere',
      allowanceGranted: false,
    });
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    const creditWrites = mockPrisma.profiles.update.mock.calls.filter(
      (c: any[]) => c[0]?.data?.credits !== undefined
    );
    expect(creditWrites).toHaveLength(0);
  });
});

describe('Step 5 — sequential idempotency (NOT concurrency)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-new' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: SESSION_ID,
      customer: 'cus_1',
      subscription: 'sub_session_target',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());
  });

  /**
   * Replaces the Step 2 duplicate-grant defect for the canonical path. Three sequential calls
   * now yield ONE row and ONE allowance — previously each missed lookup produced another row
   * and another full grant (the `bf112c04` 30 → 430 → 830 arithmetic).
   */
  it('three sequential calls produce one row and exactly one allowance', async () => {
    const { linkSubscriptionToUser } = await loadService();

    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'row-new', user_id: USER_ID });

    const a = await linkSubscriptionToUser(USER_ID, SESSION_ID);
    const b = await linkSubscriptionToUser(USER_ID, SESSION_ID);
    const c = await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect([a.result, b.result, c.result]).toEqual(['linked', 'already_linked', 'already_linked']);
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);

    const creditWrites = mockPrisma.profiles.update.mock.calls.filter(
      (call: any[]) => call[0]?.data?.credits !== undefined
    );
    expect(creditWrites).toHaveLength(1);
    expect(creditWrites[0][0].data).toEqual({ credits: 200, credits_seconds: 12000 });
  });

  it('the idempotency lookup happens inside the transaction, not before it', async () => {
    const { linkSubscriptionToUser } = await loadService();
    const tx = buildTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await linkSubscriptionToUser(USER_ID, SESSION_ID);

    expect(tx.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { stripe_sub_id: 'sub_session_target' },
      select: { id: true, user_id: true },
    });
    expect(mockPrisma.subscriptions.findFirst).not.toHaveBeenCalled();
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
