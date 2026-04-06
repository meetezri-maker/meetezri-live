import type Stripe from 'stripe';
import prisma from '../../../lib/prisma';

export function isPaygInvoice(invoice: Stripe.Invoice): boolean {
  const isCreditsInvoice = invoice.lines.data.some(
    (line) =>
      line.price?.metadata?.type === 'credits' || line.metadata?.type === 'credits'
  );
  const isCreditsMetadata = invoice.metadata?.type === 'credits';
  return isCreditsInvoice || isCreditsMetadata;
}

export async function loadProfilesByStripeCustomerIds(
  customerIds: string[]
): Promise<Map<string, { id: string; email: string | null; full_name: string | null; stripe_customer_id: string | null }>> {
  if (customerIds.length === 0) {
    return new Map();
  }

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

  const map = new Map<string, (typeof profiles)[number]>();
  for (const profile of profiles) {
    if (profile.stripe_customer_id) {
      map.set(profile.stripe_customer_id, profile);
    }
  }
  return map;
}

export function mapStripeInvoiceToAdminRow(
  invoice: Stripe.Invoice,
  profileByCustomerId: Map<
    string,
    { id: string; email: string | null; full_name: string | null; stripe_customer_id: string | null }
  >
) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  const profile = customerId ? profileByCustomerId.get(customerId) : undefined;

  const amountUsd =
    (invoice.amount_paid || invoice.amount_due || 0) / 100;

  return {
    id: invoice.id,
    status: invoice.status,
    amount_due: amountUsd,
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
}

export function mapStripeInvoiceToPaygRow(
  invoice: Stripe.Invoice,
  profileByCustomerId: Map<
    string,
    { id: string; email: string | null; full_name: string | null; stripe_customer_id: string | null }
  >
) {
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
}
