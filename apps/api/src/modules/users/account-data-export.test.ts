/**
 * GET /users/export projection: explicit allowlist, scoped to the caller, read-only.
 *
 * The Prisma mock ignores `select` and returns whole rows (plus columns that do not exist yet),
 * so these tests prove the projection itself — not the query — keeps internal data out.
 */

export {};

const writeSpy = jest.fn(() => {
  throw new Error('export must not write');
});
const writes = { create: writeSpy, update: writeSpy, upsert: writeSpy, updateMany: writeSpy, delete: writeSpy, deleteMany: writeSpy };

const mockPrisma = {
  profiles: { findUnique: jest.fn(), ...writes },
  emergency_contacts: { findMany: jest.fn(), ...writes },
  subscriptions: { findFirst: jest.fn(), ...writes },
  users: { findUnique: jest.fn(), ...writes },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockBilling = { syncSubscriptionWithStripe: jest.fn(), linkSubscriptionToUser: jest.fn(), getSubscription: jest.fn() };
jest.mock('../billing', () => mockBilling);

const USER_A = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-27T09:30:00.000Z');
const URDU = 'آج میں نے بہت سکون محسوس کیا';

const fullProfileRow = (over: Record<string, unknown> = {}) => ({
  id: USER_A,
  email: 'ayesha@example.test',
  full_name: 'Ayesha "AK" Khan',
  avatar_url: 'https://cdn.example/avatar.png',
  role: 'super_admin',
  created_at: new Date('2026-01-02T03:04:05.000Z'),
  updated_at: new Date('2026-10-01T00:00:00.000Z'),
  signup_type: 'plan',
  signup_source: 'app',
  age: '1995-04-12',
  current_mood: 'calm',
  bio: `=HYPERLINK("https://evil.example","x")\nLine 2, ${URDU}`,
  pronouns: 'she/her',
  selected_goals: ['sleep better', 'reduce stress, at work'],
  timezone: 'Asia/Karachi',
  emergency_contact_name: 'Legacy Contact',
  emergency_contact_phone: '+92 300 1111111',
  emergency_contact_relationship: 'friend',
  emergency_consent: false,
  in_therapy: 'no',
  notification_preferences: { pushEnabled: false, quietStart: '22:00', darkMode: true, internalFlag: 'x', moodCheckIns: { nested: true } },
  on_medication: 'prefer_not_to_say',
  permissions: { camera: true, admin: true },
  selected_avatar: 'maya',
  selected_environment: 'forest',
  selected_triggers: ['work'],
  phone: '+92 300 0000000',
  selected_voice: 'calm-voice',
  credits: 0,
  credits_seconds: 600,
  stripe_customer_id: 'cus_TEST123',
  purchased_credits: 5,
  purchased_credits_seconds: 300,
  privacy_settings: { allowAnalytics: false, profileVisibility: 'private', secretToken: 'tok_abc' },
  brain_health_settings: { internal: true },
  account_status: 'active',
  onboarding_completed: true,
  onboarding_completed_at: new Date('2026-01-03T00:00:00.000Z'),
  crisis_country_code: 'PK',
  some_future_column: 'must-not-leak',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.profiles.findUnique.mockResolvedValue(fullProfileRow());
  mockPrisma.emergency_contacts.findMany.mockResolvedValue([
    { id: 'ec-1', user_id: USER_A, name: 'Sara', relationship: 'sister', phone: '+92 300 2222222', email: null, is_trusted: false, created_at: new Date(), updated_at: new Date() },
  ]);
  mockPrisma.subscriptions.findFirst.mockResolvedValue({
    id: 'sub-row', user_id: USER_A, org_id: 'org-1', stripe_sub_id: 'sub_TEST456', payment_method: 'pm_TEST789', amount: 19.99,
    plan_type: 'pro', status: 'active', billing_cycle: 'monthly', next_billing_at: new Date('2026-11-02T00:00:00.000Z'),
  });
  mockPrisma.users.findUnique.mockResolvedValue({ email: 'auth@example.test', raw_user_meta_data: { secret: 'x' } });
});

async function build(userId = USER_A) {
  const { buildAccountDataExport } = await import('./account-data-export');
  return buildAccountDataExport(userId, NOW);
}

describe('buildAccountDataExport', () => {
  it('returns exactly the allowlisted fields', async () => {
    const out = await build();
    expect(out).toEqual({
      exportVersion: 1,
      generatedAt: '2026-10-27T09:30:00.000Z',
      profile: {
        account: { fullName: 'Ayesha "AK" Khan', email: 'ayesha@example.test', createdAt: '2026-01-02T03:04:05.000Z' },
        profile: {
          dateOfBirth: '1995-04-12',
          ageAsEntered: null,
          pronouns: 'she/her',
          timezone: 'Asia/Karachi',
          phone: '+92 300 0000000',
          bio: `=HYPERLINK("https://evil.example","x")\nLine 2, ${URDU}`,
          currentMood: 'calm',
          crisisResourcesCountry: 'PK',
        },
        wellnessPreferences: {
          goals: ['sleep better', 'reduce stress, at work'],
          challenges: ['work'],
          inTherapy: 'no',
          onMedication: 'prefer_not_to_say',
          companionAvatar: 'maya',
          companionEnvironment: 'forest',
          companionVoice: 'calm-voice',
        },
        privacySettings: {
          profileVisibility: 'private',
          allowAnalytics: false,
          shareProgress: null,
          allowCookies: null,
          marketingEmails: null,
          thirdPartySharing: null,
          communityEnabled: null,
          showDisplayNameInCommunity: null,
          showAvatarInCommunity: null,
          trustedContactEnabled: null,
        },
        notificationPreferences: expect.objectContaining({
          pushEnabled: false,
          quietStart: '22:00',
          moodCheckIns: null,
          emailEnabled: null,
        }),
        emergencyContacts: {
          consentToContact: false,
          contacts: [{ name: 'Sara', relationship: 'sister', phone: '+92 300 2222222', email: null, trustedContact: false }],
        },
        membership: { name: 'Thrive', status: 'active', billingCycle: 'monthly', nextBillingDate: '2026-11-02T00:00:00.000Z' },
      },
    });
  });

  it('never includes internal, billing or unknown fields, even when the source rows contain them', async () => {
    const text = JSON.stringify(await build());
    for (const forbidden of [
      'cus_TEST123', 'sub_TEST456', 'pm_TEST789', 'sub-row', 'org-1', 'ec-1', USER_A, 'super_admin',
      'must-not-leak', 'tok_abc', 'secretToken', 'internalFlag', 'darkMode', 'brain_health', 'credits',
      'stripe', 'permissions', 'avatar_url', 'signup_source', 'raw_user_meta_data', 'account_status', '"admin"',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('scopes every query to the requested user and selects explicit columns', async () => {
    await build();
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: USER_A } }));
    expect(mockPrisma.emergency_contacts.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: USER_A } }));
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: USER_A }) })
    );
    expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({ where: { id: USER_A }, select: { email: true } });
    const profileSelect = mockPrisma.profiles.findUnique.mock.calls[0][0].select;
    expect(profileSelect).not.toHaveProperty('stripe_customer_id');
    expect(profileSelect).not.toHaveProperty('role');
    expect(profileSelect).not.toHaveProperty('permissions');
  });

  it('is read-only: no writes and no Stripe/billing calls', async () => {
    await build();
    expect(writeSpy).not.toHaveBeenCalled();
    for (const fn of Object.values(mockBilling)) expect(fn).not.toHaveBeenCalled();
  });

  it('keeps false/zero, leaves missing values null, and handles no contacts and no subscription', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(
      fullProfileRow({
        age: '34', pronouns: null, selected_goals: [], privacy_settings: null, notification_preferences: { quietMode: false },
        emergency_contact_name: null, emergency_contact_phone: null, emergency_consent: false, email: null,
      })
    );
    mockPrisma.emergency_contacts.findMany.mockResolvedValue([]);
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const out = (await build())!;
    expect(out.profile.account.email).toBe('auth@example.test');
    expect(out.profile.profile).toMatchObject({ dateOfBirth: null, ageAsEntered: '34', pronouns: null });
    expect(out.profile.wellnessPreferences.goals).toEqual([]);
    expect(out.profile.privacySettings.allowAnalytics).toBeNull();
    expect(out.profile.notificationPreferences.quietMode).toBe(false);
    expect(out.profile.emergencyContacts).toEqual({ consentToContact: false, contacts: [] });
    expect(out.profile.membership).toEqual({ name: 'Discover', status: null, billingCycle: null, nextBillingDate: null });
  });

  it('shows the legacy profile contact only when no contact rows exist', async () => {
    mockPrisma.emergency_contacts.findMany.mockResolvedValue([]);
    const out = (await build())!;
    expect(out.profile.emergencyContacts.contacts).toEqual([
      { name: 'Legacy Contact', relationship: 'friend', phone: '+92 300 1111111', email: null, trustedContact: null },
    ]);
  });

  it('returns null when the user has no profile', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(null);
    expect(await build()).toBeNull();
  });
});
