import { getAllSubscriptions } from './subscription.service';
import { listStripeInvoicesForAdmin } from './admin-stripe-list.service';
import { loadProfilesByStripeCustomerIds, mapStripeInvoiceToAdminRow } from './admin-billing-shared';
import { getAllPaygTransactions } from './payg.service';

/**
 * Subscriptions (DB) + invoices (Stripe) + PAYG rows (`payment_transactions` DB).
 * Stripe + DB run in parallel; PAYG no longer depends on Stripe invoice guessing.
 */
export async function getAdminBillingOverview() {
  const [subscriptions, stripeInvoices, paygTransactions] = await Promise.all([
    getAllSubscriptions(1, 500),
    listStripeInvoicesForAdmin(),
    getAllPaygTransactions(),
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

  return {
    subscriptions,
    invoices,
    paygTransactions,
  };
}
