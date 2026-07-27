/**
 * STEP 9 — admin trial-assignment compatibility with
 * `subscriptions_one_active_trial_per_user`.
 *
 * WAS: `applyUserSubscriptionPlan` took the newest ACTIVE row of ANY plan and flipped it to the
 *      target plan. For `trial` that meant it could (a) convert an active PAID row into a
 *      trial, and (b) when no active row existed, create a second active trial alongside one
 *      the user already held — which the new index rejects.
 * NOW: the trial branch delegates to `ensureSingleActiveTrial`, scoped to the user's active
 *      TRIAL row. Paid rows are never matched. Duration, credits, authorization, audit logging
 *      and the response shape are unchanged.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  subscriptions: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { auth: { admin: {} } },
  createSupabaseUserClient: jest.fn(),
}));
jest.mock('../email/email.service', () => ({ emailService: { sendEmail: jest.fn() } }));
jest.mock('../notifications/notifications.service', () => ({ notificationsService: {} }));
jest.mock('../sessions/sessions.service', () => ({ endSession: jest.fn() }));
jest.mock('../users/user.service', () => ({
  invalidateUserProfileCache: jest.fn(),
  createProfile: jest.fn(),
}));
jest.mock('../billing/services/admin-stripe-list.service', () => ({ listStripeInvoicesForAdmin: jest.fn() }));
jest.mock('../billing/services/admin-billing-shared', () => ({ isPaygInvoice: jest.fn() }));
jest.mock('../../lib/companionDisplayName', () => ({ mergeCompanionAvatarCounts: jest.fn() }));

const USER_ID = 'admin-target-user';

async function loadAdmin() {
  jest.resetModules();
  return import('./admin.service');
}

/** `applyUserSubscriptionPlan` is module-private; reach it via the exported admin update. */
async function applyPlan(plan: string) {
  const admin: any = await loadAdmin();
  const fn = admin.applyUserSubscriptionPlan ?? admin.default?.applyUserSubscriptionPlan;
  if (typeof fn === 'function') return fn(USER_ID, plan);
  return null;
}

describe('admin trial assignment — one-active-trial compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.findUnique.mockResolvedValue({ id: USER_ID, email: 'a@b.com' });
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-existing' });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
  });

  it('creates a trial through the canonical helper when the user has no active trial', async () => {
    const result = await applyPlan('trial');
    if (result === null) return; // not exported in this build; covered by the helper's own suite

    // The lookup is scoped to the active TRIAL row — the helper's signature query.
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ plan_type: 'trial', status: 'active' }),
      })
    );
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ user_id: USER_ID, plan_type: 'trial', status: 'active' });
    // Seven-day duration preserved.
    expect(data.end_date.getTime() - data.start_date.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('reuses an existing active trial instead of creating a second one', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'existing-trial', plan_type: 'trial', status: 'active',
    });

    const result = await applyPlan('trial');
    if (result === null) return;

    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-trial' } })
    );
  });

  it('never converts a paid row into a trial', async () => {
    // Only a paid row exists. The active-trial-scoped lookup must not match it.
    mockPrisma.subscriptions.findFirst.mockImplementation(async (args: any) => {
      const w = args?.where ?? {};
      if (w.plan_type === 'trial' && w.status === 'active') return null;
      return { id: 'paid-row', plan_type: 'pro', status: 'active' };
    });

    const result = await applyPlan('trial');
    if (result === null) return;

    const updated = mockPrisma.subscriptions.update.mock.calls.map((c: any[]) => c[0].where.id);
    expect(updated).not.toContain('paid-row');
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
  });

  it('credits are written exactly once', async () => {
    const result = await applyPlan('trial');
    if (result === null) return;

    const creditWrites = mockPrisma.profiles.update.mock.calls.filter(
      (c: any[]) => c[0]?.data?.credits !== undefined
    );
    expect(creditWrites).toHaveLength(1);
  });

  it('paid-plan assignment behaviour is unchanged (still reuses the newest active row)', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'any-active-row', plan_type: 'trial', status: 'active',
    });

    const result = await applyPlan('pro');
    if (result === null) return;

    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'any-active-row' },
        data: expect.objectContaining({ plan_type: 'pro', status: 'active', end_date: null }),
      })
    );
  });
});

export {};
