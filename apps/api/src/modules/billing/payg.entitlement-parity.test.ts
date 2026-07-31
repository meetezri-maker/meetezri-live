/**
 * PHASE 1B — PAYG eligibility gate characterization / parity suite.
 *
 * Made green against the PRE-migration implementation (`PLAN_LIMITS[plan].payAsYouGoRate === null`
 * used as the authorization check), then re-run unaltered against the POST-migration
 * implementation (`entitlements.canPurchaseMinutes`). Same assertions on both sides is the
 * equivalence proof for Part 5.
 *
 * SEPARATION UNDER TEST — the point of the migration is that these two concerns split cleanly:
 *   - ENTITLEMENTS answer "may this member buy minutes at all"
 *   - BILLING still owns the rate, the amount arithmetic, Stripe, and the checkout metadata
 * The pricing assertions below exist to prove the second half did NOT move.
 *
 * Distinct user ids per case: `getSubscription` memoizes per user for 30s.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  subscriptions: { findFirst: jest.fn() },
  payment_transactions: { create: jest.fn(), findFirst: jest.fn() },
};

const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));
jest.mock('./services/stripe-customer.service', () => ({
  getOrCreateStripeCustomer: jest.fn().mockResolvedValue('cus_parity'),
}));

import { createCreditPurchaseSession } from './services/payg.service';

const PAYG_BLOCKED_MESSAGE = 'Pay-As-You-Go is only available for Core and Pro plans.';
const MIN_AMOUNT_MESSAGE = 'Minimum purchase amount is $0.50';

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

let userSeq = 0;
function nextUserId(label: string): string {
  userSeq += 1;
  return `payg-parity-${label}-${userSeq}`;
}

function arrange(row: Record<string, unknown> | null) {
  mockPrisma.subscriptions.findFirst.mockResolvedValue(row);
  mockPrisma.profiles.findUnique.mockResolvedValue({
    id: 'p',
    stripe_customer_id: 'cus_parity',
    credits: 0,
    credits_seconds: 0,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
  });
  mockStripe.checkout.sessions.create.mockResolvedValue({
    id: 'cs_parity',
    url: 'https://checkout.stripe.test/cs_parity',
  });
}

function buy(userId: string, credits = 25) {
  return createCreditPurchaseSession(userId, 'member@example.com', { credits } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Eligibility — the part that moves to entitlements
// ---------------------------------------------------------------------------

describe('PAYG eligibility — parity', () => {
  it('DISCOVER/trial cannot purchase minutes', async () => {
    const userId = nextUserId('trial');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    await expect(buy(userId)).rejects.toThrow(PAYG_BLOCKED_MESSAGE);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('GROW/core may purchase minutes', async () => {
    const userId = nextUserId('core');
    arrange({ plan_type: 'core', status: 'active', end_date: FUTURE });

    await expect(buy(userId)).resolves.toMatchObject({
      checkoutUrl: 'https://checkout.stripe.test/cs_parity',
    });
  });

  it('THRIVE/pro may purchase minutes', async () => {
    const userId = nextUserId('pro');
    arrange({ plan_type: 'pro', status: 'active', end_date: FUTURE });

    await expect(buy(userId)).resolves.toMatchObject({
      checkoutUrl: 'https://checkout.stripe.test/cs_parity',
    });
  });

  it('a member with no subscription cannot purchase minutes', async () => {
    const userId = nextUserId('none');
    arrange(null);

    // Pre-migration: `plan_type` defaults to 'trial' -> rate null -> throw.
    // Post-migration: no subscription -> DISCOVER -> canPurchaseMinutes false -> throw.
    await expect(buy(userId)).rejects.toThrow(PAYG_BLOCKED_MESSAGE);
  });

  it('an unknown plan value cannot purchase minutes', async () => {
    const userId = nextUserId('unknown');
    arrange({ plan_type: 'enterprise', status: 'active', end_date: FUTURE });

    // Pre-migration: `PLAN_LIMITS['enterprise']` is undefined -> rate undefined -> throw.
    // Post-migration: unrecognized plan -> DISCOVER -> throw. Same outcome, and notably this is
    // the one place the pre-existing code was already fail-closed.
    await expect(buy(userId)).rejects.toThrow(PAYG_BLOCKED_MESSAGE);
  });

  it('a cancelled-but-still-in-period paid member may still purchase minutes', async () => {
    const userId = nextUserId('canceled-in-period');
    arrange({ plan_type: 'pro', status: 'canceled', end_date: FUTURE });

    await expect(buy(userId)).resolves.toMatchObject({ checkoutUrl: 'https://checkout.stripe.test/cs_parity' });
  });

  it('a past_due paid member may still purchase minutes', async () => {
    const userId = nextUserId('past-due');
    arrange({ plan_type: 'core', status: 'past_due', end_date: FUTURE });

    // Nothing restricts on past_due today; this task must not introduce that restriction.
    await expect(buy(userId)).resolves.toMatchObject({ checkoutUrl: 'https://checkout.stripe.test/cs_parity' });
  });

  it('a fully lapsed paid member cannot purchase minutes', async () => {
    const userId = nextUserId('lapsed');
    arrange({ plan_type: 'pro', status: 'canceled', end_date: PAST });

    // `getSubscription` collapses cancelled-and-past-end to null, so both implementations see
    // "no subscription" and block.
    await expect(buy(userId)).rejects.toThrow(PAYG_BLOCKED_MESSAGE);
  });

  it('a live paid row with a stale end_date may still purchase (webhook drift, not a lapse)', async () => {
    const userId = nextUserId('paid-drift');
    arrange({ plan_type: 'core', status: 'active', end_date: PAST });

    await expect(buy(userId)).resolves.toMatchObject({ checkoutUrl: 'https://checkout.stripe.test/cs_parity' });
  });
});

// ---------------------------------------------------------------------------
// Pricing — the part that must NOT move
// ---------------------------------------------------------------------------

describe('PAYG pricing — stays in billing', () => {
  it('prices core at the PLAN_LIMITS rate', async () => {
    const userId = nextUserId('rate-core');
    arrange({ plan_type: 'core', status: 'active', end_date: FUTURE });

    await buy(userId, 25);

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    // 25 credits * $0.20 = $5.00 = 500 cents.
    expect(args.line_items[0].price_data.unit_amount).toBe(500);
    expect(args.line_items[0].price_data.currency).toBe('usd');
  });

  it('prices pro at the PLAN_LIMITS rate', async () => {
    const userId = nextUserId('rate-pro');
    arrange({ plan_type: 'pro', status: 'active', end_date: FUTURE });

    await buy(userId, 25);

    expect(
      mockStripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount
    ).toBe(500);
  });

  it('keeps the internal plan value in checkout metadata, not the membership name', async () => {
    const userId = nextUserId('metadata');
    arrange({ plan_type: 'pro', status: 'active', end_date: FUTURE });

    await buy(userId, 25);

    const metadata = mockStripe.checkout.sessions.create.mock.calls[0][0].metadata;
    // Billing metadata must keep speaking billing vocabulary — 'pro', never 'THRIVE'.
    expect(metadata.planType).toBe('pro');
    expect(metadata.type).toBe('credits');
    expect(metadata.userId).toBe(userId);
  });

  it('still enforces the Stripe minimum charge', async () => {
    const userId = nextUserId('minimum');
    arrange({ plan_type: 'core', status: 'active', end_date: FUTURE });

    // 2 credits * $0.20 = $0.40 -> 40 cents, below Stripe's 50-cent floor.
    await expect(buy(userId, 2)).rejects.toThrow(MIN_AMOUNT_MESSAGE);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('checks eligibility before the minimum-charge rule', async () => {
    const userId = nextUserId('order');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    // A trial member buying 2 credits fails on eligibility, not on the amount — the ordering is
    // user-visible through the message, so it is pinned.
    await expect(buy(userId, 2)).rejects.toThrow(PAYG_BLOCKED_MESSAGE);
  });
});
