import { getAllSubscriptions } from './subscription.service';
import { listStripeInvoicesForAdmin } from './admin-stripe-list.service';
import {
  isPaygInvoice,
  loadProfilesByStripeCustomerIds,
  mapStripeInvoiceToAdminRow,
  mapStripeInvoiceToPaygRow,
} from './admin-billing-shared';

/**
 * One round-trip for admin billing UIs: subscriptions + Stripe-derived invoices + PAYG rows.
 * Uses a single Stripe invoices.list via listStripeInvoicesForAdmin (shared with other admin handlers).
 */
export async function getAdminBillingOverview() {
  const [subscriptions, stripeInvoices] = await Promise.all([
    getAllSubscriptions(1, 500),
    listStripeInvoicesForAdmin(),
  ]);

  const customerIds = Array.from(
    new Set(
      stripeInvoices
        .map((inv) => inv.customer)
        .filter((id): id is string => typeof id === 'string')
    )
  );

  const profileByCustomerId = await loadProfilesByStripeCustomerIds(customerIds);

  const invoices = stripeInvoices.map((inv) =>
    mapStripeInvoiceToAdminRow(inv, profileByCustomerId)
  );

  const paygTransactions = stripeInvoices
    .filter(isPaygInvoice)
    .map((inv) => mapStripeInvoiceToPaygRow(inv, profileByCustomerId));

  return {
    subscriptions,
    invoices,
    paygTransactions,
  };
}
