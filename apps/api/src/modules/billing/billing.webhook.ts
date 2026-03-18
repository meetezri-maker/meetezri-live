import { FastifyRequest, FastifyReply } from 'fastify';
import { stripe } from '../../config/stripe';
import prisma from '../../lib/prisma';
import { STRIPE_PRICE_IDS, PLAN_LIMITS } from './billing.constants';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

async function addSubscriptionAllowance(userId: string, minutesToAdd: number) {
  if (!minutesToAdd || minutesToAdd <= 0) return;

  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { credits: true, credits_seconds: true },
  });

  const existingMinutes = profile?.credits ?? 0;
  const existingSeconds =
    profile?.credits_seconds && profile.credits_seconds > 0
      ? profile.credits_seconds
      : existingMinutes * 60;

  const newSeconds = existingSeconds + minutesToAdd * 60;
  const newMinutes = newSeconds === 0 ? 0 : Math.ceil(newSeconds / 60);

  await prisma.profiles.update({
    where: { id: userId },
    data: { credits: newMinutes, credits_seconds: newSeconds },
  });
}

export async function stripeWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!WEBHOOK_SECRET) {
    request.log.error('STRIPE_WEBHOOK_SECRET is not set');
    return reply.status(500).send({ error: 'Webhook secret not configured' });
  }

  const sig = request.headers['stripe-signature'];
  
  if (!sig) {
    return reply.status(400).send({ error: 'Missing stripe-signature header' });
  }

  let event;

  try {
    // fastify-raw-body attaches the raw body to request.rawBody
    // We need to cast request to any because we added the property via plugin
    const rawBody = (request as any).rawBody;
    
    if (!rawBody) {
        request.log.error('Raw body not available on request');
        return reply.status(400).send({ error: 'Raw body missing' });
    }

    event = stripe.webhooks.constructEvent(rawBody, sig as string, WEBHOOK_SECRET);
  } catch (err: any) {
    request.log.error({ err }, 'Webhook signature verification failed');
    return reply.status(400).send(`Webhook Error: ${err.message}`);
  }

  request.log.info({ type: event.type }, 'Processing Stripe webhook');

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as any, request);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.created':
      case 'invoice.finalized':
        await tryAnnotateInvoiceWithMinutes(event.data.object as any, request);
        break;
      case 'invoice.payment_succeeded':
        await tryAnnotateInvoiceWithMinutes(event.data.object as any, request);
        await handleInvoicePaymentSucceeded(event.data.object as any, request);
        break;
      default:
        request.log.info({ type: event.type }, 'Unhandled event type');
    }
  } catch (error) {
    request.log.error({ error }, 'Error processing webhook event');
    // Return 200 to acknowledge receipt even if processing failed to avoid retries loops for bad logic
    // But ideally 500 triggers retry. For dev/sandbox, 200 is safer to avoid spam.
    return reply.status(200).send({ error: 'Error processing event' });
  }

  return reply.send({ received: true });
}

async function tryAnnotateInvoiceWithMinutes(invoiceEvent: any, request: FastifyRequest) {
  const invoiceId = invoiceEvent?.id as string | undefined;
  if (!invoiceId) return;

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['lines.data.price'],
    });

    const existingCustomFields = (((invoice as any).custom_fields as any[]) || []) as any[];
    const hasMinutesCustomField = existingCustomFields.some(
      (f: any) => (f?.name || '').toLowerCase() === 'minutes'
    );
    const footer: string = (invoice as any).footer || '';
    const hasMinutesInFooter = footer.toLowerCase().includes('minutes:');

    const creditsFromMetadata = invoice.metadata?.credits
      ? parseInt(invoice.metadata.credits, 10)
      : undefined;

    const creditsFromLines = (invoice.lines?.data || []).reduce((sum, line: any) => {
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

    const priceIds = (invoice.lines?.data || [])
      .map((line: any) => line.price?.id)
      .filter((id: any): id is string => typeof id === 'string');

    let planTypeFromPrice: keyof typeof PLAN_LIMITS | null = null;
    if (priceIds.includes(STRIPE_PRICE_IDS.core)) planTypeFromPrice = 'core';
    else if (priceIds.includes(STRIPE_PRICE_IDS.pro)) planTypeFromPrice = 'pro';

    const planType = (planTypeFromPrice || (planTypeFromMetadata as any) || null) as
      | keyof typeof PLAN_LIMITS
      | null;

    const minutes =
      totalCredits > 0
        ? totalCredits
        : planType && PLAN_LIMITS[planType]
          ? PLAN_LIMITS[planType].credits
          : null;

    if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return;

    // Put minutes into the footer too because Stripe PDFs always render it,
    // while custom_fields may not appear depending on template/settings.
    const footerLine = `Minutes: ${minutes}`;
    const nextFooter =
      hasMinutesInFooter
        ? footer
        : footer
          ? `${footer}\n${footerLine}`
          : footerLine;

    await stripe.invoices.update(invoice.id, {
      metadata: {
        ...(invoice.metadata || {}),
        minutes_purchased: String(minutes),
        plan_type: planType ? String(planType) : (invoice.metadata as any)?.plan_type,
      },
      footer: nextFooter,
      custom_fields: hasMinutesCustomField
        ? existingCustomFields
        : [...existingCustomFields, { name: 'Minutes', value: String(minutes) }],
    });
  } catch (error: any) {
    request.log.warn({ error: error?.message || error, invoiceId }, 'Failed to annotate invoice with minutes');
  }
}

async function handleCheckoutSessionCompleted(session: any, request: FastifyRequest) {
  const userId = session.metadata?.userId;
  
  if (!userId) {
    console.warn('Missing userId in checkout session', session.id);
    return;
  }

  const customerId = session.customer as string | undefined;
  if (customerId) {
    // Persist linkage so we can always re-sync from Stripe even after DB restores.
    try {
      await prisma.profiles.update({
        where: { id: userId },
        data: { stripe_customer_id: customerId },
      });
    } catch (error) {
      request.log.error({ error, userId, customerId }, 'Failed to update stripe_customer_id on profile');
    }
  }

  // Handle one-time credit purchase
  if (session.metadata?.type === 'credits') {
    const credits = parseInt(session.metadata.credits || '0', 10);
    const amountTotal = session.amount_total || 0; // Amount in cents
    
    request.log.info({ 
      sessionId: session.id, 
      userId, 
      credits, 
      amount: amountTotal 
    }, 'Processing credit purchase webhook');

    if (credits > 0) {
      // Idempotency check using payment_transactions table
      const existingTx = await prisma.payment_transactions.findUnique({
        where: { stripe_session_id: session.id }
      });

      if (existingTx) {
        request.log.info({ sessionId: session.id }, 'Transaction already processed');
        return;
      }

      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Record the transaction
        await tx.payment_transactions.create({
          data: {
            user_id: userId,
            stripe_session_id: session.id,
            amount: amountTotal,
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
      
      request.log.info({ userId, credits }, 'Successfully added purchased credits');
    }
    return;
  }

  const planType = session.metadata?.planType;

  if (!planType) {
    console.warn('Missing planType in checkout session', session.id);
    return;
  }

  const subscriptionId = session.subscription as string;

  // Fetch full subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const existingByStripeId = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: subscription.id },
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

  if (existingByStripeId) {
    await prisma.subscriptions.update({
      where: { id: existingByStripeId.id },
      data: {
        status: subscription.status,
        plan_type: planType,
        start_date: new Date(subscription.current_period_start * 1000),
        end_date: new Date(subscription.current_period_end * 1000),
        next_billing_at: new Date(subscription.current_period_end * 1000),
      },
    });
  } else if (pendingCandidate) {
    await prisma.subscriptions.update({
      where: { id: pendingCandidate.id },
      data: {
        stripe_sub_id: subscription.id,
        status: subscription.status,
        plan_type: planType,
        start_date: new Date(subscription.current_period_start * 1000),
        end_date: new Date(subscription.current_period_end * 1000),
        next_billing_at: new Date(subscription.current_period_end * 1000),
      },
    });
  } else {
    await prisma.subscriptions.create({
      data: {
        user_id: userId,
        stripe_sub_id: subscription.id,
        status: subscription.status,
        plan_type: planType,
        start_date: new Date(subscription.current_period_start * 1000),
        end_date: new Date(subscription.current_period_end * 1000),
        next_billing_at: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  const shouldGrant =
    ['active', 'trialing'].includes(subscription.status) &&
    (!existingByStripeId || previousPlanType !== planType);

  if (shouldGrant) {
    const planCredits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]?.credits ?? 0;
    await addSubscriptionAllowance(userId, planCredits);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const existingSub = await prisma.subscriptions.findFirst({
      where: { stripe_sub_id: subscription.id }
  });

  if (!existingSub) return;

  // Detect plan change from Stripe price ID (covers Billing Portal upgrades/downgrades)
  // Webhook payloads can vary: price may be an object or a string ID.
  const firstItem = subscription?.items?.data?.[0];
  const priceId: string | undefined =
    (typeof firstItem?.price === 'string'
      ? firstItem.price
      : firstItem?.price?.id) ||
    // Older Stripe shapes sometimes include plan ID
    (typeof firstItem?.plan === 'string'
      ? firstItem.plan
      : firstItem?.plan?.id);
  let newPlanType: keyof typeof PLAN_LIMITS | null = null;
  if (priceId === STRIPE_PRICE_IDS.core) newPlanType = 'core';
  else if (priceId === STRIPE_PRICE_IDS.pro) newPlanType = 'pro';
  else if (subscription?.metadata?.planType && PLAN_LIMITS[subscription.metadata.planType as keyof typeof PLAN_LIMITS]) {
    newPlanType = subscription.metadata.planType as keyof typeof PLAN_LIMITS;
  }

  const previousPlanType = (existingSub.plan_type || 'trial') as keyof typeof PLAN_LIMITS;
  const planChanged = !!newPlanType && previousPlanType !== newPlanType;

  if (planChanged && newPlanType) {
    const planCredits = PLAN_LIMITS[newPlanType]?.credits ?? 0;
    if (planCredits > 0) {
      const profile = await prisma.profiles.findUnique({
        where: { id: existingSub.user_id },
        select: { credits: true, credits_seconds: true },
      });

      const existingMinutes = profile?.credits ?? 0;
      const existingSeconds =
        profile?.credits_seconds && profile.credits_seconds > 0
          ? profile.credits_seconds
          : existingMinutes * 60;

      await prisma.profiles.update({
        where: { id: existingSub.user_id },
        data: {
          credits: existingMinutes + planCredits,
          credits_seconds: existingSeconds + planCredits * 60,
        },
      });
    }
  }

  await prisma.subscriptions.update({
    where: { id: existingSub.id },
    data: {
      status: subscription.status,
      ...(planChanged && newPlanType ? { plan_type: newPlanType } : {}),
      end_date: new Date(subscription.current_period_end * 1000),
      next_billing_at: new Date(subscription.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  const existingSub = await prisma.subscriptions.findFirst({
      where: { stripe_sub_id: subscription.id }
  });

  if (!existingSub) return;

  await prisma.subscriptions.update({
    where: { id: existingSub.id },
    data: {
      status: 'canceled',
      plan_type: 'trial', // Revert to trial?
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: any, request: FastifyRequest) {
  // IMPORTANT:
  // - Upgrades/downgrades should NOT reset credits (we carry-over on checkout/session handling).
  // - Only true cycle renewals should reset the subscription bucket back to the plan allowance.
  const billingReason = invoice.billing_reason as string | undefined;
  if (billingReason === 'subscription_create') return;

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);

  const existingSub = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: subscription.id }
  });

  if (existingSub) {
    await prisma.subscriptions.update({
      where: { id: existingSub.id },
      data: {
        status: subscription.status,
        end_date: new Date(subscription.current_period_end * 1000),
        next_billing_at: new Date(subscription.current_period_end * 1000),
      },
    });

    // Never overwrite remaining credits after payments.
    // On renewals, we ADD the new cycle allowance on top of any remaining minutes.
    // This guarantees users never lose unused time (trial -> paid, paid -> upgraded, renewals).
    if (billingReason === 'subscription_cycle') {
      const planType = (existingSub.plan_type || 'trial') as keyof typeof PLAN_LIMITS;
      const planCredits = PLAN_LIMITS[planType]?.credits ?? 0;
      if (planCredits <= 0) return;

      const profile = await prisma.profiles.findUnique({
        where: { id: existingSub.user_id },
        select: { credits: true, credits_seconds: true },
      });

      const existingMinutes = profile?.credits ?? 0;
      const existingSeconds =
        profile?.credits_seconds && profile.credits_seconds > 0
          ? profile.credits_seconds
          : existingMinutes * 60;

      await prisma.profiles.update({
        where: { id: existingSub.user_id },
        data: {
          credits: existingMinutes + planCredits,
          credits_seconds: existingSeconds + planCredits * 60,
        },
      });
    }
  }
}
