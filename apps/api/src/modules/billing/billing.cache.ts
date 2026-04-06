// Centralized in-memory billing caches used by multiple billing sub-services.
// These are intentionally shared across modules within the same Node process.

export const BILLING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const USER_INVOICES_TTL = 30 * 1000; // 30 seconds
export const SUBSCRIPTIONS_CACHE_TTL = 30 * 1000; // 30 seconds

export const userInvoicesCache = new Map<string, { data: any[]; timestamp: number }>();
export const subscriptionsCache = new Map<string, { data: any[]; timestamp: number }>();

export function clearSubscriptionsCache() {
  subscriptionsCache.clear();
}

