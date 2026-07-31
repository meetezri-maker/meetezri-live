/**
 * STEP 9 — constraint compatibility for every reachable `stripe_sub_id` writer.
 *
 * Proves each writer behaves correctly once `subscriptions_stripe_sub_id_unique` exists:
 * same-user conflicts resolve to the committed row with no second grant, cross-user conflicts
 * never reassign ownership, and unrelated uniqueness failures still propagate.
 *
 * Error shapes are the REAL ones verified in Step 8B against PostgreSQL 16:
 *   stripe index -> { modelName: 'subscriptions', target: ['stripe_sub_id'] }
 *   primary key  -> { modelName: 'subscriptions', target: ['id'] }
 */

const mockStripe = {
  checkout: { sessions: { retrieve: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), list: jest.fn(), update: jest.fn() },
  customers: { create: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
  invoices: { retrieve: jest.fn(), update: jest.fn() },
};

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  subscriptions: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  payment_transactions: { findUnique: jest.fn(), create: jest.fn() },
  stripe_webhook_events: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));
jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../email/email.service', () => ({ emailService: { sendEmail: jest.fn() } }));

const CORE_PRICE_ID = 'price_1SzbZVBt6JG9FijPPF89RTfX';
const USER_ID = 'user-owner';
const OTHER_USER = 'user-other';
const SUB_ID = 'sub_contended';

/** Real Prisma shapes (Step 8B). */
function p2002(target: string[], modelName = 'subscriptions') {
  const e: any = new Error('Unique constraint failed');
  e.code = 'P2002';
  e.meta = { modelName, target };
  return e;
}
const stripeConflict = () => p2002(['stripe_sub_id']);
const pkConflict = () => p2002(['id']);

function subFixture(overrides: Record<string, any> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: SUB_ID,
    status: 'active',
    current_period_start: now,
    current_period_end: now + 2592000,
    metadata: {},
    items: { data: [{ price: { id: CORE_PRICE_ID, unit_amount: 2500, recurring: { interval: 'month' } } }] },
    ...overrides,
  };
}

async function loadCanonical() {
  jest.resetModules();
  return import('./services/subscription.service');
}
async function loadLegacy() {
  jest.resetModules();
  return import('./index');
}
async function loadWebhook() {
  jest.resetModules();
  return import('./billing.webhook');
}

function baseMocks() {
  jest.clearAllMocks();
  mockPrisma.profiles.update.mockResolvedValue({});
  mockPrisma.profiles.findUnique.mockResolvedValue({
    id: USER_ID, stripe_customer_id: 'cus_1', credits: 0, credits_seconds: 0,
  });
  mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
  mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
  mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-new' });
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
}

const creditWrites = () =>
  mockPrisma.profiles.update.mock.calls.filter((c: any[]) => c[0]?.data?.credits !== undefined);

// ---------------------------------------------------------------------------
describe('canonical linkSubscriptionToUser — stripe_sub_id conflict', () => {
  beforeEach(() => {
    baseMocks();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_1', customer: 'cus_1', subscription: SUB_ID,
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());
  });

  it('same-user conflict returns already_linked and grants nothing', async () => {
    const { linkSubscriptionToUser } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)                                  // in-tx lookup: not yet linked
      .mockResolvedValueOnce({ id: 'winner', user_id: USER_ID });   // post-conflict re-read

    const outcome = await linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(outcome).toMatchObject({
      result: 'already_linked', localSubscriptionId: 'winner', allowanceGranted: false,
    });
    expect(creditWrites()).toHaveLength(0);
  });

  it('cross-user conflict returns ownership_conflict, never reassigns, never grants', async () => {
    const { linkSubscriptionToUser } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'their-row', user_id: OTHER_USER });

    const outcome = await linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(outcome).toMatchObject({
      result: 'ownership_conflict', errorCategory: 'db_conflict', allowanceGranted: false,
    });
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(creditWrites()).toHaveLength(0);
  });

  it('does not leak Stripe detail in the ownership-conflict result', async () => {
    const { linkSubscriptionToUser } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'their-row', user_id: OTHER_USER });

    const outcome = await linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(Object.keys(outcome).sort()).toEqual([
      'allowanceGranted', 'errorCategory', 'localSubscriptionId', 'plan', 'result', 'stripeSubscriptionId',
    ]);
  });

  it('an unrelated P2002 (primary key) does not become already_linked', async () => {
    const { linkSubscriptionToUser } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(pkConflict());

    const outcome = await linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(outcome).toMatchObject({ result: 'failed', errorCategory: 'db_error' });
  });
});

// ---------------------------------------------------------------------------
describe('canonical syncSubscriptionWithStripe — stripe_sub_id conflict', () => {
  beforeEach(() => {
    baseMocks();
    mockStripe.subscriptions.list.mockResolvedValue({ data: [subFixture()] });
  });

  it('same-user conflict returns the committed row without a second grant', async () => {
    const { syncSubscriptionWithStripe } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null) // existingByStripeId
      .mockResolvedValueOnce(null) // pendingCandidate
      .mockResolvedValueOnce({ id: 'winner', user_id: USER_ID, plan_type: 'core' });

    const result = await syncSubscriptionWithStripe(USER_ID);

    expect(result).toMatchObject({ id: 'winner' });
    expect(creditWrites()).toHaveLength(0);
  });

  it('cross-user conflict never mutates the other user row', async () => {
    const { syncSubscriptionWithStripe } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'their-row', user_id: OTHER_USER })
      .mockResolvedValue(null); // getSubscription fallback

    await syncSubscriptionWithStripe(USER_ID);

    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(creditWrites()).toHaveLength(0);
  });

  it('rethrows an unrelated P2002', async () => {
    const { syncSubscriptionWithStripe } = await loadCanonical();
    mockPrisma.subscriptions.create.mockRejectedValue(pkConflict());

    await expect(syncSubscriptionWithStripe(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });
});

// ---------------------------------------------------------------------------
/**
 * STEP 10 NOTE: `billing.service` is now a thin wrapper (`export * from './index'`), so the
 * "legacy" link/sync imported here ARE the canonical implementations. These tests therefore
 * exercise the canonical writers via the wrapper import path that `user.controller.ts` and
 * `user.service.ts` still use, confirming the redirect is safe. One assertion changed — see the
 * "unrelated P2002" case, where canonical link classifies rather than rethrows.
 */
describe('legacy (now wrapper → canonical) live writers — stripe_sub_id conflict', () => {
  beforeEach(() => {
    baseMocks();
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_1', customer: 'cus_1', subscription: SUB_ID,
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());
    mockStripe.subscriptions.list.mockResolvedValue({ data: [subFixture()] });
  });

  it('legacy link: conflict grants nothing and creates no second row', async () => {
    const legacy = await loadLegacy();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner', user_id: USER_ID });

    await legacy.linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(creditWrites()).toHaveLength(0);
  });

  it('legacy link: cross-user conflict does not reassign or grant', async () => {
    const legacy = await loadLegacy();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'their-row', user_id: OTHER_USER });

    await legacy.linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(creditWrites()).toHaveLength(0);
  });

  /**
   * WAS (Step 9): the standalone legacy link RETHREW an unrelated P2002.
   * NOW (Step 10): the wrapper routes to canonical link, whose broad catch CLASSIFIES an
   * unrelated failure as `failed`/`db_error` (it never swallows it into `already_linked` and
   * never grants). This matches the canonical-block assertion above; the wrapper behaves
   * identically to a direct canonical call, which is the point of the redirect.
   */
  it('legacy(→canonical) link: an unrelated P2002 is classified failed, not already_linked, no grant', async () => {
    const legacy = await loadLegacy();
    mockPrisma.subscriptions.create.mockRejectedValue(pkConflict());

    const outcome = await legacy.linkSubscriptionToUser(USER_ID, 'cs_1');

    expect(outcome).toMatchObject({ result: 'failed', errorCategory: 'db_error' });
    expect(creditWrites()).toHaveLength(0);
  });

  it('legacy self-heal sync: conflict returns the committed row without granting', async () => {
    const legacy = await loadLegacy();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner', user_id: USER_ID, plan_type: 'core' });

    const result = await legacy.syncSubscriptionWithStripe(USER_ID);

    expect(result).toMatchObject({ id: 'winner' });
    expect(creditWrites()).toHaveLength(0);
  });

  it('legacy self-heal sync: rethrows an unrelated P2002', async () => {
    const legacy = await loadLegacy();
    mockPrisma.subscriptions.create.mockRejectedValue(pkConflict());

    await expect(legacy.syncSubscriptionWithStripe(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });
});

// ---------------------------------------------------------------------------
describe('webhook checkout completion — stripe_sub_id conflict', () => {
  const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    baseMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockPrisma.stripe_webhook_events.create.mockResolvedValue({});
    mockPrisma.stripe_webhook_events.update.mockResolvedValue({});
    mockPrisma.stripe_webhook_events.delete.mockResolvedValue({});
    mockStripe.subscriptions.retrieve.mockResolvedValue(subFixture());
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_conflict',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', customer: 'cus_1', subscription: SUB_ID, metadata: { userId: USER_ID, planType: 'core' } } },
    });
  });

  afterAll(() => {
    if (oldSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  const req = () => ({
    headers: { 'stripe-signature': 'sig' },
    rawBody: Buffer.from('{}'),
    log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  });
  const rep = () => {
    const r: any = { status: jest.fn(), send: jest.fn() };
    r.status.mockReturnValue(r);
    return r;
  };

  it('same-user conflict completes the event without a second grant', async () => {
    const { stripeWebhookHandler } = await loadWebhook();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner', user_id: USER_ID });

    const reply = rep();
    await stripeWebhookHandler(req() as any, reply);

    expect(creditWrites()).toHaveLength(0);
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it('cross-user conflict logs a warning and never reassigns or grants', async () => {
    const { stripeWebhookHandler } = await loadWebhook();
    mockPrisma.subscriptions.create.mockRejectedValue(stripeConflict());
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'their-row', user_id: OTHER_USER });

    const request = req();
    const reply = rep();
    await stripeWebhookHandler(request as any, reply);

    expect(request.log.warn).toHaveBeenCalled();
    expect(creditWrites()).toHaveLength(0);
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it('an unrelated P2002 still fails the webhook so Stripe retries', async () => {
    const { stripeWebhookHandler } = await loadWebhook();
    mockPrisma.subscriptions.create.mockRejectedValue(pkConflict());

    const reply = rep();
    await stripeWebhookHandler(req() as any, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
