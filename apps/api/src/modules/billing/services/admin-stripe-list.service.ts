import type Stripe from 'stripe';
import { stripe } from '../../../config/stripe';

/** Short TTL: admin UIs need fresh numbers without duplicate Stripe round-trips. */
const ADMIN_STRIPE_INVOICE_LIST_TTL_MS = 45 * 1000;

let rawCache: { data: Stripe.Invoice[]; timestamp: number } | null = null;
let inflight: Promise<Stripe.Invoice[]> | null = null;

/**
 * Fetches up to 100 recent invoices from Stripe, with in-flight deduplication and a short TTL
 * so parallel admin calls (invoices + PAYG) share one Stripe request.
 */
export async function listStripeInvoicesForAdmin(): Promise<Stripe.Invoice[]> {
  const now = Date.now();
  if (rawCache && now - rawCache.timestamp < ADMIN_STRIPE_INVOICE_LIST_TTL_MS) {
    return rawCache.data;
  }

  if (!inflight) {
    inflight = stripe.invoices
      .list({ limit: 100 })
      .then((res) => {
        rawCache = { data: res.data, timestamp: Date.now() };
        return res.data;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}
