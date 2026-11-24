/**
 * Account-level access to "Add more time", against REAL PostgreSQL.
 *
 * The allowlist is the `session_extensions` row in `feature_flags`. Accounts off it must see no
 * change at all: extensions are refused without touching the session or balance, and Start keeps
 * today's rule even with the global switch on.
 */

import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import {
  createSession,
  endSession,
  extendSession,
  heartbeatSession,
  isSessionExtensionAllowedFor,
} from './sessions.service';
import {
  allowSessionExtensionsFor,
  cleanupIntegrationData,
  clearSessionExtensionsAllowlist,
  createMember,
} from '../../test-integration/factories';

jest.setTimeout(60_000);

const originalFlag = process.env.SESSION_EXTENSIONS_ENABLED;

beforeAll(async () => {
  await cleanupIntegrationData();
  await clearSessionExtensionsAllowlist();
});

beforeEach(() => {
  process.env.SESSION_EXTENSIONS_ENABLED = 'true';
});

afterEach(async () => {
  await cleanupIntegrationData();
  await clearSessionExtensionsAllowlist();
});

afterAll(async () => {
  if (originalFlag === undefined) delete process.env.SESSION_EXTENSIONS_ENABLED;
  else process.env.SESSION_EXTENSIONS_ENABLED = originalFlag;
  await cleanupIntegrationData();
  await clearSessionExtensionsAllowlist();
});

async function sessionAtLimit(userId: string) {
  const session = await prisma.app_sessions.create({
    data: {
      user_id: userId,
      type: 'instant',
      status: 'active',
      duration_minutes: 2,
      billed_seconds: 100,
      started_at: new Date(),
      updated_at: new Date(),
    },
    select: { id: true },
  });
  return session.id;
}

const extend = (userId: string, sessionId: string) =>
  extendSession(userId, sessionId, {
    request_id: randomUUID(),
    expected_limit_minutes: 2,
    add_minutes: 5,
    elapsed_seconds: 120,
  });

async function snapshot(userId: string, sessionId: string) {
  const [session, profile] = await Promise.all([
    prisma.app_sessions.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.profiles.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true, credits_seconds: true, purchased_credits_seconds: true },
    }),
  ]);
  return { session, profile };
}

async function setFlagRow(isEnabled: boolean, targetUsers: unknown) {
  await prisma.feature_flags.upsert({
    where: { name: 'session_extensions' },
    create: { name: 'session_extensions', is_enabled: isEnabled, rules: { targetUsers } as never },
    update: { is_enabled: isEnabled, rules: { targetUsers } as never },
  });
}

describe('who may add time', () => {
  it('an allowlisted account with 5:00 usable can add five minutes', async () => {
    const qa = await createMember('qa', 'core', { credits: 7 });
    await allowSessionExtensionsFor(qa.userId);
    const sessionId = await sessionAtLimit(qa.userId);

    await expect(extend(qa.userId, sessionId)).resolves.toMatchObject({
      approved: true,
      limit_minutes: 7,
    });
  });

  it('refuses an account off the allowlist and changes nothing', async () => {
    const qa = await createMember('qa-listed', 'core', { credits: 200 });
    const outsider = await createMember('outsider', 'core', { credits: 200 });
    await allowSessionExtensionsFor(qa.userId);
    const sessionId = await sessionAtLimit(outsider.userId);
    const before = await snapshot(outsider.userId, sessionId);

    await expect(extend(outsider.userId, sessionId)).resolves.toMatchObject({
      approved: false,
      code: 'NOT_ELIGIBLE',
    });

    // Not even the usage settled at the old limit: the request is refused before any write.
    expect(await snapshot(outsider.userId, sessionId)).toEqual(before);
  });

  it.each([
    ['no flag row', null],
    ['a disabled row', { isEnabled: false, targetUsers: 'self' }],
    ['an empty list', { isEnabled: true, targetUsers: [] }],
    ['a list without this account', { isEnabled: true, targetUsers: ['00000000-0000-4000-a000-000000000000'] }],
  ])('allows nobody with %s', async (_label, row) => {
    const member = await createMember('config', 'core', { credits: 200 });
    if (row) {
      await setFlagRow(row.isEnabled, row.targetUsers === 'self' ? [member.userId] : row.targetUsers);
    }
    const sessionId = await sessionAtLimit(member.userId);
    const before = await snapshot(member.userId, sessionId);

    await expect(isSessionExtensionAllowedFor(member.userId)).resolves.toBe(false);
    await expect(extend(member.userId, sessionId)).resolves.toMatchObject({ code: 'NOT_ELIGIBLE' });
    expect(await snapshot(member.userId, sessionId)).toEqual(before);
  });

  it('allows nobody when the global switch is off, even when listed', async () => {
    const qa = await createMember('qa-off', 'core', { credits: 200 });
    await allowSessionExtensionsFor(qa.userId);
    delete process.env.SESSION_EXTENSIONS_ENABLED;
    const sessionId = await sessionAtLimit(qa.userId);

    await expect(extend(qa.userId, sessionId)).resolves.toMatchObject({ code: 'NOT_ELIGIBLE' });
    expect((await snapshot(qa.userId, sessionId)).session.duration_minutes).toBe(2);
  });
});

describe('removing an account from the allowlist', () => {
  it('stops the next extension, keeps time already approved, and End still saves once', async () => {
    const qa = await createMember('qa-removed', 'core', { credits: 200 });
    await allowSessionExtensionsFor(qa.userId);
    const sessionId = await sessionAtLimit(qa.userId);

    await expect(extend(qa.userId, sessionId)).resolves.toMatchObject({ limit_minutes: 7 });

    await setFlagRow(true, []);

    await expect(
      extendSession(qa.userId, sessionId, {
        request_id: randomUUID(),
        expected_limit_minutes: 7,
        add_minutes: 5,
        elapsed_seconds: 420,
      })
    ).resolves.toMatchObject({ approved: false, code: 'NOT_ELIGIBLE' });

    // Heartbeats and End are untouched by the allowlist: per-second billing up to the approved limit.
    await heartbeatSession(qa.userId, sessionId, 300);
    await endSession(qa.userId, sessionId, 333);
    await endSession(qa.userId, sessionId, 333);

    const { session, profile } = await snapshot(qa.userId, sessionId);
    // End records actual usage in duration_minutes, as it always has.
    expect(session).toMatchObject({ status: 'completed', billed_seconds: 333, duration_minutes: 5 });
    // The allowlisted extension settled 20s; heartbeat and End billed the remaining 213s.
    expect(profile.credits_seconds).toBe(200 * 60 - (333 - 100));
  });
});

describe('Start for accounts off the allowlist', () => {
  it("keeps today's rule even with the global switch on", async () => {
    const qa = await createMember('qa-start', 'core', { credits: 30 });
    const outsider = await createMember('outsider-start', 'core', { credits: 30 });
    await allowSessionExtensionsFor(qa.userId);

    // Two 20-minute Starts on a 30-minute balance: allowed today, so allowed here.
    await createSession(outsider.userId, { type: 'instant', duration_minutes: 20 });
    await expect(
      createSession(outsider.userId, { type: 'instant', duration_minutes: 20 })
    ).resolves.toBeDefined();

    // The allowlisted account gets the shared-balance rule.
    await createSession(qa.userId, { type: 'instant', duration_minutes: 20 });
    await expect(
      createSession(qa.userId, { type: 'instant', duration_minutes: 20 })
    ).rejects.toMatchObject({ statusCode: 409, code: 'MINUTES_HELD_BY_ANOTHER_SESSION' });
  });
});
