/**
 * BASELINE SUITE — Billing Consolidation, Step 2.
 *
 * Purpose: capture the behaviour of `handleSubscriptionDeleted()` EXACTLY as it exists today
 * (BILLING_CONSOLIDATION_IMPLEMENTATION_PLAN.md §12.1, task requirement 6).
 *
 * `handleSubscriptionDeleted` is a module-private handler in `billing.webhook.ts:507-521`, so
 * it is exercised through the public `stripeWebhookHandler` with a
 * `customer.subscription.deleted` event — the same approach `billing.webhook.test.ts` uses.
 *
 * Plan §11.3 item 12 records this handler as currently UNTESTED. This file is the baseline
 * that closes that gap before Step 3 changes it.
 *
 * No production code is modified by this file.
 */

const mockConstructEvent = jest.fn();

const mockStripe = {
  webhooks: {
    constructEvent: mockConstructEvent,
  },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
  },
  invoices: {
    retrieve: jest.fn(),
    update: jest.fn(),
  },
};

const mockStripeWebhookEvents = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrisma = {
  profiles: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  payment_transactions: { findUnique: jest.fn(), create: jest.fn() },
  app_sessions: { findMany: jest.fn() },
  subscriptions: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
  stripe_webhook_events: mockStripeWebhookEvents,
};

jest.mock('../../config/stripe', () => ({
  stripe: mockStripe,
}));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
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

function deletedEvent(subscriptionId: string, overrides: Record<string, any> = {}) {
  return {
    id: `evt_deleted_${subscriptionId}`,
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: subscriptionId,
        status: 'canceled',
        customer: 'cus_baseline_1',
        ...overrides,
      },
    },
  };
}

describe('BASELINE — handleSubscriptionDeleted (customer.subscription.deleted)', () => {
  const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockStripeWebhookEvents.create.mockResolvedValue({});
    mockStripeWebhookEvents.update.mockResolvedValue({});
    mockStripeWebhookEvents.delete.mockResolvedValue({});
    mockPrisma.subscriptions.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
  });

  afterAll(() => {
    if (oldSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   * The behaviour is expected to change during Step 3+ (plan §10.3, writer W9).
   *
   * On cancellation the handler writes BOTH `status: 'canceled'` AND `plan_type: 'trial'`.
   *
   * Overwriting `plan_type` destroys the record that this user was a paying subscriber, and
   * — because `stripe_customer_id` is left in place on the profile — it makes every canceled
   * subscriber permanently satisfy the `/users/me` self-heal trigger ("plan reads trial AND a
   * Stripe customer exists"), producing a customer-wide Stripe call on every profile read,
   * forever. That is the amplifier described in plan §10.1/§10.3.
   *
   * Plan §10.3 part 1: stop writing `plan_type: 'trial'` and retain the real plan.
   */
  it('[DOCUMENTS DEFECT] overwrites plan_type to "trial" as well as setting status to "canceled"', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(deletedEvent('sub_cancel_1'));
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-1',
      user_id: 'user-1',
      plan_type: 'pro',
      status: 'active',
      stripe_sub_id: 'sub_cancel_1',
    });

    const reply = buildReply();
    await stripeWebhookHandler(buildRequest() as any, reply);

    expect(mockPrisma.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: {
        status: 'canceled',
        // The real plan ('pro') is destroyed here.
        plan_type: 'trial',
      },
    });
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * The update payload contains exactly two fields. `end_date`, `next_billing_at`,
   * `updated_at` and `amount` are NOT touched, so a canceled row keeps whatever period
   * bounds it already had.
   *
   * This matters for the read path: `getSubscription` (`subscription.service.ts:62-66`) only
   * treats a canceled row as "no subscription" when `end_date` is in the PAST. A row canceled
   * mid-period therefore continues to read as an active entitlement until its stored
   * `end_date` elapses — which, for the Phase 1 Finding 3 rows, may be never.
   */
  it('does not touch end_date, next_billing_at, updated_at or amount on cancellation', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(
      deletedEvent('sub_cancel_2', {
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-2',
      user_id: 'user-2',
      plan_type: 'core',
      status: 'active',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    const payload = mockPrisma.subscriptions.update.mock.calls[0][0].data;
    expect(Object.keys(payload).sort()).toEqual(['plan_type', 'status']);
    expect(payload).not.toHaveProperty('end_date');
    expect(payload).not.toHaveProperty('next_billing_at');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload).not.toHaveProperty('amount');
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * Side effects on cancellation today:
   *   - NO credit/balance change (`profiles.update` is never called) — a canceled user keeps
   *     every remaining minute.
   *   - NO cache invalidation. `subscription.service.ts` owns `userSubscriptionCache` and
   *     `user.service.ts` owns `userProfileCache`, and the webhook clears neither, so both
   *     serve stale plan data for up to their TTL after a cancellation.
   *   - NO outbound Stripe call — the handler is purely a local write.
   *   - NO email is sent (contrast `invoice.payment_succeeded`, which sends a renewal email).
   *   - NO transaction wraps the write.
   */
  it('has no credit, cache, Stripe, email or transaction side effects', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(deletedEvent('sub_cancel_3'));
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-3',
      user_id: 'user-3',
      plan_type: 'pro',
      status: 'active',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.findUnique).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * Lookup is `findFirst({ where: { stripe_sub_id } })` — scoped by Stripe id only, never by
   * `user_id`. With the 12 duplicated `stripe_sub_id` groups still present in production
   * (§7.1), `findFirst` cancels an ARBITRARY one of the duplicate rows and leaves the others
   * `active`. §7's unique constraint is what makes this lookup unambiguous.
   */
  it('looks the row up by stripe_sub_id alone, with no user scoping and no ordering', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(deletedEvent('sub_cancel_4'));
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-4',
      user_id: 'user-4',
      plan_type: 'core',
    });

    await stripeWebhookHandler(buildRequest() as any, buildReply());

    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { stripe_sub_id: 'sub_cancel_4' },
    });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   * An unknown subscription id is a silent no-op that still reports success to Stripe.
   */
  it('is a silent no-op when no local row matches the Stripe subscription id', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(deletedEvent('sub_unknown'));
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const reply = buildReply();
    await stripeWebhookHandler(buildRequest() as any, reply);

    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ received: true });
    // The event is still marked completed, so Stripe will not retry.
    expect(mockStripeWebhookEvents.update).toHaveBeenCalledWith({
      where: { id: 'evt_deleted_sub_unknown' },
      data: expect.objectContaining({ status: 'completed' }),
    });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * Cancellation is idempotent at the per-event level only, via `stripe_webhook_events`
   * (`billing.webhook.ts:34-72`). A REPLAY of the same event id is dropped before the handler
   * runs. Note this guard has zero production evidence behind it: `stripe_webhook_events` is
   * empty, so no Stripe webhook has ever been processed against this database (plan §13).
   */
  it('drops a replayed delete event via the per-event webhook ledger', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(deletedEvent('sub_cancel_5'));

    const uniqueError = new Error('Unique constraint failed');
    (uniqueError as any).code = 'P2002';
    mockStripeWebhookEvents.create.mockRejectedValue(uniqueError);
    mockStripeWebhookEvents.findUnique.mockResolvedValue({
      id: 'evt_deleted_sub_cancel_5',
      status: 'completed',
      created_at: new Date(),
    });

    const reply = buildReply();
    await stripeWebhookHandler(buildRequest() as any, reply);

    expect(mockPrisma.subscriptions.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * Handler failure releases the ledger claim and returns 500 so Stripe retries. Because the
   * write is a single statement there is no partial-state risk here today — but the same is
   * NOT true of the create+grant handlers, which is what plan §5 addresses.
   */
  it('releases the webhook claim and returns 500 when the local update throws', async () => {
    const { stripeWebhookHandler } = await loadWebhookHandler();

    mockConstructEvent.mockReturnValue(deletedEvent('sub_cancel_6'));
    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'row-6', user_id: 'user-6' });
    mockPrisma.subscriptions.update.mockRejectedValue(new Error('db down'));

    const reply = buildReply();
    await stripeWebhookHandler(buildRequest() as any, reply);

    expect(mockStripeWebhookEvents.delete).toHaveBeenCalledWith({
      where: { id: 'evt_deleted_sub_cancel_6' },
    });
    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
