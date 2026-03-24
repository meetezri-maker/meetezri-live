import { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { stripe } from '../../config/stripe';
import prisma from '../../lib/prisma';
import { PLAN_LIMITS } from './billing.constants';

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
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as any);
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

  let existingSub = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: subscription.id },
  });

  if (!existingSub) {
    existingSub = await prisma.subscriptions.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  if (existingSub) {
    await prisma.subscriptions.update({
      where: { id: existingSub.id },
      data: {
        stripe_sub_id: subscription.id,
        status: subscription.status,
        plan_type: planType,
        ...(billingCycle ? { billing_cycle: billingCycle } : {}),
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
        ...(billingCycle ? { billing_cycle: billingCycle } : {}),
        start_date: new Date(subscription.current_period_start * 1000),
        end_date: new Date(subscription.current_period_end * 1000),
        next_billing_at: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  let credits = 0;
  if (planType === 'core') credits = PLAN_LIMITS.core.credits;
  else if (planType === 'pro') credits = PLAN_LIMITS.pro.credits;
  else if (planType === 'trial') credits = PLAN_LIMITS.trial.credits;

  if (credits > 0) {
    await prisma.profiles.update({
      where: { id: userId },
      data: {
        credits,
        credits_seconds: credits * 60,
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const existingSub = await prisma.subscriptions.findFirst({
    where: { stripe_sub_id: subscription.id },
  });

  if (!existingSub) return;

  await prisma.subscriptions.update({
    where: { id: existingSub.id },
    data: {
      status: subscription.status,
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

async function handleInvoicePaymentSucceeded(invoice: any) {
  if (invoice.billing_reason === 'subscription_create') {
    return;
  }

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

    let credits = 0;
    const planType = existingSub.plan_type;
    if (planType === 'core') credits = 200;
    else if (planType === 'pro') credits = 400;
    else if (planType === 'trial') credits = 30;

    if (credits > 0) {
      await prisma.profiles.update({
        where: { id: existingSub.user_id },
        data: {
          credits,
          credits_seconds: credits * 60,
        },
      });
    }
  }
}
