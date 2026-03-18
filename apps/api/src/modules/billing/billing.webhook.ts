import { FastifyRequest, FastifyReply } from 'fastify';
import { stripe } from '../../config/stripe';
import prisma from '../../lib/prisma';
import { STRIPE_PRICE_IDS, PLAN_LIMITS } from './billing.constants';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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

  // Update or create subscription in DB
  // We should find by user_id or create.
  // First, check if we already have this subscription tracked (idempotency)
  let existingSub = await prisma.subscriptions.findFirst({
      where: { stripe_sub_id: subscription.id }
  });

  if (!existingSub) {
      // If not, look for a user's subscription to upgrade (e.g. trial)
      existingSub = await prisma.subscriptions.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' }
      });
  }

  if (existingSub) {
      await prisma.subscriptions.update({
          where: { id: existingSub.id },
          data: {
              stripe_sub_id: subscription.id,
              status: subscription.status,
              plan_type: planType,
              start_date: new Date(subscription.current_period_start * 1000),
              end_date: new Date(subscription.current_period_end * 1000),
              next_billing_at: new Date(subscription.current_period_end * 1000),
          }
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
          }
      });
  }

  // Update credits based on plan
  let credits = 0;
  if (planType === 'core') credits = PLAN_LIMITS.core.credits;
  else if (planType === 'pro') credits = PLAN_LIMITS.pro.credits;
  else if (planType === 'trial') credits = PLAN_LIMITS.trial.credits;

  if (credits > 0) {
    await prisma.profiles.update({
      where: { id: userId },
      data: { credits }, 
    });
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const existingSub = await prisma.subscriptions.findFirst({
      where: { stripe_sub_id: subscription.id }
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
  if (invoice.billing_reason === 'subscription_create') {
    // Already handled by checkout.session.completed usually, or we can double check
    return;
  }

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

    // Renew credits
    // In a real app, you might check if credits should rollover or reset
    // Here we reset them based on the plan again
    let credits = 0;
    const planType = existingSub.plan_type;
    if (planType === 'core') credits = 200;
    else if (planType === 'pro') credits = 400;
    else if (planType === 'trial') credits = 30;

    if (credits > 0) {
      await prisma.profiles.update({
        where: { id: existingSub.user_id },
        data: { credits }, 
      });
    }
  }
}
