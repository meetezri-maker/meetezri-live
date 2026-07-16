import {
  detectSignupTypeConflict,
  normalizeSignupType,
  resolveNeedsOnboarding,
  resolveSignupType,
} from './signupType';

describe('resolveSignupType', () => {
  it('uses an explicit stored trial', () => {
    const r = resolveSignupType({ storedSignupType: 'trial' });
    expect(r).toMatchObject({ signupType: 'trial', source: 'profile_column', confident: true });
  });

  it('uses an explicit stored plan', () => {
    const r = resolveSignupType({ storedSignupType: 'plan' });
    expect(r).toMatchObject({ signupType: 'plan', source: 'profile_column', confident: true });
  });

  it('never lets a trial subscription downgrade an explicit plan', () => {
    // Every profile is created with a trial subscription, and an expired paid package
    // also reports subscription_plan = trial. Neither may reclassify the account.
    const r = resolveSignupType({ storedSignupType: 'plan', hasTrialSubscription: true });
    expect(r.signupType).toBe('plan');
  });

  it('falls back to trusted auth metadata when the column is empty', () => {
    const r = resolveSignupType({ storedSignupType: null, authMetadataSignupType: 'trial' });
    expect(r).toMatchObject({ signupType: 'trial', source: 'auth_metadata', confident: true });
  });

  it('prefers the stored column over auth metadata', () => {
    const r = resolveSignupType({ storedSignupType: 'plan', authMetadataSignupType: 'trial' });
    expect(r).toMatchObject({ signupType: 'plan', source: 'profile_column' });
  });

  it('uses the OAuth intent hint when nothing stronger exists', () => {
    const r = resolveSignupType({ oauthIntentHint: 'plan', hasTrialSubscription: true });
    expect(r).toMatchObject({ signupType: 'plan', source: 'oauth_intent_hint', confident: true });
  });

  it('does not let an intent hint override stored or metadata evidence', () => {
    expect(resolveSignupType({ storedSignupType: 'trial', oauthIntentHint: 'plan' }).signupType)
      .toBe('trial');
    expect(
      resolveSignupType({ authMetadataSignupType: 'trial', oauthIntentHint: 'plan' }).signupType,
    ).toBe('trial');
  });

  it('classifies a Stripe customer as paid', () => {
    const r = resolveSignupType({ hasStripeCustomer: true, hasTrialSubscription: true });
    expect(r).toMatchObject({ signupType: 'plan', source: 'stripe_customer', confident: true });
  });

  it('classifies an active paid subscription as paid', () => {
    const r = resolveSignupType({ hasPaidSubscription: true });
    expect(r).toMatchObject({ signupType: 'plan', source: 'paid_subscription', confident: true });
  });

  it('treats a trial-subscription-only account as an unconfident trial default', () => {
    // The documented safe rule: createProfile() gives everyone a trial subscription, so
    // it proves nothing. We answer 'trial' (product default) but flag it as unconfident.
    const r = resolveSignupType({ hasTrialSubscription: true });
    expect(r).toMatchObject({ signupType: 'trial', source: 'product_default', confident: false });
  });

  it('never classifies a null signup_type as paid on its own', () => {
    const r = resolveSignupType({ storedSignupType: null });
    expect(r.signupType).toBe('trial');
    expect(r.confident).toBe(false);
  });

  it('ignores junk values', () => {
    const r = resolveSignupType({ storedSignupType: 'nonsense', hasStripeCustomer: true });
    expect(r).toMatchObject({ signupType: 'plan', source: 'stripe_customer' });
  });
});

describe('detectSignupTypeConflict', () => {
  it('flags a stored trial that has paid billing evidence', () => {
    expect(detectSignupTypeConflict({ storedSignupType: 'trial', hasStripeCustomer: true }))
      .toBe('stored_trial_with_paid_billing_evidence');
  });

  it('does not flag a plan on a trial subscription', () => {
    expect(detectSignupTypeConflict({ storedSignupType: 'plan', hasTrialSubscription: true }))
      .toBeNull();
  });

  it('does not flag an unresolved row', () => {
    expect(detectSignupTypeConflict({ storedSignupType: null })).toBeNull();
  });
});

describe('resolveNeedsOnboarding', () => {
  it('exempts trial users unconditionally', () => {
    expect(resolveNeedsOnboarding('trial', false)).toBe(false);
    expect(resolveNeedsOnboarding('trial', true)).toBe(false);
  });

  it('requires onboarding for an incomplete paid user', () => {
    expect(resolveNeedsOnboarding('plan', false)).toBe(true);
  });

  it('does not require onboarding for a completed paid user', () => {
    expect(resolveNeedsOnboarding('plan', true)).toBe(false);
  });
});

describe('normalizeSignupType', () => {
  it('accepts the two valid values, case/whitespace insensitively', () => {
    expect(normalizeSignupType('trial')).toBe('trial');
    expect(normalizeSignupType(' PLAN ')).toBe('plan');
  });

  it('rejects everything else', () => {
    for (const v of [null, undefined, '', 'core', 'pro', 1, {}, []]) {
      expect(normalizeSignupType(v)).toBeNull();
    }
  });
});

describe('the /users/me contract', () => {
  // The two facts the client routes on, exactly as GET /users/me composes them.
  const contract = (evidence: Parameters<typeof resolveSignupType>[0], completed: boolean) => {
    const { signupType } = resolveSignupType(evidence);
    return { signup_type: signupType, needs_onboarding: resolveNeedsOnboarding(signupType, completed) };
  };

  it('explicit trial => trial / not onboarding', () => {
    expect(contract({ storedSignupType: 'trial' }, false))
      .toEqual({ signup_type: 'trial', needs_onboarding: false });
  });

  it('trial with no onboarding fields filled in is still exempt', () => {
    // 109 of 114 live trial rows are missing the fields the old inference required.
    expect(contract({ storedSignupType: 'trial' }, false).needs_onboarding).toBe(false);
  });

  it('explicit plan + incomplete => plan / needs onboarding', () => {
    expect(contract({ storedSignupType: 'plan' }, false))
      .toEqual({ signup_type: 'plan', needs_onboarding: true });
  });

  it('explicit plan + complete => plan / no onboarding', () => {
    expect(contract({ storedSignupType: 'plan' }, true))
      .toEqual({ signup_type: 'plan', needs_onboarding: false });
  });

  it('legacy null + trial subscription => trial / not onboarding', () => {
    expect(contract({ storedSignupType: null, hasTrialSubscription: true }, false))
      .toEqual({ signup_type: 'trial', needs_onboarding: false });
  });

  it('legacy null + paid billing evidence => plan / needs onboarding', () => {
    expect(contract({ storedSignupType: null, hasStripeCustomer: true }, false))
      .toEqual({ signup_type: 'plan', needs_onboarding: true });
  });

  it('never returns a null signup_type', () => {
    const cases = [{}, { storedSignupType: null }, { storedSignupType: 'garbage' }];
    for (const c of cases) {
      expect(['trial', 'plan']).toContain(contract(c, false).signup_type);
    }
  });
});
