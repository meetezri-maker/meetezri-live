/**
 * Signup date of birth → `profiles.age`.
 *
 * Email signup now sends a `YYYY-MM-DD` date of birth under the existing `age` key. It reaches
 * the profile from the server-side auth row when the profile is created (trial: client signUp
 * metadata; paid: POST /signup metadata), so it survives an interrupted trial wizard and a
 * profile created only after verification + login.
 *
 * Pinned here:
 *   - the strict date rule (real calendar day, existing 18+ rule)
 *   - absent / legacy numeric metadata keeps the old behavior (nothing written, no error)
 *   - a supplied invalid DOB is an explicit error, never a silent drop
 *   - create branches write `age`; update branches never touch it
 */

export {};

const mockPrisma = {
  users: { findUnique: jest.fn() },
  profiles: { upsert: jest.fn(), updateMany: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../billing', () => ({
  syncSubscriptionWithStripe: jest.fn(),
  linkSubscriptionToUser: jest.fn(),
  getSubscription: jest.fn(),
}));

jest.mock('../billing/services/trial.service', () => ({
  provisionDiscoverTrial: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { auth: { admin: {} } },
  createSupabaseUserClient: jest.fn(),
}));

jest.mock('../email/email.service', () => ({
  emailService: { sendEmail: jest.fn() },
}));

jest.mock('../../lib/sharedCache', () => ({
  sharedDel: jest.fn(),
  sharedGetJson: jest.fn().mockResolvedValue(null),
  sharedSetJson: jest.fn(),
}));

const USER_ID = 'user-signup-dob';

/** 2026-10-26 at local noon, so "today" is fixed for every age calculation. */
const TODAY = new Date(2026, 9, 26, 12, 0, 0);

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(TODAY);
  mockPrisma.users.findUnique.mockReset();
  mockPrisma.profiles.upsert.mockReset().mockResolvedValue({ id: USER_ID });
  mockPrisma.profiles.updateMany.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

function withMetadata(meta: Record<string, unknown> | null) {
  mockPrisma.users.findUnique.mockResolvedValue(meta === null ? null : { raw_user_meta_data: meta });
}

async function loadSchema() {
  return import('./user.schema');
}

async function loadService() {
  return import('./user.service');
}

describe('strict signup DOB rule', () => {
  it('accepts a real calendar date that is at least 18', async () => {
    const { isEligibleSignupDob } = await loadSchema();
    expect(isEligibleSignupDob('1990-04-02')).toBe(true);
  });

  it('treats exactly 18 today as eligible and one day short as not', async () => {
    const { isEligibleSignupDob } = await loadSchema();
    expect(isEligibleSignupDob('2008-10-26')).toBe(true);
    expect(isEligibleSignupDob('2008-10-27')).toBe(false);
  });

  it('rejects impossible dates that Date would roll over', async () => {
    const { isEligibleSignupDob, isStrictIsoDob } = await loadSchema();
    for (const value of ['2001-02-30', '2001-02-31', '2001-04-31', '2001-13-01', '2001-00-10', '2001-01-00']) {
      expect(isStrictIsoDob(value)).toBe(false);
      expect(isEligibleSignupDob(value)).toBe(false);
    }
  });

  it('handles leap days: real in leap years only', async () => {
    const { isStrictIsoDob } = await loadSchema();
    expect(isStrictIsoDob('2004-02-29')).toBe(true);
    expect(isStrictIsoDob('2000-02-29')).toBe(true);
    expect(isStrictIsoDob('2001-02-29')).toBe(false);
    expect(isStrictIsoDob('1900-02-29')).toBe(false);
  });

  it('rejects future and under-18 dates', async () => {
    const { isEligibleSignupDob } = await loadSchema();
    expect(isEligibleSignupDob('2030-01-01')).toBe(false);
    expect(isEligibleSignupDob('2015-06-15')).toBe(false);
  });

  it('rejects malformed shapes', async () => {
    const { isEligibleSignupDob } = await loadSchema();
    for (const value of ['', '1990-4-2', '04/02/1990', '1990/04/02', 'abc', '30']) {
      expect(isEligibleSignupDob(value)).toBe(false);
    }
  });
});

describe('POST /signup body: age', () => {
  async function ageIssue(age: unknown) {
    const { signupSchema } = await loadSchema();
    const result = signupSchema.safeParse({
      email: 'jane@example.com',
      password: 'supersecret1',
      firstName: 'Jane',
      lastName: 'Roe',
      age,
    });
    return result.success ? null : result.error.issues.find((i) => i.path[0] === 'age') ?? null;
  }

  it('accepts a valid DOB', async () => {
    expect(await ageIssue('1990-04-02')).toBeNull();
  });

  it('keeps the legacy numeric age rule', async () => {
    expect(await ageIssue('30')).toBeNull();
    expect(await ageIssue(30)).toBeNull();
    expect(await ageIssue('17')).not.toBeNull();
  });

  it('rejects an impossible, future, or under-18 DOB', async () => {
    expect(await ageIssue('2001-02-30')).not.toBeNull();
    expect(await ageIssue('2030-01-01')).not.toBeNull();
    expect(await ageIssue('2015-06-15')).not.toBeNull();
  });

  it('still requires age', async () => {
    expect(await ageIssue(undefined)).not.toBeNull();
  });
});

describe('getSignupDobFromAuthMeta', () => {
  it('returns the validated DOB', async () => {
    withMetadata({ age: '1990-04-02' });
    const { getSignupDobFromAuthMeta } = await loadService();
    await expect(getSignupDobFromAuthMeta(USER_ID)).resolves.toBe('1990-04-02');
    expect(mockPrisma.users.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } })
    );
  });

  it('returns null with no auth row, no metadata, or no age (Google)', async () => {
    const { getSignupDobFromAuthMeta } = await loadService();
    for (const meta of [null, {}, { full_name: 'G User' }, { age: '' }, { age: null }]) {
      withMetadata(meta);
      await expect(getSignupDobFromAuthMeta(USER_ID)).resolves.toBeNull();
    }
  });

  it('returns null for legacy numeric ages, never reading them as dates', async () => {
    const { getSignupDobFromAuthMeta } = await loadService();
    for (const age of ['30', 30, '18', '17']) {
      withMetadata({ age });
      await expect(getSignupDobFromAuthMeta(USER_ID)).resolves.toBeNull();
    }
  });

  it('throws an explicit 400 for a supplied invalid DOB', async () => {
    const { getSignupDobFromAuthMeta, isInvalidSignupDobError } = await loadService();
    for (const age of ['2001-02-30', '2030-01-01', '2015-06-15', '04/02/1990', '1990-4-2']) {
      withMetadata({ age });
      const error = await getSignupDobFromAuthMeta(USER_ID).catch((e) => e);
      expect(isInvalidSignupDobError(error)).toBe(true);
      expect(error.statusCode).toBe(400);
    }
  });
});

describe('createProfile persists the signup DOB on creation only', () => {
  it('writes age in the create branch and never in the update branch', async () => {
    withMetadata({ age: '1990-04-02', signup_type: 'trial' });
    const { createProfile } = await loadService();
    await createProfile(USER_ID, 'jane@example.com', 'Jane Roe', undefined, 'app');

    const args = mockPrisma.profiles.upsert.mock.calls[0][0];
    expect(args.create.age).toBe('1990-04-02');
    expect(args.update).not.toHaveProperty('age');
  });

  it('writes no age for legacy numeric or absent metadata', async () => {
    const { createProfile } = await loadService();
    for (const meta of [{ age: '30', signup_type: 'trial' }, { signup_type: 'plan' }]) {
      mockPrisma.profiles.upsert.mockClear();
      withMetadata(meta);
      await createProfile(USER_ID, 'jane@example.com', 'Jane Roe', undefined, 'app');
      expect(mockPrisma.profiles.upsert.mock.calls[0][0].create).not.toHaveProperty('age');
    }
  });

  it('keeps age in the older-database fallback create', async () => {
    withMetadata({ age: '1990-04-02', signup_type: 'trial' });
    mockPrisma.profiles.upsert
      .mockRejectedValueOnce(new Error('column "signup_source" does not exist'))
      .mockResolvedValueOnce({ id: USER_ID });
    const { createProfile } = await loadService();
    await createProfile(USER_ID, 'jane@example.com', 'Jane Roe', undefined, 'app');

    const fallback = mockPrisma.profiles.upsert.mock.calls[1][0];
    expect(fallback.create.age).toBe('1990-04-02');
    expect(fallback.update).not.toHaveProperty('age');
  });

  it('refuses to create the profile with an invalid supplied DOB', async () => {
    withMetadata({ age: '2015-06-15', signup_type: 'trial' });
    const { createProfile, isInvalidSignupDobError } = await loadService();
    const error = await createProfile(USER_ID, 'jane@example.com', 'Jane Roe').catch((e) => e);
    expect(isInvalidSignupDobError(error)).toBe(true);
    expect(mockPrisma.profiles.upsert).not.toHaveBeenCalled();
  });
});

describe('createProfileForPaidSignup persists the signup DOB on creation only', () => {
  it('writes age in the create branch and never in the update branch', async () => {
    withMetadata({ age: '1990-04-02' });
    const { createProfileForPaidSignup } = await loadService();
    await createProfileForPaidSignup(USER_ID, 'jane@example.com', 'Jane Roe');

    const args = mockPrisma.profiles.upsert.mock.calls[0][0];
    expect(args.create.age).toBe('1990-04-02');
    expect(args.update).not.toHaveProperty('age');
  });

  it('writes no age for a legacy numeric age', async () => {
    withMetadata({ age: '30' });
    const { createProfileForPaidSignup } = await loadService();
    await createProfileForPaidSignup(USER_ID, 'jane@example.com', 'Jane Roe');
    expect(mockPrisma.profiles.upsert.mock.calls[0][0].create).not.toHaveProperty('age');
  });
});

describe('fillEmptyProfileAge', () => {
  it('is one conditional update that only matches NULL or empty age', async () => {
    mockPrisma.profiles.updateMany.mockResolvedValue({ count: 1 });
    const { fillEmptyProfileAge } = await loadService();
    await expect(fillEmptyProfileAge(USER_ID, '1990-04-02')).resolves.toBe(true);
    expect(mockPrisma.profiles.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, OR: [{ age: null }, { age: '' }] },
      data: { age: '1990-04-02' },
    });
  });

  it('reports false when a stored age already exists', async () => {
    mockPrisma.profiles.updateMany.mockResolvedValue({ count: 0 });
    const { fillEmptyProfileAge } = await loadService();
    await expect(fillEmptyProfileAge(USER_ID, '1990-04-02')).resolves.toBe(false);
  });
});
