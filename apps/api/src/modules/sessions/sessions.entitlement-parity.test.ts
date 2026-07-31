/**
 * PHASE 1B — session-start gate characterization / parity suite.
 *
 * Written and made green against the PRE-migration implementation (direct
 * `prisma.subscriptions.findMany` + inline trial-expiry policy), then re-run unchanged against
 * the POST-migration implementation (`getMembershipEntitlements`). Identical assertions passing
 * on both sides is the equivalence proof for Part 4.
 *
 * HOW IT STAYS AGNOSTIC TO THE IMPLEMENTATION
 *   Both subscription access shapes are mocked with the SAME underlying row:
 *     - `subscriptions.findMany`  — what the old code called
 *     - `subscriptions.findFirst` — what `billing.getSubscription()` calls
 *   So the suite never encodes which path is taken, only what the gate decides.
 *
 *   Every case uses a DISTINCT user id: `getSubscription` memoizes per user for 30s, and shared
 *   ids would leak one case's membership into the next.
 *
 * Assertions cover the exact 400 status code and the exact message strings, because the brief
 * requires error codes and messages to be preserved verbatim.
 */

const mockPrisma = {
  profiles: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  subscriptions: { findFirst: jest.fn(), findMany: jest.fn() },
  app_sessions: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  session_messages: { createMany: jest.fn() },
  users: { findUnique: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn().mockResolvedValue(1),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../system-achievements/system-achievements.triggers', () => ({
  onUserActivity: jest.fn().mockResolvedValue(null),
}));
jest.mock('../email/email.service', () => ({ emailService: { sendEmail: jest.fn() } }));

import { createSession } from './sessions.service';

const NOW_MS = Date.now();
const PAST = new Date(NOW_MS - 7 * 24 * 60 * 60 * 1000);
const FUTURE = new Date(NOW_MS + 7 * 24 * 60 * 60 * 1000);

const TRIAL_EXPIRED_MESSAGE = 'Your trial has expired. Please upgrade to continue.';
const NO_PROFILE_MESSAGE = 'User profile not found. Please complete onboarding first.';

let userSeq = 0;
/** Distinct id per case so the 30s `getSubscription` cache cannot bleed across tests. */
function nextUserId(label: string): string {
  userSeq += 1;
  return `parity-${label}-${userSeq}`;
}

/**
 * Build a profile with exactly `seconds` of balance.
 *
 * `credits` is floored, never ceiled: `resolveBucketSeconds` takes the MAX of the whole-minute
 * and sub-minute columns, so a ceiled `credits` would silently round the balance UP and make a
 * sub-minute fixture unrepresentable.
 */
function balance(seconds: number) {
  return {
    id: 'profile',
    credits: Math.floor(seconds / 60),
    credits_seconds: seconds,
    purchased_credits: 0,
    purchased_credits_seconds: 0,
  };
}

/**
 * Present one subscription row through BOTH access shapes.
 * `row === null` means the user has no subscription at all.
 */
function arrange(options: { profile: unknown; row: Record<string, unknown> | null }) {
  mockPrisma.profiles.findUnique.mockResolvedValue(options.profile);
  mockPrisma.subscriptions.findFirst.mockResolvedValue(options.row);
  // The old path filtered on `status: 'active'`; emulate that filter faithfully.
  const activeRows =
    options.row && options.row.status === 'active' ? [options.row] : [];
  mockPrisma.subscriptions.findMany.mockResolvedValue(activeRows);
  mockPrisma.app_sessions.create.mockResolvedValue({ id: 'session-1', type: 'instant' });
}

function startSession(userId: string, minutes = 5) {
  return createSession(userId, { type: 'instant', duration_minutes: minutes } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$executeRaw.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// Required parity cases
// ---------------------------------------------------------------------------

describe('session-start gate — parity', () => {
  it('CASE 1 — active Discover/trial with balance: allowed', async () => {
    const userId = nextUserId('discover-with-balance');
    arrange({
      profile: balance(1800),
      row: { plan_type: 'trial', status: 'active', end_date: FUTURE },
    });

    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
    expect(mockPrisma.app_sessions.create).toHaveBeenCalledTimes(1);
  });

  it('CASE 2 — active Discover/trial without balance: rejected as insufficient credits', async () => {
    const userId = nextUserId('discover-no-balance');
    arrange({
      profile: balance(0),
      row: { plan_type: 'trial', status: 'active', end_date: FUTURE },
    });

    await expect(startSession(userId, 5)).rejects.toMatchObject({ statusCode: 400 });
    // The zero-balance path must NOT be reported as expiry — different remediation for the user.
    await expect(startSession(userId, 5)).rejects.toThrow(/Insufficient credits/);
    expect(mockPrisma.app_sessions.create).not.toHaveBeenCalled();
  });

  it('CASE 2b — insufficient-credits message keeps its exact numbers', async () => {
    const userId = nextUserId('discover-partial-balance');
    arrange({
      profile: balance(90), // 1 full minute, 90s
      row: { plan_type: 'trial', status: 'active', end_date: FUTURE },
    });

    await expect(startSession(userId, 5)).rejects.toThrow(
      'Insufficient credits. You requested 5 minutes for this session but only have 1 full minutes available (90s). Shorten the session or upgrade your plan.'
    );
  });

  it('CASE 3 — expired Discover/trial: rejected as trial expired', async () => {
    const userId = nextUserId('discover-expired');
    arrange({
      profile: balance(1800), // balance is healthy; expiry is what blocks
      row: { plan_type: 'trial', status: 'active', end_date: PAST },
    });

    await expect(startSession(userId)).rejects.toMatchObject({
      message: TRIAL_EXPIRED_MESSAGE,
      statusCode: 400,
    });
    expect(mockPrisma.app_sessions.create).not.toHaveBeenCalled();
  });

  it('CASE 4 — active Grow with balance: allowed', async () => {
    const userId = nextUserId('grow');
    arrange({
      profile: balance(12000),
      row: { plan_type: 'core', status: 'active', end_date: FUTURE },
    });

    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
  });

  it('CASE 5 — active Thrive with balance: allowed', async () => {
    const userId = nextUserId('thrive');
    arrange({
      profile: balance(24000),
      row: { plan_type: 'pro', status: 'active', end_date: FUTURE },
    });

    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
  });

  it('CASE 6 — canceled but still in-period paid membership: allowed', async () => {
    const userId = nextUserId('canceled-in-period');
    arrange({
      profile: balance(12000),
      row: { plan_type: 'pro', status: 'canceled', end_date: FUTURE },
    });

    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
  });

  it('CASE 7 — missing subscription with balance: allowed', async () => {
    const userId = nextUserId('no-subscription');
    arrange({ profile: balance(1800), row: null });

    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
  });

  it('CASE 8 — malformed/unknown plan value: allowed, no new restriction', async () => {
    const userId = nextUserId('unknown-plan');
    arrange({
      profile: balance(1800),
      row: { plan_type: 'enterprise', status: 'active', end_date: FUTURE },
    });

    // An unrecognized plan must not become a lockout: today it silently grants access, and this
    // task is not permitted to introduce a customer-visible restriction.
    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
  });

  it('CASE 9 — end_date exactly equal to now: NOT expired', async () => {
    // Time is frozen: without this the gate reads `new Date()` a few microseconds after the
    // fixture is built, so `end_date` lands marginally in the past and the case under test —
    // exact equality — is never actually exercised.
    const boundary = new Date('2026-07-28T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(boundary);

    try {
      const userId = nextUserId('boundary');
      arrange({
        profile: balance(1800),
        row: { plan_type: 'trial', status: 'active', end_date: new Date(boundary) },
      });

      // Production uses strict comparisons (`now > end_date`), so equality is still entitled.
      await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
    } finally {
      jest.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// Surrounding behaviour that must not shift
// ---------------------------------------------------------------------------

describe('session-start gate — preserved surrounding behaviour', () => {
  it('rejects a missing profile before any membership decision', async () => {
    const userId = nextUserId('no-profile');
    arrange({ profile: null, row: null });

    await expect(startSession(userId)).rejects.toMatchObject({
      message: NO_PROFILE_MESSAGE,
      statusCode: 400,
    });
  });

  it('expired trial takes precedence over a zero balance', async () => {
    const userId = nextUserId('expired-and-broke');
    arrange({
      profile: balance(0),
      row: { plan_type: 'trial', status: 'active', end_date: PAST },
    });

    // Ordering is observable to the user through the message, so it is pinned.
    await expect(startSession(userId)).rejects.toMatchObject({
      message: TRIAL_EXPIRED_MESSAGE,
    });
  });

  it('an expired paid row that is still `active` stays entitled (webhook drift, not a lapse)', async () => {
    const userId = nextUserId('paid-drift');
    arrange({
      profile: balance(12000),
      row: { plan_type: 'core', status: 'active', end_date: PAST },
    });

    // Pre-migration: `hasActivePaidSubscription` short-circuits the expiry check entirely.
    // Post-migration: live-row expiry is DISCOVER-scoped. Same outcome, by construction.
    await expect(startSession(userId)).resolves.toMatchObject({ id: 'session-1' });
  });

  it('honours the requested duration when sizing the balance check', async () => {
    const userId = nextUserId('duration');
    arrange({
      profile: balance(600), // 10 minutes
      row: { plan_type: 'core', status: 'active', end_date: FUTURE },
    });

    await expect(startSession(userId, 10)).resolves.toMatchObject({ id: 'session-1' });

    const stricter = nextUserId('duration-over');
    arrange({
      profile: balance(600),
      row: { plan_type: 'core', status: 'active', end_date: FUTURE },
    });
    await expect(startSession(stricter, 11)).rejects.toThrow(/Insufficient credits/);
  });

  it('defaults to a 5-minute requirement when no duration is given', async () => {
    const userId = nextUserId('default-duration');
    arrange({
      profile: balance(240), // 4 minutes — below the 5-minute default
      row: { plan_type: 'core', status: 'active', end_date: FUTURE },
    });

    await expect(
      createSession(userId, { type: 'instant' } as any)
    ).rejects.toThrow(/You requested 5 minutes/);
  });
});
