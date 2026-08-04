import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import { PLAN_LIMITS } from '../billing.constants';
import { CreateCreditPurchaseInput } from '../billing.schema';
import { CLIENT_URL } from '../billing.config';
import { getSubscription } from './subscription.service';
import { getOrCreateStripeCustomer } from './stripe-customer.service';
import { getMembershipEntitlements, type MembershipTier } from '../../entitlements';

/** Exact wording retained from the original throw — clients and tests match on it. */
export const PAYG_NOT_AVAILABLE_MESSAGE =
  'Pay-As-You-Go is only available for Core and Pro plans.';

export const PAYG_NOT_AVAILABLE_CODE = 'PAYG_REQUIRES_PAID_MEMBERSHIP';

/**
 * A membership is not permitted to buy additional minutes.
 *
 * PHASE 5. This used to be a bare `throw new Error(...)`. Without a `statusCode`, the global
 * error handler classified it as a 500 and — because it treats 5xx as server faults — REPLACED
 * the message with "Something went wrong on Server side." The real reason never reached the
 * client, so the UI could only tell members to "wait a moment and try again", which would never
 * work: the block is a membership rule, not a transient failure.
 *
 * Modelled on `ActiveChallengeLimitError` so both membership refusals answer the same shape.
 * The message text is unchanged, so existing callers and the PAYG parity suite are unaffected;
 * only the status (500 -> 403) and the added `code`/`membership` fields are new.
 */
export class PaygNotAvailableError extends Error {
  readonly statusCode = 403;
  readonly code = PAYG_NOT_AVAILABLE_CODE;
  readonly membership: MembershipTier;
  readonly upgradeMembership: MembershipTier | null;

  constructor(membership: MembershipTier) {
    super(PAYG_NOT_AVAILABLE_MESSAGE);
    this.name = 'PaygNotAvailableError';
    this.membership = membership;
    // Only DISCOVER lacks PAYG, so the upgrade target is the next membership up.
    this.upgradeMembership = membership === 'DISCOVER' ? 'GROW' : null;
  }

  /** Response body for this refusal. Mirrors the challenge-limit contract. */
  toResponse() {
    return {
      statusCode: this.statusCode,
      error: 'Forbidden',
      code: this.code,
      message: this.message,
      membership: this.membership,
      ...(this.upgradeMembership ? { upgradeMembership: this.upgradeMembership } : {}),
    };
  }
}

export async function createCreditPurchaseSession(
  userId: string,
  email: string,
  data: CreateCreditPurchaseInput
) {
  const customerId = await getOrCreateStripeCustomer(userId, email);

  // ---- Authorization: the entitlement engine decides IF the member may buy ----
  //
  // PHASE 1B MIGRATION. Eligibility used to be inferred from the shape of a pricing constant
  // (`PLAN_LIMITS[plan].payAsYouGoRate === null`), which quietly made a rate table into an
  // authorization table. It is now an explicit entitlement.
  //
  // Behaviour is unchanged — see `payg.entitlement-parity.test.ts`, made green against the
  // previous implementation and passing unaltered against this one.
  const entitlements = await getMembershipEntitlements(userId);

  if (!entitlements.canPurchaseMinutes) {
    throw new PaygNotAvailableError(entitlements.membership);
  }

  // ---- Pricing: billing still decides HOW MUCH, and stays the only owner of money ----
  //
  // `PLAN_LIMITS` deliberately remains the rate source. Moving rates into the entitlement
  // resolver would make it a financial authority, which is precisely the coupling this split
  // exists to prevent.
  const subscription = await getSubscription(userId);
  const planType = (subscription?.plan_type || 'trial') as keyof typeof PLAN_LIMITS;
  const rate = PLAN_LIMITS[planType]?.payAsYouGoRate;

  if (rate === null || rate === undefined) {
    // Defensive only: an entitled member always maps to a plan carrying a rate. Reaching this
    // means the rate table and the tier matrix have drifted apart, so fail closed rather than
    // charge an improvised amount.
    //
    // Deliberately a PLAIN Error, unlike the membership refusal above: this is a server-side
    // configuration fault, not a decision about the member, and it should surface as a 500 so it
    // is investigated rather than shown to someone as an upgrade prompt.
    throw new Error(PAYG_NOT_AVAILABLE_MESSAGE);
  }

  const amountInCents = Math.round(data.credits * rate * 100);

  // Minimum Stripe amount is $0.50
  if (amountInCents < 50) {
    throw new Error('Minimum purchase amount is $0.50');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${data.credits} Credits`,
            description: `One-time purchase of ${data.credits} credits at $${rate}/min`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      type: 'credits',
      credits: data.credits.toString(),
      planType,
    },
    invoice_creation: {
      enabled: true,
    },
    success_url: `${CLIENT_URL}/app/billing?success=true&credits=${data.credits}`,
    cancel_url: `${CLIENT_URL}/app/billing?canceled=true`,
  });

  return { checkoutUrl: session.url };
}

/**
 * Admin PAYG list: source of truth is `payment_transactions` (written when checkout completes).
 * Stripe invoice heuristics missed many real purchases (line items without expanded price metadata).
 */
export async function getAllPaygTransactions() {
  const txs = await prisma.payment_transactions.findMany({
    where: { status: 'completed' },
    orderBy: { created_at: 'desc' },
    take: 500,
  });

  if (txs.length === 0) {
    return [];
  }

  const userIds = [...new Set(txs.map((t) => t.user_id))];
  const profiles = await prisma.profiles.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      full_name: true,
      users: { select: { email: true } },
    },
  });
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return txs.map((tx) => {
    const meta = (tx.metadata as Record<string, unknown> | null) || {};
    const planType =
      (meta.planType as string | undefined) ||
      (meta.plan_type as string | undefined) ||
      'credits';

    const p = profileById.get(tx.user_id);
    const email = p?.email?.trim() || p?.users?.email?.trim() || null;
    const name = p?.full_name?.trim() || null;

    return {
      id: tx.stripe_session_id,
      status: tx.status,
      amount: tx.amount / 100,
      currency: tx.currency,
      created: tx.created_at.toISOString(),
      user_id: tx.user_id,
      user_email: email,
      user_name: name,
      minutes_purchased: tx.credits_amount,
      payment_method: 'Card',
      plan_type: planType,
    };
  });
}

/** Fast aggregate for dashboards (no Stripe). */
export async function getAdminPaygSummary() {
  const agg = await prisma.payment_transactions.aggregate({
    where: { status: 'completed' },
    _sum: { amount: true },
    _count: true,
  });

  return {
    totalRevenue: (agg._sum.amount ?? 0) / 100,
    transactionCount: agg._count,
  };
}

export async function syncPaygCredits(userId: string) {
  const profile = await prisma.profiles.findUnique({ where: { id: userId } });

  if (!profile?.stripe_customer_id) {
    return { added: 0, transactions: 0 };
  }

  // List successful checkout sessions
  const sessions = await stripe.checkout.sessions.list({
    customer: profile.stripe_customer_id,
    limit: 100,
    expand: ['data.line_items'],
  });

  let addedCredits = 0;
  let processedTransactions = 0;

  for (const session of sessions.data) {
    // Only process paid sessions
    if (session.payment_status !== 'paid') continue;

    // Check for credits metadata
    const isCreditPurchase = session.metadata?.type === 'credits';

    if (!isCreditPurchase) continue;

    const credits = parseInt(session.metadata?.credits || '0', 10);
    if (credits <= 0) continue;

    // Check if already processed
    const existingTx = await prisma.payment_transactions.findUnique({
      where: { stripe_session_id: session.id },
    });

    if (existingTx) continue;

    // Process new transaction
    await prisma.$transaction(async (tx) => {
      // Record transaction
      await tx.payment_transactions.create({
        data: {
          user_id: userId,
          stripe_session_id: session.id,
          amount: session.amount_total || 0,
          currency: session.currency || 'usd',
          credits_amount: credits,
          status: 'completed',
          metadata: session.metadata || {},
        },
      });

      // Update user credits
      await tx.profiles.update({
        where: { id: userId },
        data: {
          purchased_credits: {
            increment: credits,
          },
          purchased_credits_seconds: {
            increment: credits * 60,
          },
        },
      });
    });

    addedCredits += credits;
    processedTransactions++;
  }

  return { added: addedCredits, transactions: processedTransactions };
}

