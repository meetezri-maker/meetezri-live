/**
 * Calls to action on the public homepage, wired to the flows that already exist:
 *
 *  - Free Trial → the existing signup flow, with the `selectedPlan` handoff signup reads.
 *  - Grow / Thrive → the existing guest Stripe checkout, returning to signup on success and
 *    to the homepage pricing section on cancel (unchanged from the previous homepage).
 *  - "Early Access" / "Become a Founding Member" → the existing Founding Circle page, which
 *    owns the registration form.
 *
 * Analytics go through the shared marketing facade; page views stay with the existing
 * route tracking.
 */
import { trackMarketingEvent } from "@/app/analytics";
import { PRELAUNCH_ROUTE } from "@/app/features/prelaunch/prelaunch.content";
import type { PlanTier } from "@/app/utils/subscriptionPlans";

export const EARLY_ACCESS_PATH = PRELAUNCH_ROUTE;
export const SIGNUP_PATH = "/signup";
export const LOGIN_PATH = "/login";

export type PaidPlanTier = Exclude<PlanTier, "trial">;

export function rememberSelectedPlan(planId: PlanTier): void {
  try {
    localStorage.setItem("selectedPlan", planId);
  } catch {
    /* Storage can be unavailable (private mode); signup falls back to its default plan. */
  }
}

export function trackEarlyAccessClick(origin: string): void {
  trackMarketingEvent("early_access_cta_click", { origin });
}

export function trackPricingClick(planId: PlanTier): void {
  trackMarketingEvent("pricing_cta_click", { origin: "home_pricing", plan_tier: planId });
}

/** Starts the existing guest checkout and returns the Stripe URL to redirect to. */
export async function createGuestCheckoutUrl(planId: PaidPlanTier): Promise<string> {
  const origin = window.location.origin;
  const successUrl = `${origin}/signup?postCheckout=1&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/#pricing`;
  const { api } = await import("@/lib/api");
  const result = await api.billing.createGuestSubscription({
    plan_type: planId,
    billing_cycle: "monthly",
    successUrl,
    cancelUrl,
  });
  if (!result?.checkoutUrl) throw new Error("Checkout did not return a URL");
  trackMarketingEvent("checkout_started", { origin: "home_pricing", plan_tier: planId, checkout_type: "guest" });
  return result.checkoutUrl;
}
