import { describe, expect, it } from 'vitest';
import { resolvePostAuthRoute } from './postAuthRoute';

describe('resolvePostAuthRoute', () => {
  it('sends a trial user to the dashboard', () => {
    expect(
      resolvePostAuthRoute({ signup_type: 'trial', onboarding_completed: false }),
    ).toBe('/app/dashboard');
  });

  it('sends a legacy trial user (null signup_type, trial subscription) to the dashboard', () => {
    expect(
      resolvePostAuthRoute({
        signup_type: null,
        subscription_plan: 'trial',
        onboarding_completed: false,
      }),
    ).toBe('/app/dashboard');
  });

  it('sends a paid user with completed onboarding to the dashboard', () => {
    expect(
      resolvePostAuthRoute({
        signup_type: 'plan',
        subscription_plan: 'core',
        onboarding_completed: true,
      }),
    ).toBe('/app/dashboard');
  });

  it('sends a paid user with incomplete onboarding to onboarding', () => {
    expect(
      resolvePostAuthRoute({
        signup_type: 'plan',
        subscription_plan: 'core',
        onboarding_completed: false,
      }),
    ).toBe('/onboarding/welcome');
  });

  it('keeps an expired paid package on the paid rules rather than treating it as trial', () => {
    expect(
      resolvePostAuthRoute({
        signup_type: 'plan',
        subscription_plan: 'trial',
        onboarding_completed: false,
      }),
    ).toBe('/onboarding/welcome');
  });

  it('reads needs_onboarding when onboarding_completed is absent', () => {
    expect(
      resolvePostAuthRoute({ signup_type: 'plan', needs_onboarding: true }),
    ).toBe('/onboarding/welcome');
    expect(
      resolvePostAuthRoute({ signup_type: 'plan', needs_onboarding: false }),
    ).toBe('/app/dashboard');
  });

  describe('unresolved data is never guessed', () => {
    it('returns null for a missing profile', () => {
      expect(resolvePostAuthRoute(null)).toBeNull();
      expect(resolvePostAuthRoute(undefined)).toBeNull();
    });

    it('returns null when the account type cannot be established', () => {
      expect(resolvePostAuthRoute({ onboarding_completed: false })).toBeNull();
      expect(
        resolvePostAuthRoute({ signup_type: null, subscription_plan: null }),
      ).toBeNull();
    });

    it('returns null for a paid user whose onboarding state is unknown', () => {
      expect(
        resolvePostAuthRoute({ signup_type: 'plan', onboarding_completed: null }),
      ).toBeNull();
      expect(resolvePostAuthRoute({ signup_type: 'plan' })).toBeNull();
    });

    it('never returns onboarding for an unresolved profile', () => {
      const unresolved = [
        null,
        undefined,
        {},
        { onboarding_completed: false },
        { signup_type: 'plan' },
      ];
      for (const profile of unresolved) {
        expect(resolvePostAuthRoute(profile)).not.toBe('/onboarding/welcome');
      }
    });
  });
});
