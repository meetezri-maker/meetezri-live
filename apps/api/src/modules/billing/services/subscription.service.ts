import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import { STRIPE_PRICE_IDS, PLAN_LIMITS } from '../billing.constants';
import { stripeSubscriptionMrrUsd } from '../stripe-mrr';
import { CreateSubscriptionInput, UpdateSubscriptionInput, CreateCreditPurchaseInput } from '../billing.schema';
import { CLIENT_URL } from '../billing.config';
import {
  subscriptionsCache,
  SUBSCRIPTIONS_CACHE_TTL,
  clearSubscriptionsCache,
} from '../billing.cache';
import { getOrCreateStripeCustomer } from './stripe-customer.service';
import { ensureSingleActiveTrial } from './trial.service';
import { addSubscriptionAllowanceMinutes } from '../credit-balance.service';

const userSubscriptionCache = new Map<string, { data: any; timestamp: number }>();
const USER_SUBSCRIPTION_CACHE_TTL = 30 * 1000; // 30s: avoids repeated subscription lookups on navigation.
const userSubscriptionInFlight = new Map<string, Promise<any | null>>();

const userBillingHistoryCache = new Map<string, { data: any[]; timestamp: number }>();
const USER_BILLING_HISTORY_TTL = 30 * 1000;
const userBillingHistoryInFlight = new Map<string, Promise<any[]>>();

function clearUserBillingCaches(userId: string) {
  userSubscriptionCache.delete(userId);
  userSubscriptionInFlight.delete(userId);
  userBillingHistoryCache.delete(userId);
  userBillingHistoryInFlight.delete(userId);
}

export async function getSubscription(userId: string) {
  const cached = userSubscriptionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_SUBSCRIPTION_CACHE_TTL) {
    return cached.data ?? null;
  }

  const inFlight = userSubscriptionInFlight.get(userId);
  if (inFlight) return await inFlight;

  const run = (async () => {
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

    if (!sub) {
      userSubscriptionCache.set(userId, { data: null, timestamp: Date.now() });
      return null;
    }

    const status = sub.status || '';
    const now = new Date();

    // If canceled and past end date, treat as no subscription (fall back to trial/free)
    if (['canceled', 'cancelled'].includes(status) && sub.end_date && sub.end_date < now) {
      userSubscriptionCache.set(userId, { data: null, timestamp: Date.now() });
      return null;
    }

    userSubscriptionCache.set(userId, { data: sub, timestamp: Date.now() });
    return sub;
  })().finally(() => {
    userSubscriptionInFlight.delete(userId);
  });

  userSubscriptionInFlight.set(userId, run);
  return await run;
}

export async function createCheckoutSession(userId: string, email: string, data: CreateSubscriptionInput) {
  // Handle Trial Plan - Create subscription directly without Stripe.
  // Row creation is owned by the canonical helper, which enforces at-most-one-active-trial.
  //
  // BEHAVIOUR CHANGE (plan §2.1 W14, disposition "Fixed in-scope"): the lookup was previously
  // `findFirst({ user_id })` — ANY row, any plan, any status — so this endpoint could flip an
  // active PAID row to trial and reset that user's balance. It is now scoped to the user's
  // active TRIAL row, so a paid subscription is never downgraded here.
  //
  // The credit RESET below is deliberately left exactly as-is: it is overwrite semantics
  // (allowance impl A6), not stacking, and routing it through an audited adjustment path is
  // §4A / Gate 8 work that has not been approved yet.
  if (data.plan_type === 'trial') {
    const trialCredits = PLAN_LIMITS.trial.credits;

    const { subscription } = await ensureSingleActiveTrial(userId, {
      match: 'active_trial',
      billingCycle: data.billing_cycle,
      amount: 0,
      endDate: null, // Ongoing until upgraded or limits hit
      reshapeExisting: true,
    });

    // Reset/Set credits for trial
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

/**
 * Outcome classifications for checkout linking — plan §15.3.
 *
 * `unique_conflict_recovered` is defined by §15.3 but is NOT emitted here: it describes
 * recovery from a `P2002` on `subscriptions.stripe_sub_id`, and no unique constraint on that
 * column exists yet. It becomes reachable only with the approved constraint migration.
 */
export type LinkSubscriptionResult =
  | 'linked'
  | 'already_linked'
  | 'ownership_conflict'
  | 'missing_customer'
  | 'missing_subscription'
  | 'plan_unresolved'
  | 'failed';

/** Fixed vocabulary — plan §15.2. Never carries a raw error message. */
export type LinkSubscriptionErrorCategory =
  | 'stripe_error'
  | 'db_error'
  | 'db_conflict'
  | 'validation_error';

export interface LinkSubscriptionOutcome {
  result: LinkSubscriptionResult;
  errorCategory?: LinkSubscriptionErrorCategory;
  stripeSubscriptionId?: string;
  localSubscriptionId?: string;
  plan?: 'core' | 'pro';
  allowanceGranted: boolean;
  allowanceMinutes?: number;
}

/** Only paid plans may be resolved from a checkout — never `trial` (plan §5.3). */
const LINKABLE_PLANS = ['core', 'pro'] as const;
type LinkablePlan = (typeof LINKABLE_PLANS)[number];

function asLinkablePlan(value: unknown): LinkablePlan | null {
  return typeof value === 'string' && (LINKABLE_PLANS as readonly string[]).includes(value)
    ? (value as LinkablePlan)
    : null;
}

/**
 * Normalize `session.subscription`, which Stripe returns as either a bare id or an expanded
 * Subscription object depending on the caller's `expand`.
 */
function readSessionSubscriptionRef(
  raw: unknown
): { id: string; expanded: any | null } | null {
  if (typeof raw === 'string' && raw.length > 0) return { id: raw, expanded: null };
  if (raw && typeof raw === 'object') {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      return { id, expanded: raw };
    }
  }
  return null;
}

function readPriceId(subscription: any): string | undefined {
  const price = subscription?.items?.data?.[0]?.price;
  if (typeof price === 'string') return price;
  return typeof price?.id === 'string' ? price.id : undefined;
}

/**
 * Resolve the purchased plan from the EXACT subscription this checkout created — plan §3.2 step 5.
 *
 * Approved precedence:
 *   1. Stripe price id on the subscription's first item
 *   2. `subscription.metadata.planType`
 *   3. `session.metadata.planType`
 *   4. otherwise unresolved
 *
 * The local row's `plan_type` is deliberately NOT a fallback: it is the state being
 * synchronized, not an authoritative source.
 */
function resolveCheckoutPlan(subscription: any, session: any): LinkablePlan | null {
  const priceId = readPriceId(subscription);
  if (priceId === STRIPE_PRICE_IDS.core) return 'core';
  if (priceId === STRIPE_PRICE_IDS.pro) return 'pro';

  return (
    asLinkablePlan(subscription?.metadata?.planType) ??
    asLinkablePlan(session?.metadata?.planType)
  );
}

/**
 * Link the subscription created by a specific Checkout Session to a user.
 *
 * Anchored to `session.subscription` — it never consults `stripe.subscriptions.list`, which is
 * what allowed the wrong subscription (and therefore the wrong plan) to be selected when a
 * customer had leftovers. Customer-wide reconciliation remains the separate concern of
 * `syncSubscriptionWithStripe`.
 *
 * Idempotency: sequential re-calls for the same session are safe — the row lookup and the
 * grant share one transaction, so a second call sees the first call's committed row and
 * returns `already_linked` without granting. This is APPLICATION-LEVEL SEQUENTIAL idempotency
 * only. Truly concurrent callers can still both miss the lookup and both create a row; that
 * requires the unique constraint on `subscriptions.stripe_sub_id`, which does not exist yet.
 */
export async function linkSubscriptionToUser(
  userId: string,
  sessionId: string
): Promise<LinkSubscriptionOutcome> {
  // ---- Stripe reads: all of them complete before any transaction opens (plan §5.2) ----
  let session: any;
  let stripeSub: any;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);

    const customerId =
      typeof session?.customer === 'string' ? session.customer : session?.customer?.id;
    if (!customerId) {
      return { result: 'missing_customer', allowanceGranted: false };
    }

    // Persist the customer link only after the customer is validated (plan §3.2 step 2).
    await prisma.profiles.update({
      where: { id: userId },
      data: { stripe_customer_id: customerId },
    });

    const ref = readSessionSubscriptionRef(session?.subscription);
    if (!ref) {
      return { result: 'missing_subscription', allowanceGranted: false };
    }

    // Use the expanded object when Stripe already gave us a usable one; otherwise fetch the
    // exact subscription by id. Never a customer-wide list.
    stripeSub =
      ref.expanded && readPriceId(ref.expanded)
        ? ref.expanded
        : await stripe.subscriptions.retrieve(ref.id, { expand: ['items.data.price'] });
  } catch (error) {
    const category: LinkSubscriptionErrorCategory =
      session === undefined || stripeSub === undefined ? 'stripe_error' : 'db_error';
    return { result: 'failed', errorCategory: category, allowanceGranted: false };
  }

  const planType = resolveCheckoutPlan(stripeSub, session);
  if (!planType) {
    return {
      result: 'plan_unresolved',
      stripeSubscriptionId: stripeSub.id,
      allowanceGranted: false,
    };
  }

  const planCredits = PLAN_LIMITS[planType].credits;
  const mrrUsd = stripeSubscriptionMrrUsd(stripeSub as any);
  const subData = {
    stripe_sub_id: stripeSub.id,
    status: stripeSub.status,
    plan_type: planType,
    start_date: new Date(stripeSub.current_period_start * 1000),
    end_date: new Date(stripeSub.current_period_end * 1000),
    next_billing_at: new Date(stripeSub.current_period_end * 1000),
    updated_at: new Date(),
    ...(mrrUsd != null ? { amount: mrrUsd } : {}),
  };

  // ---- One transaction: row write + allowance grant commit together or not at all ----
  let outcome: LinkSubscriptionOutcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscriptions.findFirst({
        where: { stripe_sub_id: stripeSub.id },
        select: { id: true, user_id: true },
      });

      if (existing && existing.user_id !== userId) {
        // Never silently reassign a subscription between users.
        return {
          result: 'ownership_conflict' as const,
          errorCategory: 'db_conflict' as const,
          stripeSubscriptionId: stripeSub.id,
          localSubscriptionId: existing.id,
          plan: planType,
          allowanceGranted: false,
        };
      }

      if (existing) {
        // Reconcile mutable fields; the allowance was granted when the row was created.
        await tx.subscriptions.update({ where: { id: existing.id }, data: subData });
        return {
          result: 'already_linked' as const,
          stripeSubscriptionId: stripeSub.id,
          localSubscriptionId: existing.id,
          plan: planType,
          allowanceGranted: false,
        };
      }

      const created = await tx.subscriptions.create({
        data: { user_id: userId, ...subData, billing_cycle: 'monthly' },
      });
      await addSubscriptionAllowanceMinutes(userId, planCredits, tx);

      return {
        result: 'linked' as const,
        stripeSubscriptionId: stripeSub.id,
        localSubscriptionId: created.id,
        plan: planType,
        allowanceGranted: true,
        allowanceMinutes: planCredits,
      };
    });
  } catch (error) {
    // Rolled back: neither the row nor the grant persisted, and caches stay untouched.
    return {
      result: 'failed',
      errorCategory: 'db_error',
      stripeSubscriptionId: stripeSub.id,
      allowanceGranted: false,
    };
  }

  // Cache invalidation only after a successful commit (plan §5.2).
  // NOTE: the profile cache lives in `user.service.ts`; invalidating it from here would create
  // a billing -> users import cycle (user.service already imports billing.service). The caller
  // owns that invalidation when the live import is redirected to this implementation.
  clearUserBillingCaches(userId);
  return outcome;
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

  const updated = await prisma.subscriptions.update({
    where: { id: sub.id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
  clearUserBillingCaches(userId);
  return updated;
}

export async function updateSubscriptionById(id: string, data: UpdateSubscriptionInput) {
  clearSubscriptionsCache();
  const updated = await prisma.subscriptions.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
  // User id isn't available; rely on TTL cache for per-user.
  return updated;
}

export async function cancelSubscription(userId: string) {
  const sub = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
  });

  if (!sub) {
    throw new Error('No active subscription found');
  }

  let endDate = new Date();
  if (sub.stripe_sub_id) {
    try {
      const stripeSub = await stripe.subscriptions.update(sub.stripe_sub_id, {
        cancel_at_period_end: true,
      });
      endDate = new Date(stripeSub.current_period_end * 1000);
    } catch (error) {
      // Keep local cancellation path so users can still access billing even if Stripe call fails.
    }
  }

  const updated = await prisma.subscriptions.update({
    where: { id: sub.id },
    data: {
      status: 'canceled',
      end_date: endDate,
      next_billing_at: endDate,
      updated_at: new Date(),
    },
  });
  clearUserBillingCaches(userId);
  return updated;
}

export async function getBillingHistory(userId: string) {
  const cached = userBillingHistoryCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_BILLING_HISTORY_TTL) {
    return cached.data;
  }

  const inFlight = userBillingHistoryInFlight.get(userId);
  if (inFlight) return await inFlight;

  const run = (async () => {
    const data = await prisma.subscriptions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    userBillingHistoryCache.set(userId, { data, timestamp: Date.now() });
    return data;
  })().finally(() => {
    userBillingHistoryInFlight.delete(userId);
  });

  userBillingHistoryInFlight.set(userId, run);
  return await run;
}

export async function getAllSubscriptions(page: number = 1, limit: number = 50) {
  const cacheKey = `${page}_${limit}`;
  const cached = subscriptionsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < SUBSCRIPTIONS_CACHE_TTL)) {
    return cached.data;
  }

  const skip = (page - 1) * limit;
  const take = Math.min(limit, 500);

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

  const existingByStripeId = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: activeSub.id },
    select: { id: true, plan_type: true },
  });

  const pendingCandidate = !existingByStripeId
    ? await prisma.subscriptions.findFirst({
        where: {
          user_id: userId,
          stripe_sub_id: null,
          status: { in: ['incomplete', 'incomplete_expired'] },
          plan_type: planType,
        },
        orderBy: { created_at: 'desc' },
        select: { id: true, plan_type: true },
      })
    : null;

  const previousPlanType =
    (existingByStripeId?.plan_type || pendingCandidate?.plan_type || null) as string | null;

  const mrrUsd = stripeSubscriptionMrrUsd(activeSub as any);
  const subData: any = {
    stripe_sub_id: activeSub.id,
    status: activeSub.status,
    plan_type: planType,
    start_date: new Date(activeSub.current_period_start * 1000),
    end_date: new Date(activeSub.current_period_end * 1000),
    next_billing_at: new Date(activeSub.current_period_end * 1000),
    updated_at: new Date(),
    ...(mrrUsd != null ? { amount: mrrUsd } : {}),
  };

  // Stack plan minutes (same rules as Stripe webhooks / billing.service sync).
  // Eligibility is unchanged — only the write boundary is.
  const shouldGrant =
    ['active', 'trialing'].includes(activeSub.status) &&
    (!existingByStripeId || previousPlanType !== planType);

  // Row mutation and allowance grant are one logical state transition, so they commit
  // together. All Stripe reads above already completed outside this transaction (plan §5.2).
  const updatedSub = await prisma.$transaction(async (tx) => {
    let row: any;
    if (existingByStripeId) {
      row = await tx.subscriptions.update({
        where: { id: existingByStripeId.id },
        data: subData,
      });
    } else if (pendingCandidate) {
      row = await tx.subscriptions.update({
        where: { id: pendingCandidate.id },
        data: subData,
      });
    } else {
      row = await tx.subscriptions.create({
        data: {
          user_id: userId,
          ...subData,
          billing_cycle: 'monthly',
        },
      });
    }

    if (shouldGrant) {
      const planCredits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]?.credits ?? 0;
      await addSubscriptionAllowanceMinutes(userId, planCredits, tx);
    }

    return row;
  });

  return updatedSub;
}

