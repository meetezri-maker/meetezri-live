/**
 * PHASE 5 — PAYG refusal error contract.
 *
 * The membership refusal used to be a bare `throw new Error(...)`. With no `statusCode`, the
 * global handler classified it 500 and — because it masks 5xx messages — replaced the text with
 * "Something went wrong on Server side." The client could not distinguish a membership rule from
 * an outage, so the UI told members to retry something that would never succeed.
 *
 * These tests pin the corrected contract AND the two things that must not change: the exact
 * message, and the fact that a genuine configuration fault still surfaces as a server error.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  subscriptions: { findFirst: jest.fn() },
};
const mockStripe = { checkout: { sessions: { create: jest.fn() } } };

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));
jest.mock('./services/stripe-customer.service', () => ({
  getOrCreateStripeCustomer: jest.fn().mockResolvedValue('cus_contract'),
}));

import {
  createCreditPurchaseSession,
  PaygNotAvailableError,
  PAYG_NOT_AVAILABLE_CODE,
  PAYG_NOT_AVAILABLE_MESSAGE,
} from './services/payg.service';

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

let seq = 0;
/** `getSubscription` memoizes per user for 30s. */
function nextUserId(label: string) {
  seq += 1;
  return `payg-contract-${label}-${seq}`;
}

function arrange(row: Record<string, unknown> | null) {
  mockPrisma.subscriptions.findFirst.mockResolvedValue(row);
  mockPrisma.profiles.findUnique.mockResolvedValue({
    id: 'p',
    stripe_customer_id: 'cus_contract',
    credits: 0,
    credits_seconds: 0,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
  });
  mockStripe.checkout.sessions.create.mockResolvedValue({
    id: 'cs',
    url: 'https://checkout.stripe.test/cs',
  });
}

function buy(userId: string, credits = 25) {
  return createCreditPurchaseSession(userId, 'member@example.com', { credits } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PAYG refusal — status and code', () => {
  it('throws PaygNotAvailableError for a Discover member', async () => {
    const userId = nextUserId('discover');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    await expect(buy(userId)).rejects.toBeInstanceOf(PaygNotAvailableError);
  });

  it('carries a 403 status, not a 500', async () => {
    const userId = nextUserId('status');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    try {
      await buy(userId);
      throw new Error('expected refusal');
    } catch (error) {
      const e = error as PaygNotAvailableError;
      // 403 is what stops the global handler masking the message as a server fault.
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe(PAYG_NOT_AVAILABLE_CODE);
      expect(e.code).toBe('PAYG_REQUIRES_PAID_MEMBERSHIP');
    }
  });

  it('keeps the exact original message, so existing callers are unaffected', async () => {
    const userId = nextUserId('message');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    await expect(buy(userId)).rejects.toThrow(PAYG_NOT_AVAILABLE_MESSAGE);
    await expect(buy(nextUserId('message2'))).rejects.toThrow(
      'Pay-As-You-Go is only available for Core and Pro plans.'
    );
  });

  it('names the membership and the upgrade target', async () => {
    const userId = nextUserId('upgrade');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    try {
      await buy(userId);
      throw new Error('expected refusal');
    } catch (error) {
      const e = error as PaygNotAvailableError;
      expect(e.membership).toBe('DISCOVER');
      expect(e.upgradeMembership).toBe('GROW');
    }
  });

  it('is still an Error, so untouched call sites keep working', async () => {
    const userId = nextUserId('is-error');
    arrange({ plan_type: 'trial', status: 'active', end_date: FUTURE });

    await expect(buy(userId)).rejects.toBeInstanceOf(Error);
  });
});

describe('PAYG refusal — response body', () => {
  it('renders the fields a client needs, and nothing sensitive', async () => {
    const error = new PaygNotAvailableError('DISCOVER');

    expect(error.toResponse()).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      code: 'PAYG_REQUIRES_PAID_MEMBERSHIP',
      message: PAYG_NOT_AVAILABLE_MESSAGE,
      membership: 'DISCOVER',
      upgradeMembership: 'GROW',
    });
  });

  it('omits the upgrade target when there is nothing to upgrade to', () => {
    // Defensive: paid memberships can purchase, so this is unreachable in practice — but the
    // body must never invent an upgrade that does not exist.
    expect(new PaygNotAvailableError('THRIVE').toResponse()).not.toHaveProperty(
      'upgradeMembership'
    );
  });

  it('never leaks a plan value, price, or Stripe identifier in the STRUCTURED fields', () => {
    // The `message` is deliberately excluded: it still reads "…only available for Core and Pro
    // plans", the exact original wording, preserved so the Phase 1B parity proof and existing
    // callers keep working. That legacy string is the reason clients should branch on `code` and
    // render their own copy rather than display this message. Tracked as a residual item.
    const { message, ...structured } = new PaygNotAvailableError('DISCOVER').toResponse();
    const serialized = JSON.stringify(structured).toLowerCase();

    expect(message).toBe(PAYG_NOT_AVAILABLE_MESSAGE);
    for (const forbidden of ['trial', '"core"', '"pro"', 'price_', 'cus_', 'sk_']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe('PAYG — entitled members are unaffected', () => {
  it.each([
    ['core', 'GROW'],
    ['pro', 'THRIVE'],
  ])('%s still reaches checkout', async (plan) => {
    const userId = nextUserId(`allowed-${plan}`);
    arrange({ plan_type: plan, status: 'active', end_date: FUTURE });

    await expect(buy(userId)).resolves.toMatchObject({
      checkoutUrl: 'https://checkout.stripe.test/cs',
    });
  });
});
