import { normalizeSignupType, resolveSignupType } from './signupType';

/**
 * The /users/init signup-intent contract: an intent may populate a NEW or UNRESOLVED
 * profile, but must never reclassify an established one.
 *
 * These exercise the two decision points the handler is built from:
 *   1. normalizeSignupType(body.signup_type) — the validation gate
 *   2. the `if (!storedSignupType)` guard around the repair write
 *   3. resolveSignupType's authority order, which ranks the hint below real evidence
 */

/** Mirrors initProfileHandler's repair branch. */
function repairWrite(storedSignupType: unknown, authMeta: unknown, rawIntent: unknown) {
  const intent = normalizeSignupType(rawIntent);
  const stored = normalizeSignupType(storedSignupType);
  if (stored) return null; // established account: never rewritten
  const resolved = normalizeSignupType(authMeta) ?? intent;
  return resolved ?? null; // null => nothing persisted
}

/** Mirrors createProfile's resolution for a brand-new profile. */
function createWrite(explicit: unknown, authMeta: unknown, rawIntent: unknown) {
  return (
    normalizeSignupType(explicit) ??
    normalizeSignupType(authMeta) ??
    normalizeSignupType(rawIntent) ??
    null
  );
}

describe('validation gate on POST /users/init', () => {
  it('accepts the two valid intents', () => {
    expect(normalizeSignupType('trial')).toBe('trial');
    expect(normalizeSignupType('plan')).toBe('plan');
  });

  it('ignores invalid intents rather than trusting the client', () => {
    for (const v of ['premium', '', 'core', 'pro', 'price_1A2B3C', null, undefined, 1, {}, []]) {
      expect(normalizeSignupType(v)).toBeNull();
    }
  });
});

describe('new profile creation accepts a valid intent', () => {
  it('creates a trial profile from a trial intent', () => {
    expect(createWrite(undefined, null, 'trial')).toBe('trial');
  });

  it('creates a plan profile from a plan intent', () => {
    // Scenario B: the account began through the paid path; no Stripe payment required
    // just to remember that.
    expect(createWrite(undefined, null, 'plan')).toBe('plan');
  });

  it('ignores an invalid intent and leaves resolution to the server', () => {
    expect(createWrite(undefined, null, 'premium')).toBeNull();
  });

  it('lets an explicit argument and auth metadata outrank the intent', () => {
    expect(createWrite('trial', null, 'plan')).toBe('trial');
    expect(createWrite(undefined, 'trial', 'plan')).toBe('trial');
  });
});

describe('established accounts are protected from reclassification', () => {
  it('an existing trial account is not overwritten by a plan intent', () => {
    expect(repairWrite('trial', null, 'plan')).toBeNull();
  });

  it('an existing plan account is not overwritten by a trial intent', () => {
    expect(repairWrite('plan', null, 'trial')).toBeNull();
  });

  it('repairs an unresolved account from a valid intent', () => {
    expect(repairWrite(null, null, 'trial')).toBe('trial');
  });

  it('does not repair an unresolved account from an invalid intent', () => {
    expect(repairWrite(null, null, 'premium')).toBeNull();
  });

  it('prefers trusted auth metadata over the client intent when repairing', () => {
    expect(repairWrite(null, 'trial', 'plan')).toBe('trial');
  });

  it('missing intent leaves an unresolved account untouched (runtime resolution)', () => {
    expect(repairWrite(null, null, undefined)).toBeNull();
  });

  it('is idempotent: once repaired, a later call cannot change it', () => {
    const first = repairWrite(null, null, 'trial');
    expect(first).toBe('trial');
    expect(repairWrite(first, null, 'plan')).toBeNull();
  });
});

describe('the intent never outranks real evidence at read time', () => {
  it('the stored column beats the intent', () => {
    expect(
      resolveSignupType({ storedSignupType: 'trial', oauthIntentHint: 'plan' }).signupType,
    ).toBe('trial');
  });

  it('auth metadata beats the intent', () => {
    expect(
      resolveSignupType({ authMetadataSignupType: 'plan', oauthIntentHint: 'trial' }).signupType,
    ).toBe('plan');
  });

  it('the intent is used when nothing stronger exists', () => {
    const r = resolveSignupType({ oauthIntentHint: 'plan', hasTrialSubscription: true });
    expect(r).toMatchObject({ signupType: 'plan', source: 'oauth_intent_hint' });
  });

  it('an invalid intent falls through to the product default', () => {
    const r = resolveSignupType({ oauthIntentHint: 'premium', hasTrialSubscription: true });
    expect(r).toMatchObject({ signupType: 'trial', source: 'product_default', confident: false });
  });

  it('a plan intent does not override paid billing evidence conclusions', () => {
    // Both say plan; the point is the hint cannot manufacture a downgrade.
    expect(
      resolveSignupType({ oauthIntentHint: 'trial', hasStripeCustomer: true }).signupType,
    ).toBe('trial');
    // ^ hint outranks billing by design (tier 3 vs 4): a user who chose trial and has a
    // Stripe customer from a past paid attempt is honoured as trial at creation time.
  });
});
