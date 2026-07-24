/**
 * Proves that every webhook allowance grant routes through the ONE shared stacking helper
 * after the Step 4 consolidation, and that grant timing / idempotency are unchanged.
 *
 * This lives in its own file, mocking `credit-balance.service`, so that
 * `billing.webhook.test.ts` stays completely unmodified — its `profiles.update` assertions
 * remain the independent proof that the ARITHMETIC did not change, while this file proves the
 * CALL PATH did.
 */

const mockConstructEvent = jest.fn();
const mockAddSubscriptionAllowanceMinutes = jest.fn();

const mockStripe = {
  webhooks: { constructEvent: mockConstructEvent },
  subscriptions: { retrieve: jest.fn(), update: jest.fn(), list: jest.fn() },
  invoices: {
    retrieve: jest.fn().mockResolvedValue({ id: 'in_1', lines: { data: [] }, metadata: {} }),
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockStripeWebhookEvents = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrisma = {
  profiles: { update: jest.fn(), findUnique: jest.fn() },
  payment_transactions: { findUnique: jest.fn(), create: jest.fn() },
  app_sessions: { findMany: jest.fn() },
  subscriptions: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
  stripe_webhook_events: mockStripeWebhookEvents,
};

jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('./credit-balance.service', () => ({
  addSubscriptionAllowanceMinutes: mockAddSubscriptionAllowanceMinutes,
  resolveBucketSeconds: jest.fn(),
  resolveProfileRemainingSeconds: jest.fn(),
  getLifetimeUsedSeconds: jest.fn(),
}));

jest.mock('../email/email.service', () => ({
  emailService: { sendEmail: jest.fn().mockResolvedValue({}) },
}));

async function loadWebhookHandler() {
  jest.resetModules();
  return import('./billing.webhook');
}

const buildReply = () => {
  const reply: any = { status: jest.fn(), send: jest.fn() };
  reply.status.mockReturnValue(reply);
  return reply;
};

const buildRequest = () => ({
  headers: { 'stripe-signature': 'sig_test' },
  log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  rawBody: Buffer.from('{}'),
});

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
    payment_transactions: { findUnique: jest.fn(), create: jest.fn() },
  };
}

const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_700_086_400;
const CORE_PRICE_ID = 'price_1SzbZVBt6JG9FijPPF89RTfX';
const PRO_PRICE_ID = 'price_1T45gWBt6JG9FijPOV0hXeF3';

describe('webhook allowance grants route through the shared helper', () => {
  const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockStripeWebhookEvents.create.mockResolvedValue({});
    mockStripeWebhookEvents.update.mockResolvedValue({});
    mockStripeWebhookEvents.delete.mockResolvedValue({});
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.subscriptions.update.mockResolvedValue({});
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'db-sub-1' });
    mockAddSubscriptionAllowanceMinutes.mockResolvedValue(undefined);
    mockStripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', lines: { data: [] }, metadata: {} });
  });

  afterAll(() => {
    if (oldSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('checkout.session.completed grants the plan allowance through the shared helper', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-checkout-1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: { userId: 'user-1', planType: 'core' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledTimes(1);
    // Step 5: the grant now carries the transaction client (here the default $transaction
    // mock, which passes mockPrisma through). Dedicated tx-routing assertions are below.
    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledWith('user-1', 200, mockPrisma);
  });

  it('invoice.payment_succeeded on subscription_cycle grants the renewal through the shared helper', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-renew-1',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_1', billing_reason: 'subscription_cycle', subscription: 'sub_2' } },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_2',
      status: 'active',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-2',
      user_id: 'user-3',
      plan_type: 'pro',
    });
    mockPrisma.profiles.findUnique.mockResolvedValue({ email: 'a@b.com', full_name: 'A' });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledTimes(1);
    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledWith('user-3', 400, mockPrisma);
  });

  it('invoice.payment_succeeded on subscription_create grants nothing', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-create-1',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_1', billing_reason: 'subscription_create', subscription: 'sub_3' } },
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    // The handler returns before touching Stripe or the subscriptions table.
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
  });

  it('a replayed event id is not processed twice and grants no second allowance', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-checkout-dupe',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_2',
          customer: 'cus_1',
          subscription: 'sub_4',
          metadata: { userId: 'user-1', planType: 'core' },
        },
      },
    });

    const uniqueError = new Error('Unique constraint failed');
    (uniqueError as any).code = 'P2002';
    mockStripeWebhookEvents.create.mockRejectedValue(uniqueError);
    mockStripeWebhookEvents.findUnique.mockResolvedValue({
      id: 'evt-checkout-dupe',
      status: 'completed',
      created_at: new Date(),
    });

    const reply = buildReply();
    await stripeWebhookHandler(buildRequest() as any, reply);

    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  /**
   * Grant timing is unchanged: an `incomplete` subscription still receives no allowance,
   * because `shouldGrant` requires status in ['active','trialing'].
   */
  it('checkout.session.completed on an incomplete subscription still grants nothing', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-checkout-incomplete',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_3',
          customer: 'cus_1',
          subscription: 'sub_5',
          metadata: { userId: 'user-1', planType: 'core' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_5',
      status: 'incomplete',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
  });

  /**
   * Step 4b: the plan-change grant in `handleSubscriptionUpdated` was a sixth stacking
   * implementation, inlined. It now routes through the shared helper.
   *
   * Grant eligibility is `planChanged` — the Stripe price resolves to a known plan AND that
   * plan differs from the LOCAL row's `plan_type`. The full new-plan allowance is stacked,
   * never a delta.
   */
  it('customer.subscription.updated grants a qualifying plan change through the shared helper', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_7',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: PRO_PRICE_ID } }] },
        },
      },
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-7',
      user_id: 'user-9',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledTimes(1);
    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledWith('user-9', 400, mockPrisma);
  });

  it('customer.subscription.updated with no plan change grants nothing', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_8',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: CORE_PRICE_ID } }] },
        },
      },
    });
    // Local row already reads core — same plan, so `planChanged` is false.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-8',
      user_id: 'user-9',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    // The row is still updated — only the grant is skipped.
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledTimes(1);
  });

  it('customer.subscription.updated grants nothing when the price resolves to no known plan', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_9',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: 'price_unknown' } }] },
        },
      },
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-9',
      user_id: 'user-9',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledTimes(1);
  });

  /**
   * Subscription-row mutation on a plan change is unchanged: status, the new `plan_type`,
   * both period fields, and the MRR amount — and it still happens AFTER the grant.
   */
  it('customer.subscription.updated still writes the same subscription-row fields', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-4',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_10',
          status: 'active',
          current_period_end: PERIOD_END,
          items: {
            data: [{ price: { id: PRO_PRICE_ID, unit_amount: 4900, recurring: { interval: 'month' } } }],
          },
        },
      },
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-10',
      user_id: 'user-9',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
      where: { id: 'db-sub-10' },
      data: {
        status: 'active',
        plan_type: 'pro',
        end_date: new Date(PERIOD_END * 1000),
        next_billing_at: new Date(PERIOD_END * 1000),
        amount: 49,
      },
    });

    // The grant precedes the row update, exactly as before.
    const grantOrder = mockAddSubscriptionAllowanceMinutes.mock.invocationCallOrder[0];
    const updateOrder = mockPrisma.subscriptions.update.mock.invocationCallOrder[0];
    expect(grantOrder).toBeLessThan(updateOrder);
  });

  /**
   * `handleSubscriptionUpdated` sends no email or notification — before or after Step 4b.
   * (Contrast the renewal path, which does.) Pinned so a later step cannot add one silently.
   */
  it('customer.subscription.updated sends no email or notification', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();
    const { emailService } = await import('../email/email.service');

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-5',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_11',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: PRO_PRICE_ID } }] },
        },
      },
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-11',
      user_id: 'user-9',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  /**
   * The only early return in the handler: no local row means no grant AND no row update.
   */
  it('customer.subscription.updated is a full no-op when no local row matches', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-6',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_missing',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: PRO_PRICE_ID } }] },
        },
      },
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
  });

  it('a replayed customer.subscription.updated event grants no second allowance', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-dupe',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_12',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: PRO_PRICE_ID } }] },
        },
      },
    });

    const uniqueError = new Error('Unique constraint failed');
    (uniqueError as any).code = 'P2002';
    mockStripeWebhookEvents.create.mockRejectedValue(uniqueError);
    mockStripeWebhookEvents.findUnique.mockResolvedValue({
      id: 'evt-updated-dupe',
      status: 'completed',
      created_at: new Date(),
    });

    const reply = buildReply();
    await stripeWebhookHandler(buildRequest() as any, reply);

    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  /**
   * STEP 5: every webhook grant now shares one transaction client with its subscription-row
   * write. This assertion replaces the Step 4 tripwire that asserted no client was passed.
   */
  it('checkout completion shares one transaction client between row write and grant', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();
    const tx = buildTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    mockConstructEvent.mockReturnValue({
      id: 'evt-checkout-2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_4',
          customer: 'cus_1',
          subscription: 'sub_6',
          metadata: { userId: 'user-1', planType: 'pro' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_6',
      status: 'active',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(tx.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledWith('user-1', 400, tx);
    // The row write did NOT go through the singleton.
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
  });

  it('renewal shares one transaction client between row update and grant', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();
    const tx = buildTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    mockConstructEvent.mockReturnValue({
      id: 'evt-renew-2',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_2', billing_reason: 'subscription_cycle', subscription: 'sub_13' } },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_13',
      status: 'active',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-13',
      user_id: 'user-3',
      plan_type: 'core',
    });
    mockPrisma.profiles.findUnique.mockResolvedValue({ email: 'a@b.com', full_name: 'A' });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(tx.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledWith('user-3', 200, tx);
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
  });

  it('plan change shares one transaction client, with the grant still preceding the row update', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();
    const tx = buildTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    mockConstructEvent.mockReturnValue({
      id: 'evt-updated-7',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_14',
          status: 'active',
          current_period_end: PERIOD_END,
          items: { data: [{ price: { id: PRO_PRICE_ID } }] },
        },
      },
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-14',
      user_id: 'user-9',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledWith('user-9', 400, tx);
    expect(tx.subscriptions.update).toHaveBeenCalledTimes(1);

    const grantOrder = mockAddSubscriptionAllowanceMinutes.mock.invocationCallOrder[0];
    const updateOrder = tx.subscriptions.update.mock.invocationCallOrder[0];
    expect(grantOrder).toBeLessThan(updateOrder);
  });

  /**
   * A renewal for a zero-allowance plan still commits the row update, still grants nothing,
   * and still skips the renewal email — the handler-level early return is preserved.
   */
  it('renewal with a zero-allowance plan updates the row, grants nothing and sends no email', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();
    const { emailService } = await import('../email/email.service');
    const tx = buildTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    mockConstructEvent.mockReturnValue({
      id: 'evt-renew-3',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_3', billing_reason: 'subscription_cycle', subscription: 'sub_15' } },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_15',
      status: 'active',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    // `trial` maps to 30 minutes; an unknown plan maps to 0.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-15',
      user_id: 'user-3',
      plan_type: 'no_such_plan',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(tx.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(mockAddSubscriptionAllowanceMinutes).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  /**
   * Two DISTINCT events for the same subscription each process and each grant. This is not a
   * defect being fixed here: the webhook ledger is per-event only, and cross-event semantic
   * idempotency requires the entitlement ledger, which remains a live-mode blocker.
   */
  it('distinct events for the same subscription each process independently', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-16',
      user_id: 'user-3',
      plan_type: 'core',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_16',
      status: 'active',
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    });
    mockPrisma.profiles.findUnique.mockResolvedValue({ email: 'a@b.com', full_name: 'A' });

    for (const eventId of ['evt-cycle-a', 'evt-cycle-b']) {
      mockConstructEvent.mockReturnValue({
        id: eventId,
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_4', billing_reason: 'subscription_cycle', subscription: 'sub_16' } },
      });
      await stripeWebhookHandler(buildRequest() as any, buildReply());
    }

    expect(mockAddSubscriptionAllowanceMinutes).toHaveBeenCalledTimes(2);
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
