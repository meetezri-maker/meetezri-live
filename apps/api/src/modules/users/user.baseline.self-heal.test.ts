/**
 * BASELINE SUITE — Billing Consolidation, Step 2.
 *
 * Purpose: capture the `/users/me` billing self-heal behaviour EXACTLY as it exists today
 * (BILLING_CONSOLIDATION_IMPLEMENTATION_PLAN.md §12.1, task requirement 4).
 *
 * Both reconciliation paths in `user.service.getProfile` are documented:
 *   W5 — cache-hit  self-heal (`user.service.ts:1014-1020`)
 *   W6 — cold-load  self-heal (`user.service.ts:1111-1124`)
 *
 * Today BOTH fire on the same trigger: the resolved plan reads `trial` AND the profile has a
 * `stripe_customer_id`. Plan §10.4 replaces that with an eligibility rule during a later step.
 * NOTHING in that rule is implemented or asserted here — these tests record only when
 * reconciliation is attempted TODAY.
 *
 * Where a test documents behaviour the plan classifies as defective the name is prefixed
 * `[DOCUMENTS DEFECT]`.
 *
 * No production code is modified by this file.
 */

const mockSyncSubscriptionWithStripe = jest.fn();

const mockPrisma = {
  profiles: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  subscriptions: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  appointments: { count: jest.fn() },
  users: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../billing', () => ({
  syncSubscriptionWithStripe: mockSyncSubscriptionWithStripe,
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

const USER_ID = 'user-selfheal-baseline';

/** Reload per test so `userProfileCache` never leaks between cases. */
async function loadUserService() {
  jest.resetModules();
  return import('./user.service');
}

/**
 * @param subscriptions rows returned by the cold-load `include` (already filtered by
 *   `status IN ('active','trialing','past_due')` in production).
 */
function profileFixture(opts: {
  stripeCustomerId?: string | null;
  subscriptions?: any[];
}) {
  return {
    id: USER_ID,
    email: 'a@b.com',
    full_name: 'A B',
    role: 'user',
    bio: null,
    credits: 30,
    credits_seconds: 1800,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
    stripe_customer_id: opts.stripeCustomerId ?? null,
    signup_type: 'trial',
    onboarding_completed: true,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    subscriptions: opts.subscriptions ?? [],
    emergency_contacts: [],
    mood_entries: [],
    _count: { app_sessions: 0, mood_entries: 0, journal_entries: 0 },
  };
}

function activeSubscriptionRow(planType: string, overrides: Record<string, any> = {}) {
  return {
    id: `row-${planType}`,
    user_id: USER_ID,
    plan_type: planType,
    status: 'active',
    stripe_sub_id: planType === 'trial' ? null : 'sub_baseline',
    start_date: new Date(),
    end_date: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('BASELINE — /users/me self-heal: cold-load path (W6, user.service.ts:1111)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockSyncSubscriptionWithStripe.mockResolvedValue(undefined);
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * TRIGGER, as it exists today: resolved plan is `trial` AND `stripe_customer_id` is set.
   * That is the only condition. Reconciliation then runs INLINE — the `/users/me` response is
   * blocked on a customer-wide Stripe round-trip — and the subscription row is re-read
   * afterwards.
   *
   * Plan §10.4 replaces this trigger with an eligibility rule during a later step.
   */
  it('reconciles inline when the plan reads trial and a stripe_customer_id exists', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledWith(USER_ID);
    // The row is re-read after the sync.
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { user_id: USER_ID, status: { in: ['active', 'trialing', 'past_due'] } },
      orderBy: { created_at: 'desc' },
    });
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * The trigger fires when NO active subscription row exists at all, because
   * `maybePlanType` defaults to `'trial'` when `activeSubscription` is undefined
   * (`user.service.ts:1110`).
   */
  it('reconciles when the user has no active subscription row but does have a stripe_customer_id', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [] })
    );

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
  });

  it('does not reconcile when the profile has no stripe_customer_id', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: null, subscriptions: [activeSubscriptionRow('trial')] })
    );

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
  });

  it('does not reconcile when an active paid subscription is already present', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('pro')] })
    );

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * A sync failure is swallowed (`try/catch` at :1121-1123) and the profile read still
   * succeeds from local state. Plan §10.5 keeps this behaviour deliberately.
   */
  it('swallows reconciliation failures and still returns the profile', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );
    mockSyncSubscriptionWithStripe.mockRejectedValue(new Error('stripe down'));

    const result = await getProfile(USER_ID);

    expect(result).toMatchObject({ id: USER_ID, subscription_plan: 'trial' });
  });

  /**
   * FIXED IN STEP 6.
   *
   * WAS: `[DOCUMENTS DEFECT] a canceled subscriber reconciles on every cold load, forever` —
   * `handleSubscriptionDeleted` labels a churned subscriber `plan_type: 'trial'` while the
   * profile keeps its `stripe_customer_id`, and the canceled row is filtered out of the
   * cold-load include, so the old trigger ("plan reads trial AND a customer exists") was
   * satisfied permanently. Three reads produced three customer-wide Stripe calls.
   *
   * NOW: eligibility asks "is there an unlinked-but-should-be-linked state" (plan §10.4). A row
   * that carries a `stripe_sub_id` and reads `canceled` is churn, not incomplete linkage, so
   * the user is ineligible — `skip_canceled` — and no Stripe call is made, on any number of
   * reads.
   *
   * Note this holds REGARDLESS of the W9 cancellation mislabel, which is untouched by Step 6:
   * the decision keys off the linked row's status, not its `plan_type`. The two fixes are
   * belt-and-suspenders, exactly as §10.4 intends.
   */
  it('a canceled subscriber never reconciles, on any number of reads', async () => {
    const { getProfile, invalidateUserProfileCache } = await loadUserService();

    // Churned user: canceled row (filtered out of the include), stripe_customer_id retained.
    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_churned', subscriptions: [] })
    );
    // The eligibility probe finds the row that WAS linked to Stripe, now canceled.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      status: 'canceled',
      created_at: new Date(),
    });

    await getProfile(USER_ID);
    invalidateUserProfileCache(USER_ID);
    await getProfile(USER_ID);
    invalidateUserProfileCache(USER_ID);
    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
  });

  /**
   * FIXED IN STEP 6.
   *
   * WAS: `[DOCUMENTS DEFECT] concurrent profile reads fan out into N reconciliations` — three
   * concurrent reads produced three concurrent customer-wide reconciliations, the amplifier
   * behind the March duplicate groups.
   *
   * NOW: in-process single-flight collapses them onto one promise.
   *
   * IMPORTANT — this is duplicate REDUCTION, not a correctness guarantee (plan §10.2). The API
   * runs one process per instance, so two instances can still each start a sync. What makes
   * concurrent syncs safe is the database constraint, which is not added yet.
   */
  it('concurrent profile reads collapse onto a single reconciliation (per-process)', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );
    // Never linked: a Stripe customer exists but no row carries a stripe_sub_id.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await Promise.all([getProfile(USER_ID), getProfile(USER_ID), getProfile(USER_ID)]);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
  });

  /**
   * STEP 6 — an interrupted checkout is still recoverable, but only inside a bounded window.
   */
  it('reconciles an interrupted checkout inside the recovery window', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [] })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      status: 'incomplete',
      created_at: new Date(),
    });

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
  });

  it('does not reconcile an interrupted checkout that has aged out of the window', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [] })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      status: 'incomplete',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h old
    });

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
  });

  /**
   * STEP 6 — a user already linked to a live Stripe subscription has nothing to heal.
   */
  it('does not reconcile a user already linked to a live Stripe subscription', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [] })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      status: 'active',
      created_at: new Date(),
    });

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
  });

  /**
   * STEP 6 — the common trial user costs nothing: with no Stripe customer the eligibility
   * probe never touches the database.
   */
  it('performs no eligibility query for a trial user with no Stripe customer', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: null, subscriptions: [activeSubscriptionRow('trial')] })
    );

    await getProfile(USER_ID);

    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.findFirst).not.toHaveBeenCalled();
  });
});

describe('BASELINE — /users/me self-heal: cache-hit path (W5, user.service.ts:1014)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.appointments.count.mockResolvedValue(0);
    mockPrisma.users.findUnique.mockResolvedValue({
      email_confirmed_at: new Date(),
      raw_user_meta_data: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ total: 0 }]);
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockSyncSubscriptionWithStripe.mockResolvedValue(undefined);
  });

  /**
   * FIXED IN STEP 6.
   *
   * WAS: `[DOCUMENTS DEFECT] a single warm request reconciles TWICE` — the cache-hit branch
   * fired and awaited a sync, then, because it never assigned `result`, execution fell through
   * to the cold-load path whose own trigger was still satisfied and reconciled again. Three
   * reads cost five customer-wide Stripe calls (1 cold + 2 + 2).
   *
   * NOW: eligibility is evaluated at most ONCE per request — the cold path skips its own
   * evaluation when the cache-hit branch already decided — and the cooldown suppresses
   * re-attempts inside the window. Three reads cost exactly one Stripe call.
   */
  it('reconciles at most once per request, and once across repeated reads', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await getProfile(USER_ID); // cold load → 1 reconciliation
    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);

    await getProfile(USER_ID); // warm read → suppressed by cooldown
    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);

    await getProfile(USER_ID); // and still suppressed
    expect(mockSyncSubscriptionWithStripe).toHaveBeenCalledTimes(1);
  });

  /**
   * FIXED IN STEP 6.
   *
   * WAS: `[DOCUMENTS DEFECT] the cache-hit self-heal discards the cache and performs a full
   * cold reload` — a cache hit for these users was strictly SLOWER than a miss: it awaited a
   * blocking Stripe round-trip and then issued the complete set of cold-load queries anyway.
   *
   * NOW: a cache hit always returns the cached value. Any eligible reconciliation is started
   * out of band (plan §10.5, "Non-blocking"), so the response never waits on Stripe and the
   * second read issues no `profiles.findUnique` at all.
   */
  it('serves a cache hit from cache without a cold reload, even when reconciliation is eligible', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await getProfile(USER_ID);
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(1);

    await getProfile(USER_ID);
    // A genuine cache hit: no second profile load, no second appointments count.
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.appointments.count).toHaveBeenCalledTimes(1);
  });

  /**
   * Current behaviour. This test intentionally documents existing behaviour.
   *
   * The control case: a cached PAID plan short-circuits. No reconciliation, and the second
   * read is served entirely from the in-process cache with no database work at all.
   */
  it('serves a cached paid plan without reconciling and without any database work', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('core')] })
    );

    await getProfile(USER_ID);
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(1);

    await getProfile(USER_ID);
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(1);
    expect(mockSyncSubscriptionWithStripe).not.toHaveBeenCalled();
  });

  /**
   * STEP 6 — updated consequence, same guarantee.
   *
   * WAS: the failure was swallowed but the request still fell through to a full cold reload,
   * so it cost a Stripe round-trip and bought nothing (2 × `profiles.findUnique`).
   * NOW: the cached value is returned immediately and the failing sync happens out of band.
   * A reconciliation failure still never fails the profile read (plan §10.5, unchanged).
   */
  it('a failing reconciliation never fails the profile read', async () => {
    const { getProfile } = await loadUserService();

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockSyncSubscriptionWithStripe.mockRejectedValue(new Error('stripe down'));

    const first = await getProfile(USER_ID);
    const second = await getProfile(USER_ID);

    expect(first).toMatchObject({ id: USER_ID });
    expect(second).toMatchObject({ id: USER_ID });
    // The warm read was served from cache, not reloaded.
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(1);
  });

  /**
   * Self-heal calls `import * as billingService from '../billing'`
   * (`user.service.ts:6`). STEP 10: `billing.service` is now a thin wrapper
   * (`export * from './index'`), so this call resolves to the CANONICAL
   * `syncSubscriptionWithStripe`. The import path is unchanged (the wrapper preserves it),
   * which is why this mock still intercepts; only the implementation behind it is now canonical.
   */
  it('reconciliation is routed through billing.service (now the canonical wrapper)', async () => {
    const { getProfile } = await loadUserService();
    const billingService = await import('../billing');

    mockPrisma.profiles.findUnique.mockResolvedValue(
      profileFixture({ stripeCustomerId: 'cus_1', subscriptions: [activeSubscriptionRow('trial')] })
    );

    await getProfile(USER_ID);

    expect(billingService.syncSubscriptionWithStripe).toHaveBeenCalledWith(USER_ID);
  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
