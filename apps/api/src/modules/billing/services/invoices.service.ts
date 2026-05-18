import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';
import { userInvoicesCache, USER_INVOICES_TTL } from '../billing.cache';
import { listStripeInvoicesForAdmin } from './admin-stripe-list.service';
import { loadProfilesByStripeCustomerIds, mapStripeInvoiceToAdminRow } from './admin-billing-shared';

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
  const invoices = await listStripeInvoicesForAdmin();

  const customerIds = Array.from(
    new Set(
      invoices.map((invoice) => invoice.customer).filter((id): id is string => typeof id === 'string')
    )
  );

  const profileByCustomerId = await loadProfilesByStripeCustomerIds(customerIds);

  return invoices.map((invoice) => mapStripeInvoiceToAdminRow(invoice, profileByCustomerId));
}

