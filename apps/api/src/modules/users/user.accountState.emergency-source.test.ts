/**
 * Account-state onboarding completion must recognise the canonical emergency contact.
 *
 * `getProfile` merges `emergency_contacts` into the profile before resolving completion, so that
 * path was already correct. `resolveAccountStateByEmail` read the profile row on its own and saw
 * only the legacy `profiles.emergency_contact_relationship` column — so a trial user whose
 * contact lives only in `emergency_contacts` was reported as not onboarded.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn() },
  users: { findFirst: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../billing/billing.service', () => ({
  syncSubscriptionWithStripe: jest.fn(),
  linkSubscriptionToUser: jest.fn(),
  getSubscription: jest.fn(),
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

const EMAIL = 'trial.member@example.com';
const USER_ID = 'user-account-state';

async function loadUserService() {
  jest.resetModules();
  return import('./user.service');
}

/** A trial profile that is complete except for where the contact is stored. */
function trialProfile(overrides: Record<string, any> = {}) {
  return {
    id: USER_ID,
    onboarding_completed: false,
    onboarding_completed_at: null,
    signup_type: 'trial',
    full_name: 'Ada Lovelace',
    role: 'user',
    timezone: 'Europe/London',
    selected_goals: ['sleep'],
    emergency_contact_relationship: null,
    emergency_contacts: [],
    permissions: {},
    notification_preferences: {},
    ...overrides,
  };
}

describe('resolveAccountStateByEmail — emergency contact source', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.users.findFirst.mockResolvedValue({
      id: USER_ID,
      email_confirmed_at: new Date(),
      raw_user_meta_data: { signup_type: 'trial' },
    });
  });

  it('requests the canonical contact alongside the legacy column', async () => {
    const userService = await loadUserService();
    mockPrisma.profiles.findUnique.mockResolvedValue(trialProfile());

    await userService.resolveAccountStateByEmail(EMAIL);

    const select = mockPrisma.profiles.findUnique.mock.calls[0][0].select;
    expect(select.emergency_contact_relationship).toBe(true);
    expect(select.emergency_contacts).toEqual({
      select: { relationship: true },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 1,
    });
  });

  it('treats a canonical-only contact as complete', async () => {
    const userService = await loadUserService();
    mockPrisma.profiles.findUnique.mockResolvedValue(
      trialProfile({ emergency_contacts: [{ relationship: 'Sister' }] })
    );

    const state = await userService.resolveAccountStateByEmail(EMAIL);

    expect(state.onboarding_completed).toBe(true);
  });

  it('still accepts legacy-only contact data', async () => {
    const userService = await loadUserService();
    mockPrisma.profiles.findUnique.mockResolvedValue(
      trialProfile({ emergency_contact_relationship: 'Parent', emergency_contacts: [] })
    );

    const state = await userService.resolveAccountStateByEmail(EMAIL);

    expect(state.onboarding_completed).toBe(true);
  });

  it('remains incomplete when neither source has a relationship', async () => {
    const userService = await loadUserService();
    mockPrisma.profiles.findUnique.mockResolvedValue(trialProfile());

    const state = await userService.resolveAccountStateByEmail(EMAIL);

    expect(state.onboarding_completed).toBe(false);
  });

  it('ignores a blank canonical relationship', async () => {
    const userService = await loadUserService();
    mockPrisma.profiles.findUnique.mockResolvedValue(
      trialProfile({ emergency_contacts: [{ relationship: '   ' }] })
    );

    const state = await userService.resolveAccountStateByEmail(EMAIL);

    expect(state.onboarding_completed).toBe(false);
  });

  it('still falls back to the legacy select when the canonical include is unsupported', async () => {
    const userService = await loadUserService();
    mockPrisma.profiles.findUnique
      .mockRejectedValueOnce(new Error('column does not exist'))
      .mockResolvedValueOnce(trialProfile({ emergency_contacts: [{ relationship: 'Sister' }] }));

    const state = await userService.resolveAccountStateByEmail(EMAIL);

    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(2);
    expect(state.onboarding_completed).toBe(true);
  });
});

export {};
