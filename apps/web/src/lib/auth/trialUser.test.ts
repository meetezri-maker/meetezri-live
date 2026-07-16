import { describe, expect, it } from 'vitest';
import { hasResolvableAccountType, isTrialUser, resolveAccountType } from './trialUser';

describe('isTrialUser', () => {
  it('treats an explicit trial signup as trial', () => {
    expect(isTrialUser({ signup_type: 'trial' })).toBe(true);
  });

  it('treats an explicit plan signup as paid', () => {
    expect(isTrialUser({ signup_type: 'plan' })).toBe(false);
  });

  it('falls back to the subscription for legacy rows with a null signup_type', () => {
    expect(isTrialUser({ signup_type: null, subscription_plan: 'trial' })).toBe(true);
  });

  it('does not classify a legacy paid subscription as trial', () => {
    expect(isTrialUser({ signup_type: undefined, subscription_plan: 'plan' })).toBe(false);
    expect(isTrialUser({ signup_type: undefined, subscription_plan: 'core' })).toBe(false);
    expect(isTrialUser({ signup_type: null, subscription_plan: 'pro' })).toBe(false);
  });

  it('never lets a trial subscription override an explicit plan signup', () => {
    // An expired paid package falls back to subscription_plan 'trial'. That user is
    // still a paid signup and must keep the paid onboarding/expiry behavior.
    expect(isTrialUser({ signup_type: 'plan', subscription_plan: 'trial' })).toBe(false);
  });

  it('keeps an explicit trial signup on a paid subscription as trial', () => {
    expect(isTrialUser({ signup_type: 'trial', subscription_plan: 'core' })).toBe(true);
  });

  it('is not trial when there is no profile at all', () => {
    expect(isTrialUser(null)).toBe(false);
    expect(isTrialUser(undefined)).toBe(false);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isTrialUser({ signup_type: ' Trial ' })).toBe(true);
    expect(isTrialUser({ signup_type: 'PLAN', subscription_plan: 'trial' })).toBe(false);
  });
});

describe('hasResolvableAccountType', () => {
  it('is false when no account-type evidence exists', () => {
    expect(hasResolvableAccountType(null)).toBe(false);
    expect(hasResolvableAccountType({})).toBe(false);
    expect(hasResolvableAccountType({ signup_type: null, subscription_plan: null })).toBe(false);
  });

  it('is true when either field carries evidence', () => {
    expect(hasResolvableAccountType({ signup_type: 'plan' })).toBe(true);
    expect(hasResolvableAccountType({ subscription_plan: 'trial' })).toBe(true);
  });
});

describe('resolveAccountType', () => {
  it('resolves explicit types', () => {
    expect(resolveAccountType({ signup_type: 'trial' })).toBe('trial');
    expect(resolveAccountType({ signup_type: 'plan' })).toBe('plan');
  });

  it('returns null rather than guessing when the profile has no evidence', () => {
    expect(resolveAccountType({})).toBeNull();
    expect(resolveAccountType(null)).toBeNull();
  });
});
