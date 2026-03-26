const mockConstructEvent = jest.fn();

const mockStripe = {
  webhooks: {
    constructEvent: mockConstructEvent,
  },
  subscriptions: {
    retrieve: jest.fn(),
  },
  invoices: {
    retrieve: jest.fn().mockResolvedValue({ id: 'in_1', lines: { data: [] }, metadata: {} }),
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockStripeWebhookEvents = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn().mockResolvedValue({}),
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

function prismaUniqueError() {
  const e = new Error('Unique constraint failed');
  (e as any).code = 'P2002';
  return e;
}

describe('billing.webhook stripeWebhookHandler', () => {
  const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.payment_transactions.create.mockResolvedValue({});
    mockStripeWebhookEvents.create.mockResolvedValue({});
    mockStripeWebhookEvents.update.mockResolvedValue({});
    mockStripeWebhookEvents.delete.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({
      credits: 0,
      credits_seconds: 0,
    });
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
  });

  const buildReply = () => {
    const reply: any = {
      status: jest.fn(),
      send: jest.fn(),
    };
    reply.status.mockReturnValue(reply);
    return reply;
  };

  it('returns 500 when webhook secret is missing', async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = '';
    const { stripeWebhookHandler } = await loadWebhookHandler();

    const reply = buildReply();
    const request: any = {
      headers: {},
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Unable to process webhook',
    });
    if (prev !== undefined) process.env.STRIPE_WEBHOOK_SECRET = prev;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const { stripeWebhookHandler } = await loadWebhookHandler();

    const reply = buildReply();
    const request: any = {
      headers: {},
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
      rawBody: Buffer.from('{}'),
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'Invalid webhook request',
    });
  });

  it('returns 400 when webhook signature verification fails', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const { stripeWebhookHandler } = await loadWebhookHandler();

    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'Invalid webhook signature',
    });
  });

  it('acks duplicate webhook events via DB ledger without reprocessing', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-dup-1',
      type: 'unknown.event',
      data: { object: {} },
    });
    mockStripeWebhookEvents.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(prismaUniqueError());
    mockStripeWebhookEvents.findUnique.mockResolvedValue({
      id: 'evt-dup-1',
      event_type: 'unknown.event',
      status: 'completed',
      created_at: new Date(),
      processed_at: new Date(),
    });
    mockStripeWebhookEvents.update.mockResolvedValue({});

    const { stripeWebhookHandler } = await loadWebhookHandler();

    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{"id":"evt-dup-1"}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };
    const firstReply = buildReply();
    const secondReply = buildReply();

    await stripeWebhookHandler(request, firstReply);
    await stripeWebhookHandler(request, secondReply);

    expect(firstReply.send).toHaveBeenCalledWith({ received: true });
    expect(secondReply.send).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  it('returns 503 when another delivery is still processing the same event', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-inflight',
      type: 'unknown.event',
      data: { object: {} },
    });
    mockStripeWebhookEvents.create.mockRejectedValue(prismaUniqueError());
    mockStripeWebhookEvents.findUnique.mockResolvedValue({
      id: 'evt-inflight',
      event_type: 'unknown.event',
      status: 'processing',
      created_at: new Date(),
      processed_at: null,
    });

    const { stripeWebhookHandler } = await loadWebhookHandler();

    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Service Unavailable',
      message: 'Webhook processing in progress',
    });
  });

  it('releases DB claim when completing the event fails so Stripe can retry', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-fail-1',
      type: 'unknown.event',
      data: { object: {} },
    });
    mockStripeWebhookEvents.create.mockResolvedValue({});
    mockStripeWebhookEvents.update.mockRejectedValue(new Error('db write failed'));

    const { stripeWebhookHandler } = await loadWebhookHandler();

    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(mockStripeWebhookEvents.delete).toHaveBeenCalledWith({ where: { id: 'evt-fail-1' } });
  });

  it('returns 400 when raw body is missing', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const { stripeWebhookHandler } = await loadWebhookHandler();

    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'Invalid webhook request',
    });
  });

  it('processes checkout.session.completed for credit purchases', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-checkout-credits-1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_credits_1',
          customer: 'cus_abc',
          amount_total: 500,
          currency: 'usd',
          metadata: { userId: 'user-1', type: 'credits', credits: '25' },
        },
      },
    });
    mockPrisma.payment_transactions.findUnique.mockResolvedValue(null);
    mockPrisma.profiles.update.mockResolvedValue({});

    const { stripeWebhookHandler } = await loadWebhookHandler();
    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripe_customer_id: 'cus_abc' },
    });
    expect(mockPrisma.payment_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 'user-1',
          stripe_session_id: 'cs_credits_1',
          credits_amount: 25,
        }),
      })
    );
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        purchased_credits: { increment: 25 },
        purchased_credits_seconds: { increment: 25 * 60 },
      },
    });
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it('processes checkout.session.completed for subscription and sets plan credits', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-checkout-sub-1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub_1',
          customer: 'cus_sub',
          subscription: 'sub_stripe_1',
          metadata: { userId: 'user-2', planType: 'core', billing_cycle: 'monthly' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_1',
      status: 'active',
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_086_400,
    });
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'db-sub-1' });
    mockPrisma.profiles.update.mockResolvedValue({});

    const { stripeWebhookHandler } = await loadWebhookHandler();
    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_stripe_1');
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 'user-2',
          stripe_sub_id: 'sub_stripe_1',
          plan_type: 'core',
        }),
      })
    );
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({ credits: 200, credits_seconds: 200 * 60 }),
      })
    );
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it('processes invoice.payment_succeeded by renewing subscription dates and credits', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-invoice-renew-1',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          billing_reason: 'subscription_cycle',
          subscription: 'sub_stripe_2',
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_2',
      status: 'active',
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_259_200,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'db-sub-2',
      user_id: 'user-3',
      plan_type: 'pro',
    });
    mockPrisma.subscriptions.update.mockResolvedValue({});
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.profiles.findUnique.mockResolvedValue({
      credits: 100,
      credits_seconds: 100 * 60,
    });

    const { stripeWebhookHandler } = await loadWebhookHandler();
    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(mockPrisma.subscriptions.update).toHaveBeenCalled();
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: 'user-3' },
      data: { credits: 500, credits_seconds: 500 * 60 },
    });
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it('returns 500 when handler throws so Stripe can retry', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockConstructEvent.mockReturnValue({
      id: 'evt-handler-throw-1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_fail',
          customer: 'cus_x',
          subscription: 'sub_x',
          metadata: { userId: 'user-x', planType: 'core' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('stripe down'));
    mockPrisma.profiles.update.mockResolvedValue({});

    const { stripeWebhookHandler } = await loadWebhookHandler();
    const reply = buildReply();
    const request: any = {
      headers: { 'stripe-signature': 'sig' },
      rawBody: Buffer.from('{}'),
      log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    };

    await stripeWebhookHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(mockStripeWebhookEvents.delete).toHaveBeenCalledWith({ where: { id: 'evt-handler-throw-1' } });
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Unable to process webhook',
    });
  });
});

describe('beginStripeWebhookProcessing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeWebhookEvents.delete.mockResolvedValue({});
  });

  it('reclaims stale processing rows and allows a new claim', async () => {
    const { beginStripeWebhookProcessing } = await loadWebhookHandler();

    const staleDate = new Date(Date.now() - 20 * 60 * 1000);
    mockStripeWebhookEvents.create
      .mockRejectedValueOnce(prismaUniqueError())
      .mockResolvedValueOnce({});
    mockStripeWebhookEvents.findUnique.mockResolvedValue({
      id: 'evt-stale',
      event_type: 'checkout.session.completed',
      status: 'processing',
      created_at: staleDate,
      processed_at: null,
    });
    mockStripeWebhookEvents.delete.mockResolvedValue({});

    const result = await beginStripeWebhookProcessing('evt-stale', 'checkout.session.completed');

    expect(result).toBe('run');
    expect(mockStripeWebhookEvents.delete).toHaveBeenCalledWith({ where: { id: 'evt-stale' } });
    expect(mockStripeWebhookEvents.create).toHaveBeenCalledTimes(2);
  });
});
