import { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { stripe } from '../../config/stripe';
import prisma from '../../lib/prisma';
import { PLAN_LIMITS, STRIPE_PRICE_IDS } from './billing.constants';
import { addSubscriptionAllowanceMinutes } from './credit-balance.service';

function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

/** If a row stays "processing" longer than this, allow a new attempt (crashed worker). */
const STALE_PROCESSING_MS = 15 * 60 * 1000;
const MAX_CLAIM_ATTEMPTS = 8;

function isPrismaUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

export type StripeWebhookBeginResult = 'run' | 'duplicate' | 'retry_later';

/**
 * Claim this Stripe event for processing. Cross-instance safe via DB unique constraint.
 */
export async function beginStripeWebhookProcessing(
  eventId: string,
  eventType: string
): Promise<StripeWebhookBeginResult> {
  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    try {
      await prisma.stripe_webhook_events.create({
        data: {
          id: eventId,
          event_type: eventType,
          status: 'processing',
        },
      });
      return 'run';
    } catch (e) {
      if (!isPrismaUniqueViolation(e)) throw e;

      const row = await prisma.stripe_webhook_events.findUnique({
        where: { id: eventId },
      });

      if (!row) continue;

      if (row.status === 'completed') return 'duplicate';

      const ageMs = Date.now() - row.created_at.getTime();
      if (row.status === 'processing' && ageMs > STALE_PROCESSING_MS) {
        await prisma.stripe_webhook_events.delete({ where: { id: eventId } }).catch(() => {});
        continue;
      }

      if (row.status === 'processing') return 'retry_later';

      return 'duplicate';
    }
  }

  return 'retry_later';
}

export async function completeStripeWebhookProcessing(eventId: string): Promise<void> {
  await prisma.stripe_webhook_events.update({
    where: { id: eventId },
    data: {
      status: 'completed',
      processed_at: new Date(),
    },
  });
}

export async function releaseStripeWebhookClaim(eventId: string): Promise<void> {
  await prisma.stripe_webhook_events.delete({ where: { id: eventId } }).catch(() => {});
}

export async function stripeWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret?.trim()) {
    request.log.error('STRIPE_WEBHOOK_SECRET is not set');
    return reply.status(500).send({ error: 'Internal Server Error', message: 'Unable to process webhook' });
  }

  const sig = request.headers['stripe-signature'];

  if (!sig) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Invalid webhook request' });
  }

  let event;

  try {
    const rawBody = (request as any).rawBody;

    if (!rawBody) {
      request.log.error('Raw body not available on request');
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid webhook request' });
    }

    event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
  } catch (err: any) {
    request.log.error({ err }, 'Webhook signature verification failed');
    return reply.status(400).send({ error: 'Bad Request', message: 'Invalid webhook signature' });
  }

  request.log.info({ type: event.type }, 'Processing Stripe webhook');

  const begin = await beginStripeWebhookProcessing(event.id, event.type);
  if (begin === 'duplicate') {
    request.log.info({ eventId: event.id, type: event.type }, 'Duplicate Stripe webhook event ignored');
    return reply.send({ received: true, duplicate: true });
  }
  if (begin === 'retry_later') {
    request.log.warn({ eventId: event.id, type: event.type }, 'Stripe webhook claim busy; asking Stripe to retry');
    return reply.status(503).send({ error: 'Service Unavailable', message: 'Webhook processing in progress' });
  }

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

    await completeStripeWebhookProcessing(event.id);
  } catch (error) {
    request.log.error({ error }, 'Error processing webhook event');
    await releaseStripeWebhookClaim(event.id);
    return reply.status(500).send({ error: 'Internal Server Error', message: 'Unable to process webhook' });
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
    try {
      await prisma.profiles.update({
        where: { id: userId },
        data: { stripe_customer_id: customerId },
      });
    } catch (error) {
      request.log.error({ error, userId, customerId }, 'Failed to update stripe_customer_id on profile');
    }
  }

  if (session.metadata?.type === 'credits') {
    const credits = parseInt(session.metadata.credits || '0', 10);
    const amountTotal = session.amount_total || 0;

    request.log.info(
      {
        sessionId: session.id,
        userId,
        credits,
        amount: amountTotal,
      },
      'Processing credit purchase webhook'
    );

    if (credits > 0) {
      const existingTx = await prisma.payment_transactions.findUnique({
        where: { stripe_session_id: session.id },
      });

      if (existingTx) {
        request.log.info({ sessionId: session.id }, 'Transaction already processed');
        return;
      }

      try {
        await prisma.$transaction(async (tx) => {
          try {
            await tx.payment_transactions.create({
              data: {
                user_id: userId,
                stripe_session_id: session.id,
                amount: amountTotal,
                currency: session.currency || 'usd',
                credits_amount: credits,
                status: 'completed',
                metadata: session.metadata || {},
              },
            });
          } catch (e) {
            if (isPrismaUniqueViolation(e)) {
              request.log.info({ sessionId: session.id }, 'Credit purchase row already created (race); skipping increment');
              return;
            }
            throw e;
          }

          await tx.profiles.update({
            where: { id: userId },
            data: {
              purchased_credits: { increment: credits },
              purchased_credits_seconds: { increment: credits * 60 },
            },
          });
        });
      } catch (e) {
        if (isPrismaUniqueViolation(e)) {
          request.log.info({ sessionId: session.id }, 'Credit purchase idempotent skip after race');
          return;
        }
        throw e;
      }

      request.log.info({ userId, credits }, 'Successfully added purchased credits');
    }
    return;
  }

  const planType = session.metadata?.planType;
  const billingCycle = session.metadata?.billing_cycle ?? session.metadata?.billingCycle;

  if (!planType) {
    console.warn('Missing planType in checkout session', session.id);
    return;
  }

  const subscriptionId = session.subscription as string;
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
    await addSubscriptionAllowanceMinutes(userId, planCredits);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const existingSub = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: subscription.id },
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
      await addSubscriptionAllowanceMinutes(existingSub.user_id, planCredits);
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
    where: { stripe_sub_id: subscription.id },
  });

  if (!existingSub) return;

  await prisma.subscriptions.update({
    where: { id: existingSub.id },
    data: {
      status: 'canceled',
      plan_type: 'trial',
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
    where: { stripe_sub_id: subscription.id },
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

      await addSubscriptionAllowanceMinutes(existingSub.user_id, planCredits);
    }
  }
}
