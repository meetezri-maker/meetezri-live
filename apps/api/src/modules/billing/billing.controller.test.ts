const mockGetSubscription = jest.fn();
const mockSyncSubscriptionWithStripe = jest.fn();

jest.mock('./index', () => ({
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getBillingHistory: jest.fn(),
  getSubscription: mockGetSubscription,
  updateSubscription: jest.fn(),
  getAllSubscriptions: jest.fn(),
  updateSubscriptionById: jest.fn(),
  createCreditPurchaseSession: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  syncSubscriptionWithStripe: mockSyncSubscriptionWithStripe,
  getInvoicesForUser: jest.fn(),
  getAllInvoices: jest.fn(),
  getAllPaygTransactions: jest.fn(),
  getAdminPaygSummary: jest.fn(),
  getAdminBillingOverview: jest.fn(),
  syncPaygCredits: jest.fn(),
  createGuestCheckoutSession: jest.fn(),
}));

import { getSubscriptionHandler } from './billing.controller';

const NOW = new Date('2026-08-21T12:00:00.000Z');

function request() {
  return {
    user: { sub: 'user_renewal' },
    log: { warn: jest.fn() },
  } as any;
}

function reply() {
  return {
    send: jest.fn((value) => value),
  } as any;
}

function stripeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'local_sub',
    user_id: 'user_renewal',
    stripe_sub_id: 'sub_live',
    next_billing_at: new Date('2026-07-03T00:00:00.000Z'),
    stripe_synced_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getSubscriptionHandler renewal date reconciliation freshness', () => {
  it('reconciles Stripe-managed subscriptions when stripe_synced_at is missing', async () => {
    const stale = stripeRow();
    const synced = {
      ...stale,
      next_billing_at: new Date('2026-08-30T00:00:00.000Z'),
      stripe_synced_at: NOW,
    };
    mockGetSubscription.mockResolvedValue(stale);
    mockSyncSubscriptionWithStripe.mockResolvedValue(synced);

    const res = reply();
    await getSubscriptionHandler(request(), res);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledWith('user_renewal');
    expect(res.send).toHaveBeenCalledWith(synced);
  });

  it('does not reconcile again inside the five-minute freshness TTL', async () => {
    const fresh = stripeRow({ stripe_synced_at: new Date('2026-08-21T11:56:00.000Z') });
    mockGetSubscription.mockResolvedValue(fresh);

    const res = reply();
    await getSubscriptionHandler(request(), res);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(fresh);
  });

  it('reconciles again after the five-minute freshness TTL expires', async () => {
    const stale = stripeRow({ stripe_synced_at: new Date('2026-08-21T11:54:59.000Z') });
    const synced = { ...stale, stripe_synced_at: NOW };
    mockGetSubscription.mockResolvedValue(stale);
    mockSyncSubscriptionWithStripe.mockResolvedValue(synced);

    const res = reply();
    await getSubscriptionHandler(request(), res);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(synced);
  });

  it('coalesces concurrent stale reconciliations for the same Stripe subscription', async () => {
    const stale = stripeRow();
    const synced = { ...stale, stripe_synced_at: NOW };
    let resolveSync: (value: unknown) => void = () => {};
    mockGetSubscription.mockResolvedValue(stale);
    mockSyncSubscriptionWithStripe.mockImplementation(
      () => new Promise((resolve) => { resolveSync = resolve; })
    );

    const resA = reply();
    const resB = reply();
    const pA = getSubscriptionHandler(request(), resA);
    const pB = getSubscriptionHandler(request(), resB);
    await Promise.resolve();
    resolveSync(synced);
    await Promise.all([pA, pB]);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
    expect(resA.send).toHaveBeenCalledWith(synced);
    expect(resB.send).toHaveBeenCalledWith(synced);
  });

  it('falls back to the local row if stale Stripe reconciliation fails', async () => {
    const local = stripeRow();
    const req = request();
    mockGetSubscription.mockResolvedValue(local);
    mockSyncSubscriptionWithStripe.mockRejectedValue(new Error('stripe unavailable'));

    const res = reply();
    await getSubscriptionHandler(req, res);

    expect(req.log.warn).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(local);
  });

  it('does not reconcile non-Stripe subscription rows', async () => {
    const local = {
      id: 'trial_sub',
      user_id: 'user_renewal',
      stripe_sub_id: null,
      next_billing_at: null,
      stripe_synced_at: null,
    };
    mockGetSubscription.mockResolvedValue(local);

    const res = reply();
    await getSubscriptionHandler(request(), res);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(local);
  });
});
