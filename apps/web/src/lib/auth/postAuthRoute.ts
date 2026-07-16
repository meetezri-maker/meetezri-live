/**
 * The single post-authentication destination rule.
 *
 * Pure: it decides *where* an authenticated user belongs and nothing else. It does
 * not exchange tokens, create sessions, verify email, create profiles, call the
 * API, or navigate. Callers (Login, VerifyEmail, Signup, AuthCallback) do that
 * work first and hand the authoritative profile in.
 *
 * Rules:
 *   trial                       → /app/dashboard
 *   plan + onboarding complete  → /app/dashboard
 *   plan + onboarding incomplete→ /onboarding/welcome
 *   anything unresolved         → null (wait for authoritative data; never guess)
 *
 * `ProtectedRoute` remains the enforcing guard; this helper only removes the need
 * for each auth page to invent its own destination.
 */
import { hasResolvableAccountType, isTrialUser, type TrialUserProfile } from './trialUser';

export const APP_DASHBOARD_ROUTE = '/app/dashboard';
export const PAID_ONBOARDING_START_ROUTE = '/onboarding/welcome';

export type PostAuthRoute = typeof APP_DASHBOARD_ROUTE | typeof PAID_ONBOARDING_START_ROUTE;

/** The subset of `GET /users/me` this module reads. */
export interface PostAuthProfile extends TrialUserProfile {
  onboarding_completed?: boolean | null;
  needs_onboarding?: boolean | null;
}

/**
 * Server-authoritative onboarding completion, or `null` when the profile does not
 * say. `GET /users/me` computes both fields; `onboarding_completed` is preferred
 * and `needs_onboarding` is its inverse.
 */
function resolveOnboardingCompleted(profile: PostAuthProfile): boolean | null {
  if (typeof profile.onboarding_completed === 'boolean') {
    return profile.onboarding_completed;
  }
  if (typeof profile.needs_onboarding === 'boolean') {
    return !profile.needs_onboarding;
  }
  return null;
}

/**
 * The route an authenticated user should land on, or `null` when the profile is
 * missing or too incomplete to classify. A `null` result means "wait for
 * authoritative data" — callers must not treat it as either trial or paid, and
 * must never fall back to onboarding.
 */
export function resolvePostAuthRoute(
  profile: PostAuthProfile | null | undefined,
): PostAuthRoute | null {
  if (!profile) return null;

  // A row with no account-type evidence at all is unresolved, not paid.
  if (!hasResolvableAccountType(profile)) return null;

  // Trial users never see onboarding — the business rule, stated once.
  if (isTrialUser(profile)) return APP_DASHBOARD_ROUTE;

  const onboardingCompleted = resolveOnboardingCompleted(profile);
  if (onboardingCompleted === null) return null;

  return onboardingCompleted ? APP_DASHBOARD_ROUTE : PAID_ONBOARDING_START_ROUTE;
}
