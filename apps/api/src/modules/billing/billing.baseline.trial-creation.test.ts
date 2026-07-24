/**
 * BASELINE SUITE — Billing Consolidation, Step 2.
 *
 * Purpose: capture the current trial-creation flow EXACTLY as it exists today
 * (BILLING_CONSOLIDATION_IMPLEMENTATION_PLAN.md §12.1, task requirement 5).
 *
 * There are TWO independent trial writers in production (plan §2.1):
 *   W1  — `user.service.createProfile` (:885-901), the signup path.
 *   W14 — `subscription.service.createCheckoutSession` trial branch (:79-133), reached from
 *         `POST /billing`.
 * Both are covered here, for first creation and for repeated creation.
 *
 * These tests are NOT assertions of correctness. Where they document behaviour the plan
 * classifies as defective the test name is prefixed `[DOCUMENTS DEFECT]`.
 *
 * No production code is modified by this file.
 */

const mockStripe = {
  checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), list: jest.fn(), update: jest.fn() },
  customers: { create: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
};

const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  subscriptions: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  users: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../config/stripe', () => ({ stripe: mockStripe }));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
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

const USER_ID = 'user-trial-baseline';

async function loadSubscriptionService() {
  jest.resetModules();
  return import('./services/subscription.service');
}

async function loadUserService() {
  jest.resetModules();
  return import('../users/user.service');
}

// ---------------------------------------------------------------------------
// W1 — trial creation on signup (`user.service.createProfile`)
// ---------------------------------------------------------------------------

describe('BASELINE — trial creation on signup (W1: user.service.createProfile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.upsert.mockResolvedValue({ id: USER_ID, email: 'a@b.com' });
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'trial-row-1' });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * First trial creation: the profile is upserted with 30 credits / 1800 seconds written
   * DIRECTLY on the profile row (not through any allowance helper), then a trial
   * subscription row is created with a 7-day `end_date` and a NULL `stripe_sub_id`.
   *
   * Note the credit grant and the subscription row are separate statements with no
   * transaction; the credits are part of the profile `create` branch only, so a profile that
   * already exists is NOT re-credited by this path.
   */
  it('first trial creation: upserts the profile with 30 credits and creates one 7-day trial row', async () => {
    const { createProfile } = await loadUserService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');

    const upsertArg = mockPrisma.profiles.upsert.mock.calls[0][0];
    expect(upsertArg.create).toMatchObject({
      id: USER_ID,
      credits: 30,
      credits_seconds: 1800,
      signup_type: 'trial',
    });
    // The update branch never touches credits — an existing profile is not re-credited.
    expect(upsertArg.update).not.toHaveProperty('credits');

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    const created = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      user_id: USER_ID,
      plan_type: 'trial',
      status: 'active',
      billing_cycle: 'monthly',
    });
    expect(created.stripe_sub_id).toBeUndefined();
    expect(created.end_date.getTime() - created.start_date.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * Repeated trial creation: the existence check is
   * `findFirst({ user_id, plan_type: 'trial' })` — NOT scoped by status. When it hits, no
   * second trial row is created. Sequentially this is correct.
   */
  /**
   * STEP 6 — assertion shape updated, behaviour unchanged.
   *
   * WAS: asserted the inline lookup `findFirst({ where: { user_id, plan_type: 'trial' },
   * select: { id: true } })`.
   * NOW: the same "any trial row suppresses creation" semantics, but issued by the canonical
   * `ensureSingleActiveTrial(userId, { match: 'any_trial' })` helper, which orders
   * newest-first instead of selecting only the id.
   */
  it('repeated trial creation: an existing trial row (any status) suppresses a second create', async () => {
    const { createProfile } = await loadUserService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'trial-row-1' });

    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');

    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { user_id: USER_ID, plan_type: 'trial' },
      orderBy: { created_at: 'desc' },
    });
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    // An existing signup trial row is never reshaped by this path.
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
  });

  /**
   * STEP 6 — reinterpreted. This now documents the RESIDUAL CONCURRENCY gap, not a sequential
   * defect, and it is expected to keep passing until the partial unique index lands.
   *
   * WAS: proof that `createProfile`'s check-then-write duplicates trial rows.
   * NOW: `createProfile` delegates to `ensureSingleActiveTrial`, which is SEQUENTIALLY
   * idempotent (see the test below — a real second call observes the committed row). Holding
   * the lookup at "not found" for both calls simulates two callers that each read before
   * either wrote, which is precisely the concurrent interleaving no application-level guard
   * can prevent.
   *
   * Closing this requires `subscriptions_one_active_trial_per_user`
   * (UNIQUE (user_id) WHERE plan_type='trial' AND status='active') — plan §8A.3 Option A,
   * §17 Gate 3b. Step 6 explicitly does NOT claim concurrent safety.
   */
  it('[REMAINING CONCURRENCY GAP] two callers that both miss the lookup still create two trial rows', async () => {
    const { createProfile } = await loadUserService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');
    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(2);
    const plans = mockPrisma.subscriptions.create.mock.calls.map(
      (call: any[]) => `${call[0].data.plan_type}:${call[0].data.status}`
    );
    expect(plans).toEqual(['trial:active', 'trial:active']);
  });

  /**
   * STEP 6 — the sequential invariant this step DOES deliver: a repeated request observes the
   * row the previous one committed and creates nothing further.
   */
  it('sequential duplicate signups create exactly one trial row', async () => {
    const { createProfile } = await loadUserService();

    // First call finds nothing and creates; the second observes the committed row.
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'trial-row-1', plan_type: 'trial', status: 'active' });

    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');
    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');
    await createProfile(USER_ID, 'a@b.com', 'A B', 'trial');

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * A trial row is created on EVERY signup path, including paid signups, because
   * `createProfile` does not branch on `signup_type` before creating it. Plan §8A.1 records
   * that 21 users legitimately hold an active trial row alongside an active paid row, so the
   * §8A invariant must be scoped to trials only and must not remove this coexistence.
   */
  it('creates a trial row even when signup_type is "plan"', async () => {
    const { createProfile } = await loadUserService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await createProfile(USER_ID, 'a@b.com', 'A B', 'plan');

    expect(mockPrisma.profiles.upsert.mock.calls[0][0].create.signup_type).toBe('plan');
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.create.mock.calls[0][0].data.plan_type).toBe('trial');
  });
});

// ---------------------------------------------------------------------------
// W14 — trial branch of `createCheckoutSession`
// ---------------------------------------------------------------------------

describe('BASELINE — trial creation via POST /billing (W14: createCheckoutSession trial branch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'trial-row-1', plan_type: 'trial' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'trial-row-1', plan_type: 'trial' });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * First trial creation on this path: no Stripe involvement at all. A trial row is created
   * with `end_date` left unset (contrast W1, which sets a 7-day window), and the profile's
   * credits are OVERWRITTEN to the trial allowance.
   *
   * The overwrite is allowance implementation "A6" in plan §4.1 terms — a sixth grant
   * behaviour that RESETS rather than stacks.
   */
  it('first trial creation: creates an open-ended trial row and overwrites credits to 30', async () => {
    const { createCheckoutSession } = await loadSubscriptionService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const result = await createCheckoutSession(USER_ID, 'a@b.com', {
      plan_type: 'trial',
      billing_cycle: 'monthly',
    } as any);

    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();

    const created = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      user_id: USER_ID,
      plan_type: 'trial',
      status: 'active',
      amount: 0,
    });
    // No end_date on this path — the trial row is open-ended.
    expect(created.end_date).toBeUndefined();

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 30, credits_seconds: 1800 },
    });

    expect(result).toEqual({ subscription: { id: 'trial-row-1', plan_type: 'trial' } });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   * The behaviour is expected to change during Step 3+ (plan §8A.4 + §4A).
   *
   * Repeated trial creation: the lookup is `findFirst({ where: { user_id } })` with NO
   * plan_type filter, NO status filter and NO ordering. It therefore matches ANY row the user
   * owns — including an active PAID row — and flips it to `plan_type: 'trial'`,
   * `amount: 0`, `end_date: null`, while resetting the user's credits to 30.
   *
   * A paying core/pro subscriber who hits this endpoint is silently downgraded and has their
   * remaining balance destroyed.
   */
  /**
   * FIXED IN STEP 6.
   *
   * WAS: `[DOCUMENTS DEFECT] repeated trial creation flips an existing PAID row to trial and
   * resets credits` — the lookup was `findFirst({ where: { user_id } })`, i.e. ANY row of ANY
   * plan and ANY status, so an active `pro` row was updated to `plan_type: 'trial'`,
   * `amount: 0`, `end_date: null` and the user's balance was reset to 30 minutes. A paying
   * subscriber hitting `POST /billing` was silently downgraded.
   *
   * NOW: the lookup is scoped to the user's ACTIVE TRIAL row (plan §2.1 W14, disposition
   * "Fixed in-scope (§8A)"). A paid row is never matched, so it is never downgraded. With no
   * active trial row present, a new one is created alongside the paid row — the trial+paid
   * coexistence §8A.1 requires (21 production users are in that state).
   *
   * The credit reset is deliberately UNCHANGED — it is overwrite semantics (A6) and belongs to
   * §4A / Gate 8, which is not approved yet.
   */
  it('no longer flips an existing PAID row to trial', async () => {
    const { createCheckoutSession } = await loadSubscriptionService();

    // No active trial row exists; the user's only row is an active pro subscription.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await createCheckoutSession(USER_ID, 'a@b.com', {
      plan_type: 'trial',
      billing_cycle: 'monthly',
    } as any);

    // The lookup is now scoped to the active trial row only.
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { user_id: USER_ID, plan_type: 'trial', status: 'active' },
      orderBy: { created_at: 'desc' },
    });

    // The paid row is never touched; a separate trial row is created instead.
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.create.mock.calls[0][0].data).toMatchObject({
      user_id: USER_ID,
      plan_type: 'trial',
      status: 'active',
    });

    // Credit reset behaviour is unchanged (still A6 overwrite semantics, still §4A work).
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 30, credits_seconds: 1800 },
    });
  });

  /**
   * STEP 6 — the active-trial invariant, sequential scope.
   *
   * An existing ACTIVE TRIAL row is reused and reshaped rather than duplicated.
   */
  it('reuses an existing active trial row instead of creating a second one', async () => {
    const { createCheckoutSession } = await loadSubscriptionService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'trial-row-1',
      plan_type: 'trial',
      status: 'active',
    });

    await createCheckoutSession(USER_ID, 'a@b.com', {
      plan_type: 'trial',
      billing_cycle: 'monthly',
    } as any);

    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
      where: { id: 'trial-row-1' },
      data: {
        plan_type: 'trial',
        status: 'active',
        billing_cycle: 'monthly',
        amount: 0,
        end_date: null,
      },
    });
  });

  /**
   * STEP 6 — reinterpreted, same as the W1 case above: this now documents the RESIDUAL
   * CONCURRENCY gap. Both writers share the canonical helper, so both share the same
   * remaining exposure, which only the partial unique index (§17 Gate 3b) closes.
   */
  it('[REMAINING CONCURRENCY GAP] two callers that both miss the lookup still create two trial rows', async () => {
    const { createCheckoutSession } = await loadSubscriptionService();

    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await createCheckoutSession(USER_ID, 'a@b.com', { plan_type: 'trial', billing_cycle: 'monthly' } as any);
    await createCheckoutSession(USER_ID, 'a@b.com', { plan_type: 'trial', billing_cycle: 'monthly' } as any);

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(2);
  });

  /**
   * STEP 6 — sequential idempotency for this writer.
   */
  it('sequential duplicate trial requests create exactly one trial row', async () => {
    const { createCheckoutSession } = await loadSubscriptionService();

    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'trial-row-1', plan_type: 'trial', status: 'active' });

    await createCheckoutSession(USER_ID, 'a@b.com', { plan_type: 'trial', billing_cycle: 'monthly' } as any);
    await createCheckoutSession(USER_ID, 'a@b.com', { plan_type: 'trial', billing_cycle: 'monthly' } as any);

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledTimes(1);
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * The trial branch does NOT invalidate `userSubscriptionCache`, so `getSubscription` keeps
   * serving the pre-trial value for up to its 30s TTL. Asserted here because the cache is
   * module-level state that a Step 3 refactor could change without noticing.
   */
  it('does not clear the user subscription cache after creating a trial', async () => {
    const service = await loadSubscriptionService();

    // Warm the cache with a pro row.
    mockPrisma.subscriptions.findFirst.mockResolvedValueOnce({
      id: 'paid-row-1',
      plan_type: 'pro',
      status: 'active',
      end_date: null,
    });
    const before = await service.getSubscription(USER_ID);
    expect(before).toMatchObject({ plan_type: 'pro' });

    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'paid-row-1',
      plan_type: 'pro',
      status: 'active',
    });
    await service.createCheckoutSession(USER_ID, 'a@b.com', {
      plan_type: 'trial',
      billing_cycle: 'monthly',
    } as any);

    // Still 'pro' — the cache was never cleared.
    const after = await service.getSubscription(USER_ID);
    expect(after).toMatchObject({ plan_type: 'pro' });
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
