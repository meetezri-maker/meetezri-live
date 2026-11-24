/**
 * Start and Extend sharing one account balance, against REAL PostgreSQL. Nothing is mocked.
 */

import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import {
  beginScheduledSession,
  createSession,
  endSession,
  extendSession,
  heartbeatSession,
} from './sessions.service';
import {
  allowSessionExtensionsFor,
  cleanupIntegrationData,
  clearSessionExtensionsAllowlist,
  createMember,
} from '../../test-integration/factories';

/** Members created here are on the `session_extensions` allowlist, like the QA account. */
async function allowedMember(...args: Parameters<typeof createMember>) {
  const member = await createMember(...args);
  await allowSessionExtensionsFor(member.userId);
  return member;
}


jest.setTimeout(60_000);

const originalFlag = process.env.SESSION_EXTENSIONS_ENABLED;
const HELD = { statusCode: 409, code: 'MINUTES_HELD_BY_ANOTHER_SESSION' };

beforeAll(async () => {
  await cleanupIntegrationData();
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
});

async function sessionAtLimit(userId: string) {
  const session = await prisma.app_sessions.create({
    data: {
      user_id: userId,
      type: 'instant',
      status: 'active',
      duration_minutes: 20,
      billed_seconds: 1200,
      started_at: new Date(),
      updated_at: new Date(),
    },
    select: { id: true },
  });
  return session.id;
}

const start = (userId: string, minutes: number) =>
  createSession(userId, { type: 'instant', duration_minutes: minutes });

const extend = (userId: string, sessionId: string, addMinutes: number) =>
  extendSession(userId, sessionId, {
    request_id: randomUUID(),
    expected_limit_minutes: 20,
    add_minutes: addMinutes,
    elapsed_seconds: 1200,
  });

const activeSessions = (userId: string) =>
  prisma.app_sessions.count({ where: { user_id: userId, status: 'active' } });

const balance = async (userId: string) =>
  Number(
    (
      await prisma.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { credits_seconds: true },
      })
    ).credits_seconds ?? 0
  );

describe('Start and Extend claim the same balance', () => {
  it('lets only one claim the same minutes when they race', async () => {
    const member = await allowedMember('start-race', 'core', { credits: 30 });
    const sessionId = await sessionAtLimit(member.userId);

    const [started, extended] = await Promise.allSettled([
      start(member.userId, 20),
      extend(member.userId, sessionId, 20),
    ]);

    const startWon = started.status === 'fulfilled';
    const extendWon = extended.status === 'fulfilled' && extended.value.approved;
    expect([startWon, extendWon].filter(Boolean)).toHaveLength(1);

    if (!startWon) {
      expect((started as PromiseRejectedResult).reason).toMatchObject(HELD);
    } else {
      expect(extended).toMatchObject({
        status: 'fulfilled',
        value: { approved: false, code: HELD.code },
      });
    }
    // Nothing is deducted for time that has not been used.
    expect(await balance(member.userId)).toBe(30 * 60);
  });

  it('refuses a Start for minutes an extension already claimed', async () => {
    const member = await allowedMember('start-after', 'core', { credits: 30 });
    const sessionId = await sessionAtLimit(member.userId);

    await expect(extend(member.userId, sessionId, 20)).resolves.toMatchObject({ approved: true });
    await expect(start(member.userId, 20)).rejects.toMatchObject({
      ...HELD,
      available_seconds: 600,
    });
    await expect(start(member.userId, 10)).resolves.toBeDefined();
  });

  it('keeps the billing message for a Start the balance itself cannot cover', async () => {
    const member = await allowedMember('genuine', 'core', { credits: 30 });
    await prisma.profiles.update({
      where: { id: member.userId },
      data: { credits: 5, credits_seconds: 299 },
      select: { id: true },
    });

    await expect(start(member.userId, 5)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/^Insufficient credits/),
    });
  });

  it('refuses an extension for minutes a Start already claimed', async () => {
    const member = await allowedMember('extend-after', 'core', { credits: 30 });
    const sessionId = await sessionAtLimit(member.userId);

    await start(member.userId, 20);

    await expect(extend(member.userId, sessionId, 20)).resolves.toMatchObject({
      approved: false,
      code: HELD.code,
      available_seconds: 600,
    });
    await expect(extend(member.userId, sessionId, 10)).resolves.toMatchObject({ approved: true });
  });

  it('lets only one of two racing Starts claim the same minutes', async () => {
    const member = await allowedMember('two-starts', 'core', { credits: 30 });

    const results = await Promise.allSettled([start(member.userId, 20), start(member.userId, 20)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await activeSessions(member.userId)).toBe(1);
  });

  it('waits for the account lock and decides on the balance its holder committed', async () => {
    const member = await allowedMember('start-lock', 'core', { credits: 30 });

    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let lockHeld!: () => void;
    const holding = new Promise<void>((resolve) => (lockHeld = resolve));

    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.profiles WHERE id = ${member.userId}::uuid FOR UPDATE`;
        lockHeld();
        await released;
        await tx.profiles.update({
          where: { id: member.userId },
          data: { credits: 5, credits_seconds: 300 },
          select: { id: true },
        });
      },
      { timeout: 20_000 }
    );
    await holding;

    let settled = false;
    const starting = start(member.userId, 20).finally(() => {
      settled = true;
    });
    starting.catch(() => undefined);

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

    await expect(starting).rejects.toMatchObject({ statusCode: 400 });
    expect(await activeSessions(member.userId)).toBe(0);
  });

  it('applies the same rule when starting a scheduled session', async () => {
    const member = await allowedMember('scheduled', 'core', { credits: 30 });
    const sessionId = await sessionAtLimit(member.userId);
    const scheduled = await prisma.app_sessions.create({
      data: {
        user_id: member.userId,
        type: 'scheduled',
        status: 'scheduled',
        duration_minutes: 20,
        scheduled_at: new Date(),
      },
      select: { id: true },
    });

    await extend(member.userId, sessionId, 20);

    await expect(beginScheduledSession(member.userId, scheduled.id, {})).rejects.toMatchObject(
      HELD
    );
    expect(
      (await prisma.app_sessions.findUniqueOrThrow({ where: { id: scheduled.id } })).status
    ).toBe('scheduled');
    await expect(
      beginScheduledSession(member.userId, scheduled.id, { duration_minutes: 10 })
    ).resolves.toMatchObject({ status: 'active', duration_minutes: 10 });
  });

  it('frees approved time that was never used once the session ends', async () => {
    const member = await allowedMember('freed', 'core', { credits: 30 });
    const sessionId = await sessionAtLimit(member.userId);

    await extend(member.userId, sessionId, 20);
    await endSession(member.userId, sessionId, 1200);

    await expect(start(member.userId, 30)).resolves.toBeDefined();
    expect(await balance(member.userId)).toBe(30 * 60);
  });

  it('keeps per-second billing: partly used approved time frees the rest', async () => {
    const member = await allowedMember('per-second', 'core', { credits: 30 });
    const sessionId = await sessionAtLimit(member.userId);

    await extend(member.userId, sessionId, 20);
    await heartbeatSession(member.userId, sessionId, 1290);

    // 90s billed, so 1710s of balance with 1110s of the extension still approved: 600s are free.
    expect(await balance(member.userId)).toBe(30 * 60 - 90);
    await expect(start(member.userId, 11)).rejects.toMatchObject({
      ...HELD,
      available_seconds: 600,
    });
    await expect(start(member.userId, 10)).resolves.toBeDefined();
  });

  it('leaves Start unchanged while the feature is off', async () => {
    delete process.env.SESSION_EXTENSIONS_ENABLED;
    const member = await allowedMember('flag-off', 'core', { credits: 30 });

    await start(member.userId, 20);
    await expect(start(member.userId, 20)).resolves.toBeDefined();
    expect(await activeSessions(member.userId)).toBe(2);
  });
});
