import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOAuthSignupIntent,
  readOAuthSignupIntent,
  signupIntentFromSelectedPlan,
  storeOAuthSignupIntent,
} from './oauthSignupIntent';

beforeEach(() => {
  sessionStorage.clear();
});

describe('signupIntentFromSelectedPlan', () => {
  it('maps the trial product to a trial signup', () => {
    expect(signupIntentFromSelectedPlan('trial')).toBe('trial');
  });

  it('maps paid products to a plan signup', () => {
    expect(signupIntentFromSelectedPlan('core')).toBe('plan');
    expect(signupIntentFromSelectedPlan('pro')).toBe('plan');
  });

  it('ignores case and whitespace', () => {
    expect(signupIntentFromSelectedPlan(' Trial ')).toBe('trial');
    expect(signupIntentFromSelectedPlan('PRO')).toBe('plan');
  });

  it('returns null for anything it does not recognise rather than guessing', () => {
    // selectedPlan is a product vocabulary; unknown entries must not become "plan".
    for (const v of [null, undefined, '', 'premium', 'price_1A2B3C', '{}', 'enterprise']) {
      expect(signupIntentFromSelectedPlan(v)).toBeNull();
    }
  });
});

describe('storeOAuthSignupIntent / readOAuthSignupIntent', () => {
  it('round-trips a trial intent', () => {
    storeOAuthSignupIntent('trial');
    expect(readOAuthSignupIntent()).toBe('trial');
  });

  it('round-trips a plan intent', () => {
    storeOAuthSignupIntent('plan');
    expect(readOAuthSignupIntent()).toBe('plan');
  });

  it('survives a simulated redirect away and back (sessionStorage persists)', () => {
    storeOAuthSignupIntent('plan');
    // React state would be gone here; the store is all that remains.
    expect(readOAuthSignupIntent()).toBe('plan');
  });

  it('returns null when nothing is stored', () => {
    expect(readOAuthSignupIntent()).toBeNull();
  });

  it('treats an invalid stored value as missing intent', () => {
    sessionStorage.setItem('ezri_oauth_signup_intent', 'premium');
    expect(readOAuthSignupIntent()).toBeNull();
  });

  it('treats an empty stored value as missing intent', () => {
    sessionStorage.setItem('ezri_oauth_signup_intent', '');
    expect(readOAuthSignupIntent()).toBeNull();
  });
});

describe('clearOAuthSignupIntent', () => {
  it('removes a stored intent', () => {
    storeOAuthSignupIntent('trial');
    clearOAuthSignupIntent();
    expect(readOAuthSignupIntent()).toBeNull();
  });

  it('is safe to call when nothing is stored', () => {
    expect(() => clearOAuthSignupIntent()).not.toThrow();
  });
});
