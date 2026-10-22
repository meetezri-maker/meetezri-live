/**
 * Session finalization and billing against REAL PostgreSQL.
 *
 * Proves the `SELECT … FOR UPDATE` row lock shared by `endSession` and `heartbeatSession`: calls
 * are issued without awaiting each other, over genuinely parallel Prisma connections, and
 * correctness is asserted from database state (balance, billed seconds, transcript rows).
 */

import prisma from '../../lib/prisma';
import { endSession, heartbeatSession } from './sessions.service';
import { cleanupIntegrationData, createMember } from '../../test-integration/factories';

jest.setTimeout(60_000);

beforeAll(async () => {
  await cleanupIntegrationData();
});

afterEach(async () => {
  await cleanupIntegrationData();
});

afterAll(async () => {
  await cleanupIntegrationData();
});

const STARTING_MINUTES = 100;

async function createActiveSession(userId: string, durationMinutes: number | null = 10) {
  const session = await prisma.app_sessions.create({
    data: {
      user_id: userId,
      type: 'instant',
      status: 'active',
      duration_minutes: durationMinutes,
      started_at: new Date(Date.now() - 5 * 60_000),
    },
    select: { id: true },
  });
  return session.id;
}

async function secondsDeducted(userId: string): Promise<number> {
  const profile = await prisma.profiles.findUniqueOrThrow({
    where: { id: userId },
    select: { credits_seconds: true },
  });
  return STARTING_MINUTES * 60 - Number(profile.credits_seconds ?? 0);
}

const transcript = [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: 'hi there' },
];

describe('endSession under concurrency', () => {
  it('finalizes once when several end requests arrive together', async () => {
    const member = await createMember('end-race', 'core', { credits: STARTING_MINUTES });
    const sessionId = await createActiveSession(member.userId);

    const results = await Promise.allSettled([
      endSession(member.userId, sessionId, 120, undefined, transcript),
      endSession(member.userId, sessionId, 120, undefined, transcript),
      endSession(member.userId, sessionId, 121, undefined, transcript),
    ]);

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    expect(await secondsDeducted(member.userId)).toBeGreaterThanOrEqual(120);
    expect(await secondsDeducted(member.userId)).toBeLessThanOrEqual(121);
    expect(await prisma.session_messages.count({ where: { session_id: sessionId } })).toBe(2);
    const row = await prisma.app_sessions.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.status).toBe('completed');
  });

  it('does not double-charge when heartbeats race the end request', async () => {
    const member = await createMember('heartbeat-end-race', 'core', { credits: STARTING_MINUTES });
    const sessionId = await createActiveSession(member.userId);

    const results = await Promise.allSettled([
      heartbeatSession(member.userId, sessionId, 300),
      endSession(member.userId, sessionId, 320),
      heartbeatSession(member.userId, sessionId, 315),
    ]);

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    expect(await secondsDeducted(member.userId)).toBe(320);
    const row = await prisma.app_sessions.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.billed_seconds).toBe(320);
  });

  it('bills overlapping heartbeats for the same time once', async () => {
    const member = await createMember('heartbeat-race', 'core', { credits: STARTING_MINUTES });
    const sessionId = await createActiveSession(member.userId);

    await Promise.all([1, 2, 3, 4, 5].map(() => heartbeatSession(member.userId, sessionId, 90)));

    expect(await secondsDeducted(member.userId)).toBe(90);
  });

  it('never bills past the selected length, and bills actual use when shorter', async () => {
    const member = await createMember('cap', 'core', { credits: STARTING_MINUTES });
    const overrun = await createActiveSession(member.userId, 10);
    const early = await createActiveSession(member.userId, 10);

    await heartbeatSession(member.userId, overrun, 700);
    await endSession(member.userId, overrun, 900);
    await endSession(member.userId, early, 125);

    expect(await secondsDeducted(member.userId)).toBe(600 + 125);
  });
});
