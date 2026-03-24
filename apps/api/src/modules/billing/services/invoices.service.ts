import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import {
  allInvoicesCache,
  userInvoicesCache,
  USER_INVOICES_TTL,
  BILLING_CACHE_TTL,
  setAllInvoicesCache,
} from '../billing.cache';

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
  });

  const result = invoices.data.map((invoice) => ({
    id: invoice.id,
    status: invoice.status,
    amount_due: (invoice.amount_due || 0) / 100,
    currency: invoice.currency,
    created: new Date(invoice.created * 1000).toISOString(),
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf: invoice.invoice_pdf || null,
    description: invoice.description || null,
  }));

  userInvoicesCache.set(userId, { data: result, timestamp: now });
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
    new Set(
      invoices.data.map((invoice) => invoice.customer).filter((id): id is string => typeof id === 'string')
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

  // Mutate module-level cache
  setAllInvoicesCache({ data: result, timestamp: now });
  return result;
}

