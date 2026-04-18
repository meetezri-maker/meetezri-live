import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import { PLAN_LIMITS } from '../billing.constants';
import { CreateCreditPurchaseInput } from '../billing.schema';
import { CLIENT_URL } from '../billing.config';
import { getSubscription } from './subscription.service';
import { getOrCreateStripeCustomer } from './stripe-customer.service';

export async function createCreditPurchaseSession(
  userId: string,
  email: string,
  data: CreateCreditPurchaseInput
) {
  const customerId = await getOrCreateStripeCustomer(userId, email);

  const subscription = await getSubscription(userId);
  const planType = (subscription?.plan_type || 'trial') as keyof typeof PLAN_LIMITS;

  // Get rate for plan, fallback to core if trial (or block if trial doesn't allow PAYG)
  // Currently trial plan has payAsYouGoRate: null, so we should probably block or use a standard rate
  // Let's use Core rate as standard for non-subscribers if we want to allow them to buy credits
  let rate = PLAN_LIMITS[planType]?.payAsYouGoRate;

  if (rate === null || rate === undefined) {
    // Trial plan does not include Pay-As-You-Go
    throw new Error('Pay-As-You-Go is only available for Core and Pro plans.');
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

