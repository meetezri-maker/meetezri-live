/**
 * `userService.updateProfile` — atomic profile + emergency-contact save.
 *
 * Before this change the emergency contact was written by its own `prisma.emergency_contacts`
 * call BEFORE (and outside) the profile `$transaction`, so a failing profile update left the
 * contact change committed with no rollback; the legacy `profiles.emergency_contact_*` columns
 * were never synchronised; and PATCH answered with the raw `profiles` row, whose stale legacy
 * columns overwrote the contact the user had just saved.
 *
 * The transaction client is a DISTINCT mock from the root prisma mock, so any write that lands
 * on the root client is, by construction, a write that escaped the transaction.
 */

const txMock = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  emergency_contacts: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  $executeRaw: jest.fn(),
};

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  emergency_contacts: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  subscriptions: { findFirst: jest.fn() },
  appointments: { count: jest.fn() },
  users: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
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

const USER_ID = 'user-emergency-atomic';

async function loadUserService() {
  jest.resetModules();
  return import('./user.service');
}

/** A stored canonical contact carrying settings-page-only fields that must survive a save. */
function existingContactRow(overrides: Record<string, any> = {}) {
  return {
    id: 'contact-newest',
    user_id: USER_ID,
    name: 'Old Name',
    phone: '+15550000000',
    relationship: 'Parent',
    email: 'kin@example.com',
    is_trusted: true,
    created_at: new Date('2026-01-02T00:00:00Z'),
    updated_at: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

/** The shape `getProfile`'s cold read returns (mirrors user.baseline.self-heal.test.ts). */
function coldReadProfile(overrides: Record<string, any> = {}) {
  return {
    id: USER_ID,
    email: 'member@example.com',
    full_name: 'Ada Lovelace',
    role: 'user',
    bio: null,
    age: '1990-04-02',
    timezone: 'Europe/London',
    pronouns: 'she/her',
    in_therapy: 'Yes',
    selected_goals: ['sleep'],
    selected_triggers: ['crowds'],
    emergency_consent: true,
    credits: 30,
    credits_seconds: 1800,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
    stripe_customer_id: null,
    signup_type: 'trial',
    onboarding_completed: true,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    subscriptions: [],
    emergency_contacts: [],
    mood_entries: [],
    _count: { app_sessions: 0, mood_entries: 0, journal_entries: 0 },
    ...overrides,
  };
}

/**
 * `profiles.findUnique` serves two different callers: the in-transaction legacy-column read
 * (a plain `select`) and `getProfile`'s cold read (an `include`). Route them apart.
 */
function routeProfileFindUnique(opts: { legacy?: any; cold?: any } = {}) {
  txMock.profiles.findUnique.mockImplementation(async () => opts.legacy ?? null);
  mockPrisma.profiles.findUnique.mockImplementation(async (args: any) => {
    if (args?.include) return opts.cold ?? coldReadProfile();
    return opts.legacy ?? null;
  });
}

const VALID_CONTACT = {
  emergency_contact_name: 'Jamie Morgan',
  emergency_contact_phone: '+15551234567',
  emergency_contact_relationship: 'Sister',
};

describe('updateProfile — one transaction for every write', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );
    txMock.profiles.update.mockResolvedValue({ id: USER_ID });
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);
    txMock.emergency_contacts.update.mockResolvedValue({});
    txMock.emergency_contacts.create.mockResolvedValue({});
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    routeProfileFindUnique();
  });

  it('writes profile and emergency contact through the same transaction client', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());

    await userService.updateProfile(USER_ID, {
      full_name: 'Ada Lovelace',
      ...VALID_CONTACT,
      emergency_consent: true,
    } as any);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.emergency_contacts.findFirst).toHaveBeenCalledTimes(1);
    expect(txMock.emergency_contacts.update).toHaveBeenCalledTimes(1);
    expect(txMock.profiles.update).toHaveBeenCalledTimes(1);
    // Nothing escaped the transaction.
    expect(mockPrisma.emergency_contacts.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.emergency_contacts.update).not.toHaveBeenCalled();
    expect(mockPrisma.emergency_contacts.create).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
  });

  it('keeps the raw-SQL bio and brain_health writes inside the same transaction', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, {
      bio: 'Hello',
      brain_health_settings: { focus: true },
    } as any);

    expect(txMock.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('fails the whole request when the profile update fails, after the contact write', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());
    txMock.profiles.update.mockRejectedValue(new Error('profiles update failed'));

    await expect(
      userService.updateProfile(USER_ID, { ...VALID_CONTACT, emergency_consent: true } as any)
    ).rejects.toThrow('profiles update failed');

    // The contact write happened on the transaction client, so the database rolls it back.
    expect(txMock.emergency_contacts.update).toHaveBeenCalledTimes(1);
  });

  it('never reaches the profile update when the contact write fails', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());
    txMock.emergency_contacts.update.mockRejectedValue(new Error('contact update failed'));

    await expect(
      userService.updateProfile(USER_ID, { ...VALID_CONTACT, emergency_consent: true } as any)
    ).rejects.toThrow('contact update failed');

    expect(txMock.profiles.update).not.toHaveBeenCalled();
  });

  it('does not invalidate the profile cache when the transaction fails', async () => {
    const userService = await loadUserService();
    const cold = coldReadProfile({ full_name: 'Cached Name' });
    routeProfileFindUnique({ cold });

    // Populate the cache.
    await userService.getProfile(USER_ID);
    const readsAfterWarm = mockPrisma.profiles.findUnique.mock.calls.filter(
      (call: any[]) => call[0]?.include
    ).length;

    txMock.profiles.update.mockRejectedValue(new Error('profiles update failed'));
    await expect(
      userService.updateProfile(USER_ID, { full_name: 'New Name' } as any)
    ).rejects.toThrow('profiles update failed');

    // A cache hit proves the failed write did not drop the entry.
    const profile = await userService.getProfile(USER_ID);
    expect(profile.full_name).toBe('Cached Name');
    const readsAfterFailure = mockPrisma.profiles.findUnique.mock.calls.filter(
      (call: any[]) => call[0]?.include
    ).length;
    expect(readsAfterFailure).toBe(readsAfterWarm);
  });
});

describe('updateProfile — primary contact selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );
    txMock.profiles.update.mockResolvedValue({ id: USER_ID });
    txMock.emergency_contacts.update.mockResolvedValue({});
    txMock.emergency_contacts.create.mockResolvedValue({});
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    routeProfileFindUnique();
  });

  it('selects the newest contact by created_at, with id as a deterministic tie-breaker', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());

    await userService.updateProfile(USER_ID, { ...VALID_CONTACT } as any);

    expect(txMock.emergency_contacts.findFirst).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
  });

  it('updates the selected row rather than creating a second one', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow({ id: 'contact-42' }));

    await userService.updateProfile(USER_ID, { ...VALID_CONTACT } as any);

    expect(txMock.emergency_contacts.update.mock.calls[0][0].where).toEqual({ id: 'contact-42' });
    expect(txMock.emergency_contacts.create).not.toHaveBeenCalled();
  });

  it('creates a contact when the user has none', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);

    await userService.updateProfile(USER_ID, { ...VALID_CONTACT } as any);

    expect(txMock.emergency_contacts.update).not.toHaveBeenCalled();
    expect(txMock.emergency_contacts.create).toHaveBeenCalledTimes(1);
    expect(txMock.emergency_contacts.create.mock.calls[0][0].data).toEqual({
      user_id: USER_ID,
      name: 'Jamie Morgan',
      phone: '+15551234567',
      relationship: 'Sister',
      is_trusted: true,
    });
  });

  it('migrates legacy-only contact data into a canonical row', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);
    routeProfileFindUnique({
      legacy: {
        emergency_contact_name: 'Legacy Name',
        emergency_contact_phone: '+15559999999',
        emergency_contact_relationship: 'Parent',
      },
    });

    await userService.updateProfile(USER_ID, {
      emergency_contact_name: 'Jamie Morgan',
    } as any);

    // Omitted fields come from the legacy columns, so the create is complete.
    expect(txMock.emergency_contacts.create.mock.calls[0][0].data).toMatchObject({
      name: 'Jamie Morgan',
      phone: '+15559999999',
      relationship: 'Parent',
    });
  });
});

describe('updateProfile — canonical/legacy synchronisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );
    txMock.profiles.update.mockResolvedValue({ id: USER_ID });
    txMock.emergency_contacts.update.mockResolvedValue({});
    txMock.emergency_contacts.create.mockResolvedValue({});
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    routeProfileFindUnique();
  });

  it('writes identical values to the canonical row and the legacy columns', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, {
      ...VALID_CONTACT,
      emergency_consent: true,
    } as any);

    const contactData = txMock.emergency_contacts.update.mock.calls[0][0].data;
    const profileData = txMock.profiles.update.mock.calls[0][0].data;

    expect(contactData).toMatchObject({
      name: 'Jamie Morgan',
      phone: '+15551234567',
      relationship: 'Sister',
    });
    expect(profileData.emergency_contact_name).toBe(contactData.name);
    expect(profileData.emergency_contact_phone).toBe(contactData.phone);
    expect(profileData.emergency_contact_relationship).toBe(contactData.relationship);
  });

  it('persists emergency consent onto the profile', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, {
      ...VALID_CONTACT,
      emergency_consent: true,
    } as any);

    expect(txMock.profiles.update.mock.calls[0][0].data.emergency_consent).toBe(true);
  });

  it('persists a consent-only patch without touching the contact', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, { emergency_consent: true } as any);

    expect(txMock.profiles.update.mock.calls[0][0].data.emergency_consent).toBe(true);
    expect(txMock.emergency_contacts.findFirst).not.toHaveBeenCalled();
    expect(txMock.emergency_contacts.update).not.toHaveBeenCalled();
    expect(txMock.emergency_contacts.create).not.toHaveBeenCalled();
  });

  it('preserves omitted contact fields instead of nulling them', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, {
      emergency_contact_relationship: 'Sibling',
    } as any);

    expect(txMock.emergency_contacts.update.mock.calls[0][0].data).toMatchObject({
      name: 'Old Name',
      phone: '+15550000000',
      relationship: 'Sibling',
    });
  });

  it('never overwrites the settings-page-only email and is_trusted fields', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, { ...VALID_CONTACT } as any);

    const contactData = txMock.emergency_contacts.update.mock.calls[0][0].data;
    expect(contactData).not.toHaveProperty('email');
    expect(contactData).not.toHaveProperty('is_trusted');
  });

  it('leaves the contact alone when the patch has no emergency fields', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, { full_name: 'Ada Lovelace' } as any);

    expect(txMock.emergency_contacts.findFirst).not.toHaveBeenCalled();
    expect(txMock.profiles.update.mock.calls[0][0].data).not.toHaveProperty(
      'emergency_contact_name'
    );
  });
});

describe('updateProfile — clearing is not supported here', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );
    txMock.profiles.update.mockResolvedValue({ id: USER_ID });
    txMock.emergency_contacts.update.mockResolvedValue({});
    txMock.emergency_contacts.create.mockResolvedValue({});
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    routeProfileFindUnique();
  });

  it('rejects an attempt to clear an existing canonical contact', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());

    await expect(
      userService.updateProfile(USER_ID, {
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
      } as any)
    ).rejects.toMatchObject({
      message: userService.EMERGENCY_CONTACT_CLEAR_MESSAGE,
      statusCode: 400,
    });

    expect(txMock.emergency_contacts.update).not.toHaveBeenCalled();
    expect(txMock.emergency_contacts.create).not.toHaveBeenCalled();
    expect(txMock.profiles.update).not.toHaveBeenCalled();
  });

  it('rejects a partial clear that would leave the contact incomplete', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());

    // The route schema turns an empty phone into `undefined`, so a real clear attempt arrives
    // as blanked name/relationship with the phone omitted.
    await expect(
      userService.updateProfile(USER_ID, {
        emergency_contact_name: '',
        emergency_contact_relationship: '',
      } as any)
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(txMock.emergency_contacts.update).not.toHaveBeenCalled();
    expect(txMock.profiles.update).not.toHaveBeenCalled();
  });

  it('rejects legacy-only contact data being cleared', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);
    routeProfileFindUnique({
      legacy: {
        emergency_contact_name: 'Legacy Name',
        emergency_contact_phone: '+15559999999',
        emergency_contact_relationship: 'Parent',
      },
    });

    await expect(
      userService.updateProfile(USER_ID, {
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
      } as any)
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(txMock.emergency_contacts.create).not.toHaveBeenCalled();
  });

  it('rejects an incomplete new contact', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);

    await expect(
      userService.updateProfile(USER_ID, { emergency_contact_name: 'Jamie Morgan' } as any)
    ).rejects.toMatchObject({
      message: userService.EMERGENCY_CONTACT_INCOMPLETE_MESSAGE,
      statusCode: 400,
    });

    expect(txMock.emergency_contacts.create).not.toHaveBeenCalled();
  });

  it('creates nothing for an empty payload when no contact exists', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);

    await userService.updateProfile(USER_ID, {
      emergency_contact_name: '',
      emergency_contact_relationship: '',
    } as any);

    expect(txMock.emergency_contacts.create).not.toHaveBeenCalled();
    expect(txMock.emergency_contacts.update).not.toHaveBeenCalled();
    expect(txMock.profiles.update).toHaveBeenCalledTimes(1);
  });
});

describe('updateProfile — consent gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );
    txMock.profiles.update.mockResolvedValue({ id: USER_ID });
    txMock.emergency_contacts.update.mockResolvedValue({});
    txMock.emergency_contacts.create.mockResolvedValue({});
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    routeProfileFindUnique();
  });

  it('refuses to save contact data with consent explicitly false', async () => {
    const userService = await loadUserService();

    await expect(
      userService.updateProfile(USER_ID, {
        ...VALID_CONTACT,
        emergency_consent: false,
      } as any)
    ).rejects.toMatchObject({
      message: userService.EMERGENCY_CONSENT_REQUIRED_MESSAGE,
      statusCode: 400,
    });

    expect(txMock.emergency_contacts.update).not.toHaveBeenCalled();
    expect(txMock.profiles.update).not.toHaveBeenCalled();
  });

  it('refuses to withdraw consent while contact data is still on file', async () => {
    const userService = await loadUserService();

    await expect(
      userService.updateProfile(USER_ID, { emergency_consent: false } as any)
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(txMock.profiles.update).not.toHaveBeenCalled();
  });

  it('allows consent false when there is no contact to be inconsistent with', async () => {
    const userService = await loadUserService();
    txMock.emergency_contacts.findFirst.mockResolvedValue(null);

    await userService.updateProfile(USER_ID, { emergency_consent: false } as any);

    expect(txMock.profiles.update.mock.calls[0][0].data.emergency_consent).toBe(false);
  });

  /**
   * Compatibility: `Signup.tsx` and `onboarding/EmergencyContact.tsx` write contact data without
   * sending consent. Requiring consent on every write would 400 both shipped flows, so an
   * OMITTED consent leaves the stored value alone; only an explicit `false` is refused.
   */
  it('allows a contact write when consent is omitted', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, { ...VALID_CONTACT } as any);

    expect(txMock.emergency_contacts.update).toHaveBeenCalledTimes(1);
    expect(txMock.profiles.update.mock.calls[0][0].data).not.toHaveProperty('emergency_consent');
  });
});

describe('updateProfile — response is the fresh canonical profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );
    txMock.profiles.update.mockResolvedValue({ id: USER_ID });
    txMock.emergency_contacts.update.mockResolvedValue({});
    txMock.emergency_contacts.create.mockResolvedValue({});
    txMock.emergency_contacts.findFirst.mockResolvedValue(existingContactRow());
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
  });

  it('returns the saved contact merged from the canonical table, not the stale legacy columns', async () => {
    const userService = await loadUserService();
    routeProfileFindUnique({
      cold: coldReadProfile({
        // Legacy columns intentionally stale here: the merge must prefer the canonical row.
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_relationship: null,
        emergency_contacts: [
          { name: 'Jamie Morgan', phone: '+15551234567', relationship: 'Sister' },
        ],
      }),
    });

    const result: any = await userService.updateProfile(USER_ID, {
      ...VALID_CONTACT,
      emergency_consent: true,
    } as any);

    expect(result.emergency_contact_name).toBe('Jamie Morgan');
    expect(result.emergency_contact_phone).toBe('+15551234567');
    expect(result.emergency_contact_relationship).toBe('Sister');
    expect(result.emergency_consent).toBe(true);
  });

  it('returns the personal and wellness fields in the GET /users/me shape', async () => {
    const userService = await loadUserService();
    routeProfileFindUnique();

    const result: any = await userService.updateProfile(USER_ID, {
      full_name: 'Ada Lovelace',
    } as any);

    expect(result.full_name).toBe('Ada Lovelace');
    expect(result.age).toBe('1990-04-02');
    expect(result.timezone).toBe('Europe/London');
    expect(result.pronouns).toBe('she/her');
    expect(result.in_therapy).toBe('Yes');
    expect(result.selected_goals).toEqual(['sleep']);
    expect(result.selected_triggers).toEqual(['crowds']);
    // Computed keys that only the canonical read produces.
    expect(result.stats).toBeDefined();
    expect(result.subscription_plan).toBeDefined();
  });

  it('invalidates the cache before the fresh read, so a stale entry cannot be served', async () => {
    const userService = await loadUserService();
    routeProfileFindUnique({ cold: coldReadProfile({ full_name: 'Stale Cached Name' }) });

    // Warm the cache with the pre-update state.
    const warm = await userService.getProfile(USER_ID);
    expect(warm.full_name).toBe('Stale Cached Name');

    routeProfileFindUnique({ cold: coldReadProfile({ full_name: 'Freshly Saved Name' }) });
    const result: any = await userService.updateProfile(USER_ID, {
      full_name: 'Freshly Saved Name',
    } as any);

    expect(result.full_name).toBe('Freshly Saved Name');
  });
});

export {};
