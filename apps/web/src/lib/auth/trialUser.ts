/**
 * Trial account identity — the single client-side answer to "did this user sign up
 * for a trial?".
 *
 * This is deliberately distinct from `isTrialPlanUser` in
 * `@/lib/onboarding/paidOnboardingSteps`, which answers a different question:
 * "is this user currently on a trial-tier subscription?". The two disagree for a
 * paid user whose package has expired (`signup_type: 'plan'` +
 * `subscription_plan: 'trial'`): they are NOT a trial signup (this predicate), but
 * they ARE on the trial tier for feature-gating purposes (that predicate).
 *
 * Explicit `signup_type` always wins. `subscription_plan` is only consulted for
 * legacy rows where `signup_type` was never written, because `createProfile()`
 * gives every new profile a 7-day trial subscription — so a trial subscription on
 * its own is not evidence of a trial signup.
 */

/** The subset of `GET /users/me` this module reads. */
export interface TrialUserProfile {
  signup_type?: string | null;
  subscription_plan?: string | null;
}

export type AccountType = 'trial' | 'plan';

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isTrialUser(profile: TrialUserProfile | null | undefined): boolean {
  if (!profile) return false;

  const signupType = normalize(profile.signup_type);
  if (signupType === 'trial') return true;
  if (signupType === 'plan') return false;

  // Legacy fallback: signup_type was never written for this row.
  return normalize(profile.subscription_plan) === 'trial';
}

/**
 * True when the account type can be established from the profile at all. A row
 * with neither `signup_type` nor `subscription_plan` is unresolved, not paid.
 */
export function hasResolvableAccountType(
  profile: TrialUserProfile | null | undefined,
): boolean {
  if (!profile) return false;
  return normalize(profile.signup_type) !== '' || normalize(profile.subscription_plan) !== '';
}

export function resolveAccountType(
  profile: TrialUserProfile | null | undefined,
): AccountType | null {
  if (!hasResolvableAccountType(profile)) return null;
  return isTrialUser(profile) ? 'trial' : 'plan';
}
