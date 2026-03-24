import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import { STRIPE_PRICE_IDS, PLAN_LIMITS } from '../billing.constants';
import { CreateSubscriptionInput, UpdateSubscriptionInput, CreateCreditPurchaseInput } from '../billing.schema';
import { CLIENT_URL } from '../billing.config';
import {
  subscriptionsCache,
  SUBSCRIPTIONS_CACHE_TTL,
} from '../billing.cache';
import { getOrCreateStripeCustomer } from './stripe-customer.service';

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
      where: { user_id: userId },
    });

    const trialCredits = PLAN_LIMITS.trial.credits;

    if (existing) {
      const updated = await prisma.subscriptions.update({
        where: { id: existing.id },
        data: {
          plan_type: 'trial',
          status: 'active',
          billing_cycle: data.billing_cycle,
          amount: 0,
          end_date: null, // Ongoing until upgraded or limits hit
        },
      });

      // Reset/Set credits for trial
      await prisma.profiles.update({
        where: { id: userId },
        data: {
          credits: trialCredits,
          credits_seconds: trialCredits * 60,
        },
      });

      return { subscription: updated };
    }

    const subscription = await prisma.subscriptions.create({
      data: {
        user_id: userId,
        plan_type: 'trial',
        status: 'active',
        billing_cycle: data.billing_cycle,
        amount: 0,
        start_date: new Date(),
      },
    });

    // Set credits for trial
    await prisma.profiles.update({
      where: { id: userId },
      data: {
        credits: trialCredits,
        credits_seconds: trialCredits * 60,
      },
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
      billing_cycle: data.billing_cycle,
      start_date: new Date(),
      // No end date yet
    },
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
      billing_cycle: data.billing_cycle,
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

  const successUrl =
    data.successUrl ||
    `${CLIENT_URL}/signup?postCheckout=1&plan=${data.plan_type}&session_id={CHECKOUT_SESSION_ID}`;
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

export async function linkSubscriptionToUser(userId: string, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session.customer) return;

  const customerId = session.customer as string;

  // Update user profile
  await prisma.profiles.update({
    where: { id: userId },
    data: { stripe_customer_id: customerId },
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
          full_name: true,
        },
      },
    },
  });

  // 2. Map results
  const result = subs.map((sub) => ({
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
    },
  }));

  subscriptionsCache.set(cacheKey, { data: result, timestamp: Date.now() });
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
  const activeSub = stripeSubs.data.find((s) => validStatuses.includes(s.status));

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
    where: { stripe_sub_id: activeSub.id },
  });

  // If not found by ID, find by user and most recent (likely the trial or pending one)
  if (!existingSub) {
    existingSub = await prisma.subscriptions.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  let updatedSub: any;
  const subData: any = {
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
      data: subData,
    });
  } else {
    updatedSub = await prisma.subscriptions.create({
      data: {
        user_id: userId,
        ...subData,
        billing_cycle: 'monthly', // Default (kept as-is to avoid functional drift)
      },
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

