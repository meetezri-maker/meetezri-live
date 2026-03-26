import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import { PLAN_LIMITS } from '../billing.constants';
import { CreateCreditPurchaseInput } from '../billing.schema';
import { CLIENT_URL } from '../billing.config';
import {
  allTransactionsCache,
  BILLING_CACHE_TTL,
  setAllTransactionsCache,
} from '../billing.cache';
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

export async function getAllPaygTransactions() {
  const now = Date.now();
  if (allTransactionsCache && (now - allTransactionsCache.timestamp < BILLING_CACHE_TTL)) {
    return allTransactionsCache.data;
  }

  const invoices = await stripe.invoices.list({
    limit: 100,
  });

  const paygInvoices = invoices.data.filter((invoice) => {
    const isCreditsInvoice = invoice.lines.data.some(
      (line) => line.price?.metadata?.type === 'credits' || line.metadata?.type === 'credits'
    );
    const isCreditsMetadata = invoice.metadata?.type === 'credits';
    return isCreditsInvoice || isCreditsMetadata;
  });

  const customerIds = Array.from(
    new Set(
      paygInvoices.map((invoice) => invoice.customer).filter((id): id is string => typeof id === 'string')
    )
  );

  const profiles = await prisma.profiles.findMany({
    where: {
      stripe_customer_id: {
        in: customerIds,
      },
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      stripe_customer_id: true,
    },
  });

  const profileByCustomerId = new Map<string, (typeof profiles)[number]>();
  for (const profile of profiles) {
    if (profile.stripe_customer_id) {
      profileByCustomerId.set(profile.stripe_customer_id, profile);
    }
  }

  const result = paygInvoices.map((invoice) => {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    const profile = customerId ? profileByCustomerId.get(customerId) : undefined;

    const creditsFromMetadata = invoice.metadata?.credits
      ? parseInt(invoice.metadata.credits, 10)
      : undefined;

    const creditsFromLines = invoice.lines.data.reduce((sum, line) => {
      const value = line.metadata?.credits ? parseInt(line.metadata.credits, 10) : 0;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalCredits =
      (Number.isFinite(creditsFromMetadata || NaN) ? creditsFromMetadata || 0 : 0) + creditsFromLines;

    const planTypeFromMetadata =
      (invoice.metadata?.planType as string | undefined) ||
      (invoice.metadata?.plan_type as string | undefined) ||
      invoice.lines.data
        .map(
          (line) =>
            (line.metadata?.planType as string | undefined) ||
            (line.metadata?.plan_type as string | undefined)
        )
        .find((value) => !!value);

    return {
      id: invoice.id,
      status: invoice.status,
      amount: (invoice.amount_paid || invoice.amount_due || 0) / 100,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000).toISOString(),
      credits: totalCredits,
      minutes_purchased: totalCredits > 0 ? totalCredits : null,
      payment_method: invoice.payment_intent ? 'Card' : null,
      plan_type: planTypeFromMetadata || 'credits',
      user_id: profile?.id || null,
      user_email: profile?.email || null,
      user_name: profile?.full_name || null,
    };
  });

  setAllTransactionsCache({ data: result, timestamp: now });
  return result;
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

