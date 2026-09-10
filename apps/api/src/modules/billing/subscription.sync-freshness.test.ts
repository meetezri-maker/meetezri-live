const mockStripe = {
  subscriptions: { list: jest.fn() },
  checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
};

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  subscriptions: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  payment_transactions: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));
jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

const USER_ID = 'sync-fresh-user';
const SUB_ID = 'sub_sync_fresh';
const PRICE_ID = 'price_1SzbZVBt6JG9FijPPF89RTfX';
const PERIOD_START = 1_800_000_000;
const PERIOD_END = 1_802_592_000;

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    status: 'active',
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    metadata: {},
    items: {
      data: [{ price: { id: PRICE_ID, unit_amount: 2500, recurring: { interval: 'month' } } }],
    },
    ...overrides,
  };
}

function existingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'db-sub-sync',
    user_id: USER_ID,
    stripe_sub_id: SUB_ID,
    status: 'active',
    plan_type: 'core',
    start_date: new Date(PERIOD_START * 1000),
    end_date: new Date(PERIOD_END * 1000),
    next_billing_at: new Date(PERIOD_END * 1000),
    amount: 25,
    stripe_synced_at: new Date('2026-08-21T11:00:00.000Z'),
    ...overrides,
  };
}

async function loadService() {
  jest.resetModules();
  return import('./services/subscription.service');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.profiles.findUnique.mockResolvedValue({ id: USER_ID, stripe_customer_id: 'cus_sync' });
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  mockPrisma.subscriptions.update.mockImplementation(async ({ data }: any) => ({ ...existingRow(), ...data }));
  mockPrisma.subscriptions.create.mockImplementation(async ({ data }: any) => ({ id: 'created-sub', ...data }));
});

describe('syncSubscriptionWithStripe freshness writes', () => {
  it('does not rewrite business fields when Stripe state is unchanged', async () => {
    const { syncSubscriptionWithStripe } = await loadService();
    mockStripe.subscriptions.list.mockResolvedValue({ data: [stripeSub()] });
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(existingRow());

    await syncSubscriptionWithStripe(USER_ID);

    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
      where: { id: 'db-sub-sync' },
      data: { stripe_synced_at: expect.any(Date) },
    });
  });

  it('updates next_billing_at when Stripe current_period_end changes', async () => {
    const { syncSubscriptionWithStripe } = await loadService();
    const changedPeriodEnd = PERIOD_END + 86_400;
    mockStripe.subscriptions.list.mockResolvedValue({
      data: [stripeSub({ current_period_end: changedPeriodEnd })],
    });
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(existingRow());

    await syncSubscriptionWithStripe(USER_ID);

    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
      where: { id: 'db-sub-sync' },
      data: expect.objectContaining({
        end_date: new Date(changedPeriodEnd * 1000),
        next_billing_at: new Date(changedPeriodEnd * 1000),
        stripe_synced_at: expect.any(Date),
        updated_at: expect.any(Date),
      }),
    });
  });
});

export {};
