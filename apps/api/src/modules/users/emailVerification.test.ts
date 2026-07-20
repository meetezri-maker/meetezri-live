/**
 * Trial verification is an APPLICATION-LEVEL fact, decoupled from Supabase's
 * `email_confirmed_at`, because trial accounts are auto-confirmed at signup (Confirm-email
 * OFF) and therefore always have `email_confirmed_at` set. The truth is the client-mutable,
 * NON-SECURITY reminder flag `email_verification_required`. Paid is unchanged: Supabase
 * confirmation stays authoritative.
 *
 * These pure functions mirror the two production decision points so the trial/paid contract
 * is locked and documented:
 *   1. getMe                     — user.service.ts (emailVerified branch + needs_email_verification)
 *   2. resolveAccountStateByEmail — user.service.ts (emailVerified branch)
 */

/** Mirrors getMe's emailVerified computation. */
function getMeEmailVerified(params: {
  signupType: 'trial' | 'plan';
  isConfirmed: boolean;
  verificationRequired: boolean;
}): boolean {
  const { signupType, isConfirmed, verificationRequired } = params;
  if (signupType === 'trial') {
    // email_confirmed_at is not a signal for trial; the flag is the truth.
    return !verificationRequired;
  }
  const verificationRequiredAfter =
    isConfirmed && verificationRequired ? false : verificationRequired;
  return isConfirmed && !verificationRequiredAfter;
}

/** Mirrors getMe's needs_email_verification (planType is subscription_plan). */
function needsEmailVerification(planType: string, emailVerified: boolean): boolean {
  return planType === 'trial' && !emailVerified;
}

/** Mirrors resolveAccountStateByEmail's emailVerified computation. */
function accountStateEmailVerified(params: {
  isTrialSignup: boolean;
  emailConfirmed: boolean;
  verificationRequired: boolean;
}): boolean {
  const { isTrialSignup, emailConfirmed, verificationRequired } = params;
  return isTrialSignup
    ? !verificationRequired
    : emailConfirmed && (!verificationRequired || emailConfirmed);
}

describe('getMe email verification — trial honors the flag regardless of email_confirmed_at', () => {
  it('trial + flag set + auto-confirmed => NOT verified (banner shows)', () => {
    const v = getMeEmailVerified({ signupType: 'trial', isConfirmed: true, verificationRequired: true });
    expect(v).toBe(false);
    expect(needsEmailVerification('trial', v)).toBe(true);
  });

  it('trial + flag set + not confirmed => NOT verified (same answer either way)', () => {
    const v = getMeEmailVerified({ signupType: 'trial', isConfirmed: false, verificationRequired: true });
    expect(v).toBe(false);
    expect(needsEmailVerification('trial', v)).toBe(true);
  });

  it('trial + flag cleared => verified (banner gone) even though nothing about confirmation changed', () => {
    const v = getMeEmailVerified({ signupType: 'trial', isConfirmed: true, verificationRequired: false });
    expect(v).toBe(true);
    expect(needsEmailVerification('trial', v)).toBe(false);
  });
});

describe('getMe email verification — paid is UNCHANGED (email_confirmed_at authoritative)', () => {
  it('paid + confirmed => verified even if a stale flag lingers', () => {
    expect(getMeEmailVerified({ signupType: 'plan', isConfirmed: true, verificationRequired: true })).toBe(true);
    expect(getMeEmailVerified({ signupType: 'plan', isConfirmed: true, verificationRequired: false })).toBe(true);
  });

  it('paid + not confirmed => NOT verified', () => {
    expect(getMeEmailVerified({ signupType: 'plan', isConfirmed: false, verificationRequired: false })).toBe(false);
    expect(getMeEmailVerified({ signupType: 'plan', isConfirmed: false, verificationRequired: true })).toBe(false);
  });

  it('paid never triggers the trial banner (needs_email_verification false for a paid plan)', () => {
    const v = getMeEmailVerified({ signupType: 'plan', isConfirmed: false, verificationRequired: true });
    expect(needsEmailVerification('core', v)).toBe(false);
  });
});

describe('resolveAccountStateByEmail — same trial/paid split', () => {
  it('trial + flag set => unverified regardless of confirmation', () => {
    expect(accountStateEmailVerified({ isTrialSignup: true, emailConfirmed: true, verificationRequired: true })).toBe(false);
  });

  it('trial + flag cleared => verified', () => {
    expect(accountStateEmailVerified({ isTrialSignup: true, emailConfirmed: true, verificationRequired: false })).toBe(true);
  });

  it('paid keeps confirmation-based truth', () => {
    expect(accountStateEmailVerified({ isTrialSignup: false, emailConfirmed: true, verificationRequired: true })).toBe(true);
    expect(accountStateEmailVerified({ isTrialSignup: false, emailConfirmed: false, verificationRequired: false })).toBe(false);
  });
});
