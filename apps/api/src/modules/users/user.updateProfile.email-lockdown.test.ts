/**
 * Email lockdown for `PATCH /api/users/me`.
 *
 * `auth.users.email` is the credential; `profiles.email` mirrors it and is written server-side
 * at signup/init only. Before this change the update schema accepted `email` and wrote it
 * straight to `profiles.email`, letting a client desynchronise the displayed address from the
 * one they actually log in with — with no verification step anywhere.
 *
 * Two layers are asserted here: the route schema rejects the key outright (loud 400 rather than
 * a silent strip), and the service drops it even when a caller bypasses the schema.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn() },
  emergency_contacts: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
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

import { updateProfileSchema } from './user.schema';

const USER_ID = 'user-email-lockdown';

async function loadUserService() {
  jest.resetModules();
  return import('./user.service');
}

describe('updateProfileSchema — email is not part of the update contract', () => {
  it('rejects a client-supplied email', () => {
    const result = updateProfileSchema.safeParse({
      full_name: 'Ada Lovelace',
      email: 'attacker@example.com',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path[0] === 'email');
    expect(issue?.message).toBe('Email cannot be updated from this endpoint');
  });

  it('rejects a null email just as firmly', () => {
    const result = updateProfileSchema.safeParse({ full_name: 'Ada Lovelace', email: null });
    expect(result.success).toBe(false);
  });

  it('parses a normal payload and produces no email key at all', () => {
    const result = updateProfileSchema.safeParse({
      full_name: 'Ada Lovelace',
      pronouns: 'she/her',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect('email' in result.data).toBe(false);
  });

  /**
   * The schema is deliberately non-strict. Two shipped callers send keys it does not model —
   * `first_name`/`last_name` (onboarding/ProfileSetup.tsx) and `permissions`
   * (onboarding/Permissions.tsx) — and strict mode would 400 both flows.
   */
  it('still accepts unknown keys from existing onboarding callers', () => {
    const profileSetup = updateProfileSchema.safeParse({
      first_name: 'Ada',
      last_name: 'Lovelace',
      full_name: 'Ada Lovelace',
    });
    const permissions = updateProfileSchema.safeParse({
      permissions: { microphone: true },
      notification_preferences: { email: true },
    });

    expect(profileSetup.success).toBe(true);
    expect(permissions.success).toBe(true);
  });
});

describe('userService.updateProfile — service-layer email guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.profiles.update.mockResolvedValue({ id: USER_ID });
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    // Force the post-commit canonical re-read down its fallback path; the response shape is
    // covered by user.updateProfile.emergency-atomic.test.ts.
    mockPrisma.profiles.findUnique.mockResolvedValue(null);
  });

  it('never writes email to profiles, even when the schema is bypassed', async () => {
    const userService = await loadUserService();

    await userService.updateProfile(USER_ID, {
      email: 'attacker@example.com',
      pronouns: 'they/them',
    } as any);

    expect(mockPrisma.profiles.update).toHaveBeenCalledTimes(1);
    const data = mockPrisma.profiles.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('email');
    expect(data.pronouns).toBe('they/them');
  });
});
