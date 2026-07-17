/**
 * The single server-side authority for account classification.
 *
 * Two facts the client routes on, decided here and nowhere else:
 *   signup_type      — did this account start as a trial or a paid plan?
 *   needs_onboarding — must this account complete the onboarding wizard?
 *
 * Why this exists: `profiles.signup_type` is nullable and was only ever written
 * reliably on the email/password trial path, so Google OAuth and several legacy paths
 * left it null. Callers then disagreed — some read null as "plan", others inferred
 * "trial" from `subscription_plan`. This module makes that decision once.
 *
 * The load-bearing subtlety: `createProfile()` gives EVERY new profile a 7-day trial
 * subscription, so a trial subscription is NOT evidence of a trial signup. It is only
 * consulted as a last-resort default, and it may never override explicit evidence.
 */

export type SignupType = 'trial' | 'plan';

export type SignupTypeSource =
  | 'profile_column'
  | 'auth_metadata'
  | 'oauth_intent_hint'
  | 'stripe_customer'
  | 'paid_subscription'
  | 'product_default';

export interface SignupTypeEvidence {
  /** profiles.signup_type — the stored answer, if any. */
  storedSignupType?: unknown;
  /** auth.users.raw_user_meta_data.signup_type — written by the client at signup. */
  authMetadataSignupType?: unknown;
  /**
   * Intent captured when the profile is created (e.g. the flow an OAuth user started
   * from). Client-supplied, so it ranks below billing evidence and is only ever used
   * when nothing stronger exists. See resolveSignupType for why that is safe.
   */
  oauthIntentHint?: unknown;
  /** profiles.stripe_customer_id — the user reached Stripe. */
  hasStripeCustomer?: boolean;
  /** A core/pro subscription exists in any state. */
  hasPaidSubscription?: boolean;
  /** A trial subscription exists. NOT evidence of trial signup - every profile gets one. */
  hasTrialSubscription?: boolean;
}

export interface SignupTypeResolution {
  signupType: SignupType;
  source: SignupTypeSource;
  /**
   * False when we fell through to the product default with no real evidence. The API
   * still returns a concrete value (the contract is non-null), but an unconfident
   * result must never be persisted as if it were known.
   */
  confident: boolean;
}

/** The profile fields the evidence builder reads. */
export interface SignupTypeProfileLike {
  signup_type?: unknown;
  /** plan_type of the newest active subscription ('trial' | 'core' | 'pro'). */
  subscription_plan?: unknown;
  stripe_customer_id?: unknown;
}

const PAID_PLAN_TYPES = new Set(['core', 'pro']);

/**
 * Map a profile row + auth metadata onto evidence. Every consumer must build evidence
 * through this one function: if two callers map the same row differently they will reach
 * different conclusions, which is exactly the class of bug this module exists to end.
 *
 * Callers are responsible for supplying the same *inputs* — in particular
 * `subscription_plan` (newest subscription with status active/trialing/past_due) and
 * `stripe_customer_id`. Omitting them silently downgrades a paid account to the trial
 * default.
 */
export function buildSignupTypeEvidence(
  profile: SignupTypeProfileLike | null | undefined,
  authMeta?: Record<string, any> | null,
  intentHint?: unknown
): SignupTypeEvidence {
  const plan = String(profile?.subscription_plan ?? '').toLowerCase();
  return {
    storedSignupType: profile?.signup_type,
    authMetadataSignupType:
      authMeta?.signup_type ?? authMeta?.signupType ?? authMeta?.signup ?? null,
    oauthIntentHint: intentHint ?? null,
    hasStripeCustomer: !!profile?.stripe_customer_id,
    hasPaidSubscription: PAID_PLAN_TYPES.has(plan),
    hasTrialSubscription: plan === 'trial',
  };
}

export function normalizeSignupType(raw: unknown): SignupType | null {
  if (raw === 'trial' || raw === 'plan') return raw;
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v === 'trial' || v === 'plan' ? v : null;
}

/**
 * Resolve signup_type from the strongest available evidence.
 *
 * Order, strongest first:
 *   1. profiles.signup_type          — explicit and already stored; always wins
 *   2. auth metadata signup_type     — written at signup by a trusted client path
 *   3. OAuth intent hint             — the flow the user actually started from
 *   4. stripe_customer_id            — they reached Stripe, so they are a paid signup
 *   5. core/pro subscription         — paid subscription in any state
 *   6. product default: trial        — no evidence; trial is the safe self-serve default
 *
 * Guarantees:
 *   - An explicit `plan` is NEVER downgraded by a trial subscription (steps 1-2 return
 *     first, and no later step can run).
 *   - An explicit `trial` is never upgraded here. Billing contradiction is reported via
 *     `detectSignupTypeConflict` for logging rather than silently "corrected", because
 *     correcting it would change a live user's product experience.
 *   - A trial subscription alone never produces a *confident* answer.
 */
export function resolveSignupType(evidence: SignupTypeEvidence): SignupTypeResolution {
  const stored = normalizeSignupType(evidence.storedSignupType);
  if (stored) return { signupType: stored, source: 'profile_column', confident: true };

  const fromMeta = normalizeSignupType(evidence.authMetadataSignupType);
  if (fromMeta) return { signupType: fromMeta, source: 'auth_metadata', confident: true };

  const fromHint = normalizeSignupType(evidence.oauthIntentHint);
  if (fromHint) return { signupType: fromHint, source: 'oauth_intent_hint', confident: true };

  // Billing evidence: only a paid signup ever reaches Stripe or holds a core/pro plan.
  if (evidence.hasStripeCustomer) {
    return { signupType: 'plan', source: 'stripe_customer', confident: true };
  }
  if (evidence.hasPaidSubscription) {
    return { signupType: 'plan', source: 'paid_subscription', confident: true };
  }

  // Nothing left but the auto-created trial subscription, which proves nothing.
  return { signupType: 'trial', source: 'product_default', confident: false };
}

/**
 * True when the stored classification is contradicted by billing evidence. Reported for
 * logging only — this module never silently rewrites a user's account type.
 */
export function detectSignupTypeConflict(evidence: SignupTypeEvidence): string | null {
  const stored = normalizeSignupType(evidence.storedSignupType);
  if (!stored) return null;
  if (stored === 'trial' && (evidence.hasStripeCustomer || evidence.hasPaidSubscription)) {
    return 'stored_trial_with_paid_billing_evidence';
  }
  return null;
}

/**
 * Must this account complete the onboarding wizard?
 *
 * Trial accounts are onboarding-exempt by product rule — unconditionally, and without
 * having to fill in any profile field. This is deliberately NOT derived from
 * `onboarding_completed`: that flag answers a different question ("has this profile's
 * setup been finished?") and is left untouched so the dashboard/profile checklists keep
 * working. Keeping the two separate is why trial users are exempt without us having to
 * fake completion.
 */
export function resolveNeedsOnboarding(
  signupType: SignupType,
  onboardingCompleted: boolean
): boolean {
  if (signupType === 'trial') return false;
  return !onboardingCompleted;
}
