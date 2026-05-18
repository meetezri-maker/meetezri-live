/**
 * Monthly recurring revenue in USD from a Stripe Subscription object.
 * Normalizes yearly (and other) intervals to an approximate monthly amount.
 */
export function stripeSubscriptionMrrUsd(subscription: {
  items?: { data?: Array<{ price?: StripePriceLike | null }> };
}): number | null {
  const price = subscription?.items?.data?.[0]?.price as StripePriceLike | undefined;
  const unitAmount = price?.unit_amount;
  if (unitAmount == null || typeof unitAmount !== 'number') return null;

  const dollars = unitAmount / 100;
  const interval = price?.recurring?.interval;

  if (interval === 'year') return Math.round((dollars / 12) * 100) / 100;
  if (interval === 'month') return Math.round(dollars * 100) / 100;
  if (interval === 'week') return Math.round(dollars * 4.33 * 100) / 100;
  if (interval === 'day') return Math.round(dollars * 30 * 100) / 100;
  return Math.round(dollars * 100) / 100;
}

type StripePriceLike = {
  unit_amount?: number | null;
  recurring?: { interval?: string | null } | null;
};
