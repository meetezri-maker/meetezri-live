/**
 * "Add more time" approval against REAL PostgreSQL.
 *
 * Nothing is mocked. Concurrency comes from issuing service calls without awaiting each other, over
 * parallel Prisma connections, and every assertion reads database state.
 */

import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import { endSession, extendSession, heartbeatSession } from './sessions.service';
import {
  allowSessionExtensionsFor,
  cleanupIntegrationData,
  clearSessionExtensionsAllowlist,
  createMember,
} from '../../test-integration/factories';

jest.setTimeout(60_000);

const originalFlag = process.env.SESSION_EXTENSIONS_ENABLED;

beforeAll(async () => {
  process.env.SESSION_EXTENSIONS_ENABLED = 'true';
  await cleanupIntegrationData();
});

afterEach(async () => {
  await cleanupIntegrationData();
  await clearSessionExtensionsAllowlist();
});

afterAll(async () => {
  if (originalFlag === undefined) delete process.env.SESSION_EXTENSIONS_ENABLED;
  else process.env.SESSION_EXTENSIONS_ENABLED = originalFlag;
  await cleanupIntegrationData();
});

/** Members created here are on the `session_extensions` allowlist, like the QA account. */
async function allowedMember(...args: Parameters<typeof createMember>) {
  const member = await createMember(...args);
  await allowSessionExtensionsFor(member.userId);
  return member;
}

async function createActiveSession(
  userId: string,
  overrides: { minutes?: number | null; billed?: number; lastActivity?: Date } = {}
) {
  const lastActivity = overrides.lastActivity ?? new Date();
  const session = await prisma.app_sessions.create({
    data: {
      user_id: userId,
      type: 'instant',
      status: 'active',
      duration_minutes: overrides.minutes === undefined ? 20 : overrides.minutes,
      billed_seconds: overrides.billed ?? 1200,
      started_at: lastActivity,
      updated_at: lastActivity,
    },
    select: { id: true },
  });
  return session.id;
}

async function balanceSeconds(userId: string): Promise<number> {
  const profile = await prisma.profiles.findUniqueOrThrow({
    where: { id: userId },
    select: { credits_seconds: true },
  });
  return Number(profile.credits_seconds ?? 0);
}

const sessionRow = (id: string) => prisma.app_sessions.findUniqueOrThrow({ where: { id } });

const request = (overrides: Partial<Parameters<typeof extendSession>[2]> = {}) => ({
  request_id: randomUUID(),
  expected_limit_minutes: 20,
  add_minutes: 10,
  elapsed_seconds: 1200,
  ...overrides,
});

describe('approval and accounting', () => {
  it('raises 20 to 30 minutes without resetting usage or deducting unused time', async () => {
    const member = await allowedMember('extend-basic', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);

    const result = await extendSession(member.userId, sessionId, request());

    expect(result).toMatchObject({
      approved: true,
      replayed: false,
      limit_minutes: 30,
      limit_seconds: 1800,
      billed_seconds: 1200,
      balance_seconds: 200 * 60,
      available_seconds: 190 * 60,
    });
    const row = await sessionRow(sessionId);
    expect(row.duration_minutes).toBe(30);
    expect(row.billed_seconds).toBe(1200);
    expect(row.status).toBe('active');
    expect(await balanceSeconds(member.userId)).toBe(200 * 60);
  });

  it('settles usage not yet billed at the old limit before checking the balance', async () => {
    const member = await allowedMember('extend-settle', 'core', { credits: 10 });
    const sessionId = await createActiveSession(member.userId, { billed: 1140 });

    // 600s of balance, 60s of it still owed: only 540s can be approved.
    const rejected = await extendSession(member.userId, sessionId, request());
    expect(rejected).toMatchObject({
      approved: false,
      code: 'INSUFFICIENT_BALANCE',
      available_seconds: 540,
      limit_minutes: 20,
    });
    const row = await sessionRow(sessionId);
    expect(row.billed_seconds).toBe(1200);
    expect(row.duration_minutes).toBe(20);
    expect(await balanceSeconds(member.userId)).toBe(540);

    await expect(
      extendSession(member.userId, sessionId, request({ add_minutes: 9 }))
    ).resolves.toMatchObject({ approved: true, limit_minutes: 29 });
  });

  it('bills only what is used after the extension, cumulatively', async () => {
    const member = await allowedMember('extend-usage', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);

    await extendSession(member.userId, sessionId, request());
    await heartbeatSession(member.userId, sessionId, 1500);
    await endSession(member.userId, sessionId, 1560);

    expect(await balanceSeconds(member.userId)).toBe(200 * 60 - 360);
    expect(await sessionRow(sessionId)).toMatchObject({ status: 'completed', billed_seconds: 1560 });
  });

  it('caps billing at the new limit and allows repeated extensions', async () => {
    const member = await allowedMember('extend-multi', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);

    await extendSession(member.userId, sessionId, request());
    await heartbeatSession(member.userId, sessionId, 1800);
    await expect(
      extendSession(
        member.userId,
        sessionId,
        request({ expected_limit_minutes: 30, add_minutes: 5, elapsed_seconds: 1800 })
      )
    ).resolves.toMatchObject({ approved: true, limit_minutes: 35 });
    await endSession(member.userId, sessionId, 9_999);

    expect(await balanceSeconds(member.userId)).toBe(200 * 60 - (2100 - 1200));
  });

  it.each([
    ['still has time left', { elapsed_seconds: 1199 }, 'NOT_AT_LIMIT'],
    ['stale limit', { expected_limit_minutes: 15 }, 'EXTENSION_STALE'],
    ['longer than the session maximum', { add_minutes: 120, expected_limit_minutes: 400, elapsed_seconds: 24_000 }, 'LIMIT_EXCEEDED'],
  ])('rejects a request that is %s', async (_label, overrides, code) => {
    const member = await allowedMember(`extend-reject-${code}`, 'core', { credits: 900 });
    const sessionId = await createActiveSession(member.userId, {
      minutes: code === 'LIMIT_EXCEEDED' ? 400 : 20,
      billed: code === 'LIMIT_EXCEEDED' ? 24_000 : 1200,
    });

    await expect(
      extendSession(member.userId, sessionId, request(overrides))
    ).resolves.toMatchObject({ approved: false, code });
  });

  it('rejects sessions without a selected length, ended sessions and expired trials', async () => {
    const member = await allowedMember('extend-ineligible', 'core', { credits: 200 });
    const noLimit = await createActiveSession(member.userId, { minutes: null });
    await expect(extendSession(member.userId, noLimit, request())).resolves.toMatchObject({
      code: 'NOT_ELIGIBLE',
    });

    const ended = await createActiveSession(member.userId);
    await endSession(member.userId, ended, 1200);
    await expect(extendSession(member.userId, ended, request())).resolves.toMatchObject({
      code: 'SESSION_NOT_ACTIVE',
    });

    const trial = await allowedMember('extend-trial', 'trial', { credits: 200 });
    await prisma.subscriptions.updateMany({
      where: { user_id: trial.userId },
      data: { end_date: new Date(Date.now() - 60_000) },
    });
    const trialSession = await createActiveSession(trial.userId);
    await expect(extendSession(trial.userId, trialSession, request())).resolves.toMatchObject({
      code: 'TRIAL_EXPIRED',
    });
  });

  it("refuses another member's session", async () => {
    const owner = await allowedMember('extend-owner', 'core', { credits: 200 });
    const other = await allowedMember('extend-other', 'core', { credits: 200 });
    const sessionId = await createActiveSession(owner.userId);

    await expect(extendSession(other.userId, sessionId, request())).rejects.toThrow(
      'Session not found'
    );
    expect((await sessionRow(sessionId)).duration_minutes).toBe(20);
  });
});

describe('retries', () => {
  it('replays an identical retry without adding time twice', async () => {
    const member = await allowedMember('extend-retry', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);
    const same = request();

    await extendSession(member.userId, sessionId, same);
    await expect(extendSession(member.userId, sessionId, same)).resolves.toMatchObject({
      approved: true,
      replayed: true,
      limit_minutes: 30,
    });
    expect((await sessionRow(sessionId)).duration_minutes).toBe(30);
  });

  it('adds time once when the same request arrives concurrently', async () => {
    const member = await allowedMember('extend-retry-race', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);
    const same = request();

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => extendSession(member.userId, sessionId, same))
    );

    expect(results.every((r) => r.approved)).toBe(true);
    expect(results.filter((r) => r.approved && !r.replayed)).toHaveLength(1);
    expect((await sessionRow(sessionId)).duration_minutes).toBe(30);
  });

  it('never reports approval to a different request made against the same limit', async () => {
    const member = await allowedMember('extend-conflict', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);

    const results = await Promise.all([
      extendSession(member.userId, sessionId, request({ add_minutes: 10 })),
      extendSession(member.userId, sessionId, request({ add_minutes: 15 })),
    ]);

    expect(results.filter((r) => r.approved)).toHaveLength(1);
    expect(results.find((r) => !r.approved)).toMatchObject({ code: 'EXTENSION_STALE' });
    expect([30, 35]).toContain((await sessionRow(sessionId)).duration_minutes);
  });

  it('refuses a request id reused with different minutes', async () => {
    const member = await allowedMember('extend-reuse', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId);
    const first = request();

    await extendSession(member.userId, sessionId, first);
    await expect(
      extendSession(member.userId, sessionId, { ...first, add_minutes: 20 })
    ).resolves.toMatchObject({ approved: false, code: 'EXTENSION_STALE', limit_minutes: 30 });
    expect((await sessionRow(sessionId)).duration_minutes).toBe(30);
  });
});

describe('races', () => {
  it('does not double-charge when a heartbeat races the extension', async () => {
    const member = await allowedMember('extend-heartbeat', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId, { billed: 1100 });

    await Promise.all([
      extendSession(member.userId, sessionId, request()),
      heartbeatSession(member.userId, sessionId, 1200),
      heartbeatSession(member.userId, sessionId, 1195),
    ]);

    expect(await balanceSeconds(member.userId)).toBe(200 * 60 - 100);
    expect(await sessionRow(sessionId)).toMatchObject({ billed_seconds: 1200, duration_minutes: 30 });
  });

  it('finalizes once when End races the extension, and End is never undone', async () => {
    const member = await allowedMember('extend-end', 'core', { credits: 200 });
    const sessionId = await createActiveSession(member.userId, { billed: 1100 });

    const [extended] = await Promise.all([
      extendSession(member.userId, sessionId, request()),
      endSession(member.userId, sessionId, 1200),
    ]);

    const row = await sessionRow(sessionId);
    expect(row.status).toBe('completed');
    expect(row.billed_seconds).toBe(1200);
    expect(row.duration_minutes).toBe(20);
    expect(await balanceSeconds(member.userId)).toBe(200 * 60 - 100);
    if (!extended.approved) expect(extended.code).toBe('SESSION_NOT_ACTIVE');
  });
});

describe('eligibility is decided to the second', () => {
  async function memberWithBalance(label: string, credits: number, seconds: number) {
    const member = await allowedMember(label, 'core', { credits });
    await prisma.profiles.update({
      where: { id: member.userId },
      data: { credits, credits_seconds: seconds },
      select: { id: true },
    });
    return member;
  }

  it('refuses a five-minute extension with 4:59 left, though the minutes column reads 5', async () => {
    const member = await memberWithBalance('sec-299', 5, 299);
    const sessionId = await createActiveSession(member.userId);

    await expect(
      extendSession(member.userId, sessionId, request({ add_minutes: 5 }))
    ).resolves.toMatchObject({
      approved: false,
      code: 'INSUFFICIENT_BALANCE',
      balance_seconds: 299,
      available_seconds: 299,
    });
    expect((await sessionRow(sessionId)).duration_minutes).toBe(20);
  });

  it('approves a five-minute extension with exactly 5:00 left', async () => {
    const member = await memberWithBalance('sec-300', 5, 300);
    const sessionId = await createActiveSession(member.userId);

    await expect(
      extendSession(member.userId, sessionId, request({ add_minutes: 5 }))
    ).resolves.toMatchObject({ approved: true, limit_minutes: 25, balance_seconds: 300 });
  });

  it('reaches 4:59 through real billing, not just seeded columns', async () => {
    const member = await allowedMember('sec-billed', 'core', { credits: 6 });
    const sessionId = await createActiveSession(member.userId, { billed: 1200 - 61 });

    // Settling the last 61s leaves 299s, and billing rewrites the minutes column to 5.
    await expect(
      extendSession(member.userId, sessionId, request({ add_minutes: 5 }))
    ).resolves.toMatchObject({ approved: false, code: 'INSUFFICIENT_BALANCE', balance_seconds: 299 });
    const profile = await prisma.profiles.findUniqueOrThrow({
      where: { id: member.userId },
      select: { credits: true, credits_seconds: true },
    });
    expect(profile).toEqual({ credits: 5, credits_seconds: 299 });
  });

  it('honours a legacy minute-only balance', async () => {
    const member = await memberWithBalance('sec-legacy', 5, 0);
    const sessionId = await createActiveSession(member.userId);

    await expect(
      extendSession(member.userId, sessionId, request({ add_minutes: 5 }))
    ).resolves.toMatchObject({ approved: true, balance_seconds: 300 });
  });
});

describe('shared account balance', () => {
  it('approves only what the balance covers when two sessions extend together', async () => {
    const member = await allowedMember('extend-shared', 'core', { credits: 30 });
    const first = await createActiveSession(member.userId);
    const second = await createActiveSession(member.userId);

    const results = await Promise.all([
      extendSession(member.userId, first, request({ add_minutes: 20 })),
      extendSession(member.userId, second, request({ add_minutes: 20 })),
    ]);

    expect(results.filter((r) => r.approved)).toHaveLength(1);
    expect(results.find((r) => !r.approved)).toMatchObject({
      code: 'MINUTES_HELD_BY_ANOTHER_SESSION',
      available_seconds: 600,
    });
  });

  it('waits for the account lock and decides on the balance its holder committed', async () => {
    const member = await allowedMember('extend-lock', 'core', { credits: 30 });
    const sessionId = await createActiveSession(member.userId);

    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let lockHeld!: () => void;
    const holding = new Promise<void>((resolve) => (lockHeld = resolve));

    // Another request on this account holds the balance, then spends all of it.
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.profiles WHERE id = ${member.userId}::uuid FOR UPDATE`;
        lockHeld();
        await released;
        await tx.profiles.update({
          where: { id: member.userId },
          data: { credits: 0, credits_seconds: 0 },
          select: { id: true },
        });
      },
      { timeout: 20_000 }
    );
    await holding;

    let settled = false;
    const extending = extendSession(member.userId, sessionId, request()).finally(() => {
      settled = true;
    });

    // Proceed once the extension is blocked on a row lock, or has finished without waiting.
    for (let attempt = 0; attempt < 400 && !settled; attempt++) {
      const [{ waiting }] = await prisma.$queryRaw<Array<{ waiting: number }>>`
        SELECT COUNT(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `;
      if (waiting > 0) break;
      await new Promise((resolve) => setImmediate(resolve));
    }

    release();
    await holder;

    await expect(extending).resolves.toMatchObject({
      approved: false,
      code: 'INSUFFICIENT_BALANCE',
      balance_seconds: 0,
    });
    expect((await sessionRow(sessionId)).duration_minutes).toBe(20);
  });

  it('counts time another live session is already approved to use', async () => {
    const member = await allowedMember('extend-committed', 'core', { credits: 25 });
    await createActiveSession(member.userId, { minutes: 20, billed: 0 });
    const sessionId = await createActiveSession(member.userId);

    await expect(extendSession(member.userId, sessionId, request())).resolves.toMatchObject({
      approved: false,
      code: 'MINUTES_HELD_BY_ANOTHER_SESSION',
      balance_seconds: 1500,
      available_seconds: 300,
    });
  });

  it('stops counting a session that has gone quiet (crashed tab)', async () => {
    const member = await allowedMember('extend-crashed', 'core', { credits: 25 });
    await createActiveSession(member.userId, {
      minutes: 20,
      billed: 0,
      lastActivity: new Date(Date.now() - 60 * 60_000),
    });
    const sessionId = await createActiveSession(member.userId);

    await expect(extendSession(member.userId, sessionId, request())).resolves.toMatchObject({
      approved: true,
      limit_minutes: 30,
    });
  });
});
