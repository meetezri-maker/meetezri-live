import Fastify from 'fastify';
import {
  buildSignupTypeEvidence,
  resolveNeedsOnboarding,
  resolveSignupType,
} from '../modules/users/signupType';

/**
 * Proves the auth middleware and GET /users/me reach the SAME conclusion for the same
 * user. Before this phase auth.ts ran its own chain that stopped at auth metadata and
 * left signup_type null, so an OAuth user /users/me called 'trial' was 403'd out of
 * every app API by the middleware.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn(), updateMany: jest.fn() },
  users: { findUnique: jest.fn() },
  subscriptions: { findFirst: jest.fn() },
};

jest.mock('../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

/** A profile row shaped like auth.ts's select. */
function profileRow(over: Record<string, unknown> = {}) {
  return {
    role: 'user',
    permissions: {},
    full_name: 'Test User',
    selected_goals: [],
    emergency_contact_relationship: '',
    notification_preferences: {},
    timezone: '',
    signup_type: null,
    stripe_customer_id: null,
    account_status: 'active',
    onboarding_completed: false,
    ...over,
  };
}

/** Hit an app API through the real middleware; returns the status code. */
async function callAppApi(userId: string) {
  jest.resetModules();
  const authPlugin = (await import('./auth')).default;
  const app = Fastify();
  app.decorateRequest('jwtVerify', async function () {
    (this as any).user = { sub: userId };
    return true;
  });
  await app.register(authPlugin);
  app.get('/api/moods', {
    preHandler: [app.authenticate],
    handler: async () => ({ ok: true }),
  });
  const res = await app.inject({
    method: 'GET',
    url: '/api/moods',
    headers: { authorization: 'Bearer fake-token' },
  });
  await app.close();
  return res.statusCode;
}

/** What GET /users/me would conclude from the same inputs. */
function usersMeVerdict(profile: any, subscriptionPlan: string | null, authMeta: any = null) {
  const evidence = buildSignupTypeEvidence(
    {
      signup_type: profile.signup_type,
      subscription_plan: subscriptionPlan,
      stripe_customer_id: profile.stripe_customer_id,
    },
    authMeta,
  );
  const { signupType } = resolveSignupType(evidence);
  return {
    signup_type: signupType,
    needs_onboarding: resolveNeedsOnboarding(signupType, profile.onboarding_completed === true),
  };
}

function arrange(profile: any, subscriptionPlan: string | null, authMeta: any = null) {
  jest.clearAllMocks();
  mockPrisma.profiles.findUnique.mockResolvedValue(profile);
  mockPrisma.profiles.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.users.findUnique.mockResolvedValue({ raw_user_meta_data: authMeta });
  mockPrisma.subscriptions.findFirst.mockResolvedValue(
    subscriptionPlan ? { plan_type: subscriptionPlan } : null,
  );
}

describe('auth middleware agrees with GET /users/me', () => {
  it('admits an explicit trial user to app APIs', async () => {
    const p = profileRow({ signup_type: 'trial' });
    arrange(p, 'trial');

    expect(usersMeVerdict(p, 'trial')).toEqual({ signup_type: 'trial', needs_onboarding: false });
    await expect(callAppApi('u-trial')).resolves.toBe(200);
  });

  it('THE FIX: admits an OAuth user with null signup_type + trial subscription', async () => {
    // The Phase 5 cohort: 16 live rows, no auth metadata, trial subscription only.
    // /users/me says trial -> frontend shows the dashboard. The middleware used to
    // resolve null here and 403 every app API. Both must now say trial.
    const p = profileRow({ signup_type: null, stripe_customer_id: null });
    arrange(p, 'trial', null);

    expect(usersMeVerdict(p, 'trial', null)).toEqual({
      signup_type: 'trial',
      needs_onboarding: false,
    });
    await expect(callAppApi('u-oauth-null')).resolves.toBe(200);
  });

  it('admits a legacy trial user whose onboarding fields are empty', async () => {
    // 98 of 114 live trial rows have no timezone; they must still reach the app.
    const p = profileRow({ signup_type: 'trial', timezone: '', emergency_contact_relationship: '' });
    arrange(p, 'trial');

    expect(usersMeVerdict(p, 'trial').needs_onboarding).toBe(false);
    await expect(callAppApi('u-trial-bare')).resolves.toBe(200);
  });

  it('resolves signup_type from auth metadata when the column is null', async () => {
    const p = profileRow({ signup_type: null });
    arrange(p, 'trial', { signup_type: 'plan' });

    expect(usersMeVerdict(p, 'trial', { signup_type: 'plan' })).toEqual({
      signup_type: 'plan',
      needs_onboarding: true,
    });
    // Metadata says paid + onboarding incomplete -> still gated.
    await expect(callAppApi('u-meta-plan')).resolves.toBe(403);
  });
});

describe('paid gating is preserved', () => {
  it('blocks an explicit paid user with incomplete onboarding', async () => {
    const p = profileRow({ signup_type: 'plan', onboarding_completed: false });
    arrange(p, 'core');

    expect(usersMeVerdict(p, 'core')).toEqual({ signup_type: 'plan', needs_onboarding: true });
    await expect(callAppApi('u-plan-incomplete')).resolves.toBe(403);
  });

  it('admits an explicit paid user who has completed onboarding', async () => {
    const p = profileRow({ signup_type: 'plan', onboarding_completed: true });
    arrange(p, 'core');

    expect(usersMeVerdict(p, 'core')).toEqual({ signup_type: 'plan', needs_onboarding: false });
    await expect(callAppApi('u-plan-complete')).resolves.toBe(200);
  });

  it('REGRESSION GUARD: a legacy paid user (null signup_type + Stripe customer) stays gated', async () => {
    // If auth.ts did not read stripe_customer_id, the resolver would fall through to the
    // trial default and silently open the paid onboarding gate.
    const p = profileRow({ signup_type: null, stripe_customer_id: 'cus_123' });
    arrange(p, 'trial', null);

    expect(usersMeVerdict(p, 'trial', null)).toEqual({
      signup_type: 'plan',
      needs_onboarding: true,
    });
    await expect(callAppApi('u-legacy-paid')).resolves.toBe(403);
  });

  it('REGRESSION GUARD: a legacy paid user with a core subscription stays gated', async () => {
    const p = profileRow({ signup_type: null, stripe_customer_id: null });
    arrange(p, 'core', null);

    expect(usersMeVerdict(p, 'core', null).signup_type).toBe('plan');
    await expect(callAppApi('u-legacy-core')).resolves.toBe(403);
  });

  it('never lets a trial subscription downgrade an explicit plan', async () => {
    // Expired paid package: subscription_plan falls back to trial.
    const p = profileRow({ signup_type: 'plan', onboarding_completed: false });
    arrange(p, 'trial');

    expect(usersMeVerdict(p, 'trial').signup_type).toBe('plan');
    await expect(callAppApi('u-expired-plan')).resolves.toBe(403);
  });
});

describe('unrelated middleware behaviour is unchanged', () => {
  it('still blocks an inactive account from app APIs', async () => {
    const p = profileRow({ signup_type: 'trial', account_status: 'inactive' });
    arrange(p, 'trial');
    await expect(callAppApi('u-inactive')).resolves.toBe(403);
  });

  it('still lets an admin bypass the onboarding gate', async () => {
    const p = profileRow({ signup_type: 'plan', role: 'super_admin', onboarding_completed: false });
    arrange(p, 'core');
    await expect(callAppApi('u-admin')).resolves.toBe(200);
  });

  it('still blocks app APIs when the profile is missing', async () => {
    jest.clearAllMocks();
    mockPrisma.profiles.findUnique.mockResolvedValue(null);
    mockPrisma.users.findUnique.mockResolvedValue(null);
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    await expect(callAppApi('u-no-profile')).resolves.toBe(403);
  });
});
