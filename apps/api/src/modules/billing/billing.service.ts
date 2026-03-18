import prisma from '../../lib/prisma';
import { stripe } from '../../config/stripe';
import { STRIPE_PRICE_IDS, PLAN_LIMITS } from './billing.constants';
import { CreateSubscriptionInput, UpdateSubscriptionInput, CreateCreditPurchaseInput } from './billing.schema';

// Simple in-memory cache for billing data
const BILLING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_INVOICES_TTL = 30 * 1000; // 30 seconds for user invoices
let allInvoicesCache: { data: any[]; timestamp: number } | null = null;
let allTransactionsCache: { data: any[]; timestamp: number } | null = null;
const userInvoicesCache = new Map<string, { data: any[]; timestamp: number }>();

const SUBSCRIPTIONS_CACHE_TTL = 30 * 1000; // 30 seconds
const subscriptionsCache = new Map<string, { data: any[]; timestamp: number }>();

const CLIENT_URL =
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://meetezri-live-web.vercel.app'
    : 'http://localhost:5173');

async function getOrCreateStripeCustomer(userId: string, email: string) {
  const profile = await prisma.profiles.findUnique({ where: { id: userId } });
  
  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  await prisma.profiles.update({
    where: { id: userId },
    data: { stripe_customer_id: customer.id },
  });

  return customer.id;
}

export async function getSubscription(userId: string) {
  const sub = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      NOT: {
        status: {
          in: ['incomplete', 'incomplete_expired'],
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!sub) return null;

  const status = sub.status || '';
  const now = new Date();
  
  // If canceled and past end date, treat as no subscription (fall back to trial/free)
  if (['canceled', 'cancelled'].includes(status) && sub.end_date && sub.end_date < now) {
    return null;
  }
  
  return sub;
}

export async function createCheckoutSession(userId: string, email: string, data: CreateSubscriptionInput) {
  // Handle Trial Plan - Create subscription directly without Stripe
  if (data.plan_type === 'trial') {
    const existing = await prisma.subscriptions.findFirst({
      where: { user_id: userId }
    });

    const trialCredits = PLAN_LIMITS.trial.credits;

    if (existing) {
      const updated = await prisma.subscriptions.update({
        where: { id: existing.id },
        data: {
          plan_type: 'trial',
          status: 'active',
          billing_cycle: 'monthly',
          amount: 0,
          end_date: null, // Ongoing until upgraded or limits hit
        }
      });
      
      // Reset/Set credits for trial
      await prisma.profiles.update({
        where: { id: userId },
        data: { credits: trialCredits }
      });

      return { subscription: updated };
    }

    const subscription = await prisma.subscriptions.create({
      data: {
        user_id: userId,
        plan_type: 'trial',
        status: 'active',
        billing_cycle: 'monthly',
        amount: 0,
        start_date: new Date(),
      }
    });

    // Set credits for trial
    await prisma.profiles.update({
      where: { id: userId },
      data: { credits: trialCredits }
    });

    return { subscription };
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);
  
  const priceId = STRIPE_PRICE_IDS[data.plan_type as keyof typeof STRIPE_PRICE_IDS];
  
  if (!priceId) {
    throw new Error('Invalid plan type');
  }

  // SAVE INTENT: Create a pending subscription in DB so UI knows what user selected
  const pendingSub = await prisma.subscriptions.create({
    data: {
      user_id: userId,
      plan_type: data.plan_type,
      status: 'incomplete', // Will be updated by webhook or sync
      billing_cycle: 'monthly',
      start_date: new Date(),
      // No end date yet
    }
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      planType: data.plan_type,
      subscriptionId: pendingSub.id, // Link to our DB ID if useful
    },
    success_url: data.successUrl || `${CLIENT_URL}/app/billing?success=true`,
    cancel_url: data.cancelUrl || `${CLIENT_URL}/app/billing?canceled=true`,
  });

  return { checkoutUrl: session.url };
}

export async function createGuestCheckoutSession(data: CreateSubscriptionInput) {
  const priceId = STRIPE_PRICE_IDS[data.plan_type as keyof typeof STRIPE_PRICE_IDS];
  
  if (!priceId) {
    throw new Error('Invalid plan type');
  }

  const successUrl = data.successUrl || `${CLIENT_URL}/signup?postCheckout=1&plan=${data.plan_type}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = data.cancelUrl || `${CLIENT_URL}/pricing`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    subscription_data: {
      trial_period_days: undefined, // Paid plans start immediately
    },
  });

  return { checkoutUrl: session.url };
}

export async function createCreditPurchaseSession(userId: string, email: string, data: CreateCreditPurchaseInput) {
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

export async function linkSubscriptionToUser(userId: string, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session.customer) return;

  const customerId = session.customer as string;
  
  // Update user profile
  await prisma.profiles.update({
    where: { id: userId },
    data: { stripe_customer_id: customerId }
  });

  // Sync subscriptions
  await syncSubscriptionWithStripe(userId);
}

export async function createPortalSession(userId: string) {
  const profile = await prisma.profiles.findUnique({ where: { id: userId } });
  
  if (!profile?.stripe_customer_id) {
    throw new Error('No billing account found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${CLIENT_URL}/app/billing`,
  });

  return { portalUrl: session.url };
}

// Kept for backward compatibility or admin manual creation if needed
export async function createSubscription(userId: string, data: CreateSubscriptionInput) {
  // ... existing implementation if needed, or deprecate
  // For now, we will rely on webhooks to create the actual subscription record in DB
  // But to satisfy the controller signature if not changed yet:
  return { id: 'pending', status: 'pending' }; 
}

export async function updateSubscription(userId: string, data: UpdateSubscriptionInput) {
  const sub = await prisma.subscriptions.findFirst({
    where: { user_id: userId, status: 'active' },
  });

  if (!sub) {
    throw new Error('No active subscription found');
  }

  return prisma.subscriptions.update({
    where: { id: sub.id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function updateSubscriptionById(id: string, data: UpdateSubscriptionInput) {
  return prisma.subscriptions.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function cancelSubscription(userId: string) {
  const sub = await prisma.subscriptions.findFirst({
    where: { user_id: userId, status: 'active' },
  });

  if (!sub) {
    throw new Error('No active subscription found');
  }

  return prisma.subscriptions.update({
    where: { id: sub.id },
    data: {
      status: 'canceled',
      end_date: new Date(),
      updated_at: new Date(),
    },
  });
}

export async function getBillingHistory(userId: string) {
  return prisma.subscriptions.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
}

export async function getInvoicesForUser(userId: string) {
  const now = Date.now();
  const cached = userInvoicesCache.get(userId);
  if (cached && (now - cached.timestamp < USER_INVOICES_TTL)) {
    return cached.data;
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: {
      stripe_customer_id: true,
    },
  });

  if (!profile?.stripe_customer_id) {
    return [];
  }

  const invoices = await stripe.invoices.list({
    customer: profile.stripe_customer_id,
    limit: 50,
    expand: ['data.lines.data.price'],
  });

  const planTypeByPriceId = new Map<string, keyof typeof PLAN_LIMITS>([
    [STRIPE_PRICE_IDS.core, 'core'],
    [STRIPE_PRICE_IDS.pro, 'pro'],
  ]);

  const result = invoices.data.map((invoice) => {
    const creditsFromMetadata = invoice.metadata?.credits
      ? parseInt(invoice.metadata.credits, 10)
      : undefined;

    const creditsFromLines = (invoice.lines?.data || []).reduce((sum, line) => {
      const value = line.metadata?.credits
        ? parseInt(line.metadata.credits, 10)
        : 0;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalCredits =
      (Number.isFinite(creditsFromMetadata || NaN) ? creditsFromMetadata || 0 : 0) +
      creditsFromLines;

    const planTypeFromMetadata =
      (invoice.metadata?.planType as string | undefined) ||
      (invoice.metadata?.plan_type as string | undefined);

    const planTypeFromPriceId =
      (invoice.lines?.data || [])
        .map((line) => line.price?.id)
        .filter((id): id is string => typeof id === 'string')
        .map((id) => planTypeByPriceId.get(id))
        .find((value): value is keyof typeof PLAN_LIMITS => !!value);

    const planType =
      (planTypeFromPriceId as string | undefined) ||
      (planTypeFromMetadata as string | undefined) ||
      null;

    const minutesPurchased =
      totalCredits > 0
        ? totalCredits
        : planType && PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
          ? PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS].credits
          : null;

    return {
      id: invoice.id,
      status: invoice.status,
      amount_due: (invoice.amount_due || 0) / 100,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000).toISOString(),
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      invoice_pdf: invoice.invoice_pdf || null,
      description: invoice.description || null,
      minutes_purchased: minutesPurchased,
      plan_type: planType,
    };
  });

  userInvoicesCache.set(userId, { data: result, timestamp: now });
  return result;
}

export async function getAllSubscriptions(page: number = 1, limit: number = 50) {
  const cacheKey = `${page}_${limit}`;
  const cached = subscriptionsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < SUBSCRIPTIONS_CACHE_TTL)) {
    return cached.data;
  }

  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100);

  // 1. Fetch subscriptions WITH profiles in one go
  const subs = await prisma.subscriptions.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    include: {
      profiles: {
        select: {
          email: true,
          full_name: true
        }
      }
    }
  });

  // 2. Map results
  const result = subs.map(sub => ({
    id: sub.id,
    user_id: sub.user_id,
    plan_type: sub.plan_type,
    status: sub.status,
    start_date: sub.start_date,
    end_date: sub.end_date,
    billing_cycle: sub.billing_cycle,
    amount: sub.amount,
    next_billing_at: sub.next_billing_at,
    payment_method: sub.payment_method,
    created_at: sub.created_at,
    updated_at: sub.updated_at,
    profiles: {
      email: sub.profiles?.email || null,
      full_name: sub.profiles?.full_name || null,
    }
  }));
  
  subscriptionsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function getAllInvoices() {
  const now = Date.now();
  if (allInvoicesCache && (now - allInvoicesCache.timestamp < BILLING_CACHE_TTL)) {
    return allInvoicesCache.data;
  }

  const invoices = await stripe.invoices.list({
    limit: 100,
  });

  const customerIds = Array.from(
    new Set(invoices.data.map((invoice) => invoice.customer).filter((id): id is string => typeof id === 'string'))
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

  const result = invoices.data.map((invoice) => {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    const profile = customerId ? profileByCustomerId.get(customerId) : undefined;

    return {
      id: invoice.id,
      status: invoice.status,
      amount_due: (invoice.amount_due || 0) / 100,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000).toISOString(),
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      invoice_pdf: invoice.invoice_pdf || null,
      description: invoice.description || null,
      user_id: profile?.id || null,
      user_email: profile?.email || null,
      user_name: profile?.full_name || null,
      metadata: invoice.metadata || {},
    };
  });

  allInvoicesCache = { data: result, timestamp: now };
  return result;
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
    const isCreditsInvoice = invoice.lines.data.some((line) =>
      line.price?.metadata?.type === 'credits' || line.metadata?.type === 'credits'
    );
    const isCreditsMetadata = invoice.metadata?.type === 'credits';
    return isCreditsInvoice || isCreditsMetadata;
  });

  const customerIds = Array.from(
    new Set(
      paygInvoices
        .map((invoice) => invoice.customer)
        .filter((id): id is string => typeof id === 'string')
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
      const value = line.metadata?.credits
        ? parseInt(line.metadata.credits, 10)
        : 0;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalCredits =
      (Number.isFinite(creditsFromMetadata || NaN) ? creditsFromMetadata || 0 : 0) +
      creditsFromLines;

    const planTypeFromMetadata =
      (invoice.metadata?.planType as string | undefined) ||
      (invoice.metadata?.plan_type as string | undefined) ||
      invoice.lines.data
        .map((line) => (line.metadata?.planType as string | undefined) || (line.metadata?.plan_type as string | undefined))
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

  allTransactionsCache = { data: result, timestamp: now };
  return result;
}

export async function syncSubscriptionWithStripe(userId: string) {
  const profile = await prisma.profiles.findUnique({ where: { id: userId } });
  
  if (!profile?.stripe_customer_id) {
    return getSubscription(userId);
  }

  // Fetch subscriptions from Stripe (active, trialing, incomplete)
  const stripeSubs = await stripe.subscriptions.list({
    customer: profile.stripe_customer_id,
    status: 'all', // Fetch all to be safe, then filter
    limit: 5,
  });

  // Find the most relevant subscription (active > trialing > incomplete)
  // Filter out canceled unless it's the only one? No, we want active/trialing.
  const validStatuses = ['active', 'trialing', 'incomplete', 'past_due'];
  const activeSub = stripeSubs.data.find(s => validStatuses.includes(s.status));

  if (!activeSub) {
    // No active subscription in Stripe
    return getSubscription(userId);
  }

  const priceId = activeSub.items.data[0].price.id;

  // Determine plan type from price ID
  let planType = 'trial';
  if (priceId === STRIPE_PRICE_IDS.core) planType = 'core';
  else if (priceId === STRIPE_PRICE_IDS.pro) planType = 'pro';
  else {
    if (activeSub.metadata?.planType) {
        planType = activeSub.metadata.planType;
    }
  }

  if (planType === 'trial') {
    return getSubscription(userId);
  }

  // Update DB
  // First try to find by stripe_sub_id
  let existingSub = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: activeSub.id }
  });

  // If not found by ID, find by user and most recent (likely the trial or pending one)
  if (!existingSub) {
    existingSub = await prisma.subscriptions.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' }
    });
  }

  let updatedSub;
  const subData = {
    stripe_sub_id: activeSub.id,
    status: activeSub.status,
    plan_type: planType,
    start_date: new Date(activeSub.current_period_start * 1000),
    end_date: new Date(activeSub.current_period_end * 1000),
    next_billing_at: new Date(activeSub.current_period_end * 1000),
    updated_at: new Date(),
  };

  if (existingSub) {
    updatedSub = await prisma.subscriptions.update({
        where: { id: existingSub.id },
        data: subData
    });
  } else {
    updatedSub = await prisma.subscriptions.create({
        data: {
            user_id: userId,
            ...subData,
            billing_cycle: 'monthly', // Default
        }
    });
  }

  // Sync Credits (Optional: Only if active/trialing)
  if (['active', 'trialing'].includes(activeSub.status)) {
    const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS];
    if (limits) {
      // Ensure both minute and second-based credits are updated for the new plan
      await prisma.profiles.update({
        where: { id: userId },
        data: { 
          credits: limits.credits,
          credits_seconds: limits.credits * 60,
        },
      });
    }
  }

  return updatedSub;
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
      where: { stripe_session_id: session.id }
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
        }
      });

      // Update user credits
      await tx.profiles.update({
        where: { id: userId },
        data: {
          purchased_credits: {
            increment: credits
          }
        }
      });
    });

    addedCredits += credits;
    processedTransactions++;
  }

  return { added: addedCredits, transactions: processedTransactions };
}
