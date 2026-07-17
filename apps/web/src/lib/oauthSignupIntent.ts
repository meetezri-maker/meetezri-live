/**
 * Carries the account type a user chose on the signup page across the Google OAuth
 * redirect, so the profile the backend creates on return is not born with
 * `signup_type = null`.
 *
 * sessionStorage, deliberately: the OAuth redirect leaves the app entirely and destroys
 * React state, but sessionStorage survives a same-tab navigation to Google and back.
 * It is also per-tab and dies with the tab, which is what we want — this is a one-shot
 * handoff, not a stored user preference.
 *
 * This value is a *hint*. The server ranks it below the stored column and trusted auth
 * metadata (see signupType.ts), so it can populate a new or unresolved profile but can
 * never reclassify an established account.
 */

export type OAuthSignupIntent = 'trial' | 'plan';

const OAUTH_SIGNUP_INTENT_KEY = 'ezri_oauth_signup_intent';

/** Only these two values are ever stored or sent. */
function parseIntent(value: unknown): OAuthSignupIntent | null {
  return value === 'trial' || value === 'plan' ? value : null;
}

/**
 * Map the chosen product to an account type. `selectedPlan` holds product names
 * ('trial' | 'core' | 'pro'), which are NOT the same vocabulary as signup_type — passing
 * it through raw would send "core" to an API that only accepts trial|plan. Anything
 * unrecognised yields null (treated as no intent) rather than a guess.
 */
export function signupIntentFromSelectedPlan(
  selectedPlan: string | null | undefined,
): OAuthSignupIntent | null {
  const plan = String(selectedPlan ?? '').trim().toLowerCase();
  if (plan === 'trial') return 'trial';
  if (plan === 'core' || plan === 'pro') return 'plan';
  return null;
}

export function storeOAuthSignupIntent(intent: OAuthSignupIntent): void {
  try {
    sessionStorage.setItem(OAUTH_SIGNUP_INTENT_KEY, intent);
  } catch {
    // Ignore storage errors (private browsing, disabled storage). The server still
    // resolves the account type; it just loses this hint.
  }
}

/** The stored intent, or null when absent or not one of the two valid values. */
export function readOAuthSignupIntent(): OAuthSignupIntent | null {
  try {
    return parseIntent(sessionStorage.getItem(OAUTH_SIGNUP_INTENT_KEY));
  } catch {
    return null;
  }
}

export function clearOAuthSignupIntent(): void {
  try {
    sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
  } catch {
    // ignore
  }
}
