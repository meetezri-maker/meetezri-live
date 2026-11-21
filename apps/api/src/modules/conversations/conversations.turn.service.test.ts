/**
 * Turn reservation / completion — mocked Prisma (no database).
 */
const tx = {
  $executeRaw: jest.fn(),
  chat_conversations: { findFirst: jest.fn(), update: jest.fn() },
  chat_messages: {
    findFirst: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  profiles: { findUnique: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    chat_messages: { updateMany: (...args: unknown[]) => tx.chat_messages.updateMany(...args) },
  },
}));

import { ConversationError } from './conversations.service';
import {
  completeTurn,
  dailyUsageWhere,
  failTurn,
  readTurnLimits,
  reserveTurn,
  type TurnLimits,
} from './conversations.turn.service';
import type { TextChatGate } from './textChatEntitlements';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONV = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-20T10:00:00.000Z');
const limits: TurnLimits = { maxInFlightPerUser: 2, sendsPerMinute: 10, staleAfterMs: 85_000 };

type CountWhere = Record<string, any>;

/** Configures count() answers by the shape of the where-clause. */
function counts({ inConversation = 0, inFlight = 0, lastMinute = 0, priorUser = 0, daily = 0 } = {}) {
  tx.chat_messages.count.mockImplementation(async ({ where }: { where: CountWhere }) => {
    if (where.OR) return daily; // daily allowance query (Phase 5)
    if (where.status === 'pending' && where.conversation_id) return inConversation;
    if (where.status === 'pending') return inFlight;
    if (where.role === 'user' && where.created_at) return lastMinute;
    if (where.role === 'user') return priorUser;
    throw new Error(`unexpected count ${JSON.stringify(where)}`);
  });
}

function reserve(content = 'I could not sleep last night') {
  return reserveTurn(USER, CONV, { content, client_message_id: CLIENT_ID }, limits, () => NOW);
}

beforeEach(() => {
  tx.chat_conversations.findFirst.mockResolvedValue({ id: CONV, companion_key: 'Sara Mitchell', title: 'New chat with Romy' });
  tx.chat_messages.findFirst.mockResolvedValue(null);
  tx.chat_messages.findMany.mockResolvedValue([]);
  tx.chat_messages.create.mockImplementation(async ({ data }: any) => ({
    id: '33333333-3333-4333-8333-333333333333',
    conversation_id: data.conversation_id,
    role: data.role,
    content: data.content,
    status: data.status,
    created_at: NOW,
  }));
  tx.profiles.findUnique.mockResolvedValue({ timezone: 'Australia/Sydney', crisis_country_code: 'AU' });
  counts();
});

describe('readTurnLimits', () => {
  it('uses the proposed defaults and a staleness window beyond the reply timeout', () => {
    expect(readTurnLimits(55_000, {})).toEqual({ maxInFlightPerUser: 2, sendsPerMinute: 10, staleAfterMs: 85_000 });
    expect(readTurnLimits(55_000, { CONVERSATIONS_MAX_IN_FLIGHT_PER_USER: '3', CONVERSATIONS_SENDS_PER_MINUTE: 'x' })).toMatchObject({
      maxInFlightPerUser: 3,
      sendsPerMinute: 10,
    });
  });
});

describe('reserveTurn', () => {
  it('locks per member, stores a pending user message, and builds the Ezri request from the database', async () => {
    tx.chat_messages.findMany.mockResolvedValue([
      { role: 'assistant', content: 'How did the evening go?' },
      { role: 'user', content: 'Long day' },
    ]); // newest first, as queried

    const turn = await reserve('  I could not sleep last night  ');

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.chat_messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          conversation_id: CONV,
          user_id: USER,
          role: 'user',
          content: 'I could not sleep last night',
          status: 'pending',
          client_message_id: CLIENT_ID,
        },
      })
    );
    expect(turn.userMessage.status).toBe('pending');
    expect(turn.ezriRequest).toEqual({
      prompt: 'I could not sleep last night',
      userId: USER,
      sessionId: `text_${CONV}`,
      history: [
        { role: 'user', content: 'Long day' },
        { role: 'assistant', content: 'How did the evening go?' },
      ],
      avatarName: 'Romy',
      countryCode: 'AU',
      timezone: 'Australia/Sydney',
    });
    // Only complete messages, scoped to this conversation AND owner, are used as context.
    expect(tx.chat_messages.findMany.mock.calls[0][0].where).toEqual({ conversation_id: CONV, user_id: USER, status: 'complete' });
  });

  it.each([
    ['Alex', 'Frankie'],
    ['Jordan Taylor', 'Andre'],
    ['Maya Chen', 'Tessa'],
    ['Sara Mitchell', 'Romy'],
    ['Bianca', 'Bianca'],
    ['Damian', 'Damian'],
    ['Sasha', 'Sasha'],
  ])('sends companion %p to Ezri as %p', async (key, avatar) => {
    tx.chat_conversations.findFirst.mockResolvedValue({ id: CONV, companion_key: key, title: 'Custom' });
    expect((await reserve()).ezriRequest.avatarName).toBe(avatar);
  });

  it('sets the title from the first message only while the default title is in place', async () => {
    counts({ priorUser: 0 });
    await reserve('i could not sleep last night and the night before that');
    expect(tx.chat_conversations.update.mock.calls[0][0].data.title).toBe('I could not sleep last night and the…');

    tx.chat_conversations.update.mockClear();
    counts({ priorUser: 1 });
    await reserve();
    expect(tx.chat_conversations.update.mock.calls[0][0].data).not.toHaveProperty('title');

    tx.chat_conversations.update.mockClear();
    counts({ priorUser: 0 });
    tx.chat_conversations.findFirst.mockResolvedValue({ id: CONV, companion_key: 'Alex', title: 'Renamed' });
    await reserve();
    expect(tx.chat_conversations.update.mock.calls[0][0].data).not.toHaveProperty('title');
  });

  it('404s for a conversation the member does not own, before any write', async () => {
    tx.chat_conversations.findFirst.mockResolvedValue(null);
    await expect(reserve()).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND', statusCode: 404 });
    expect(tx.chat_conversations.findFirst.mock.calls[0][0].where).toEqual({ id: CONV, user_id: USER });
    expect(tx.chat_messages.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ inConversation: 1 }, 'REPLY_IN_PROGRESS', 409],
    [{ inFlight: 2 }, 'TOO_MANY_IN_FLIGHT', 429],
    [{ lastMinute: 10 }, 'RATE_LIMITED', 429],
  ])('enforces limits %p → %s', async (state, code, status) => {
    counts(state);
    const error = await reserve().catch((e) => e);
    expect(error).toBeInstanceOf(ConversationError);
    expect(error).toMatchObject({ code, statusCode: status });
    expect(tx.chat_messages.create).not.toHaveBeenCalled();
  });

  it('ignores pending messages older than the staleness window', async () => {
    await reserve();
    const pendingWhere = tx.chat_messages.count.mock.calls
      .map(([arg]: any) => arg.where)
      .find((w: CountWhere) => w.status === 'pending' && w.conversation_id);
    expect(pendingWhere.created_at.gt).toEqual(new Date(NOW.getTime() - limits.staleAfterMs));
  });

  it('rejects a duplicate client_message_id that is not failed', async () => {
    tx.chat_messages.findFirst.mockResolvedValue({ id: 'old', status: 'complete' });
    await expect(reserve()).rejects.toMatchObject({ code: 'DUPLICATE_MESSAGE', statusCode: 409 });
    expect(tx.chat_messages.create).not.toHaveBeenCalled();
  });

  it('retries a failed message by replacing it', async () => {
    tx.chat_messages.findFirst.mockResolvedValue({ id: 'old-failed', status: 'failed' });
    counts({ priorUser: 1 });
    const turn = await reserve();
    expect(tx.chat_messages.delete).toHaveBeenCalledWith({ where: { id: 'old-failed' } });
    expect(tx.chat_messages.create).toHaveBeenCalled();
    expect(turn.retried).toBe(true);
    // The replaced failed message was the only one, so this is still the first message.
    expect(tx.chat_conversations.update.mock.calls[0][0].data.title).toBe('I could not sleep last night');
  });
});

describe('reserveTurn — Phase 5 entitlement gate', () => {
  const allowed = (mode: TextChatGate['mode'], dailyLimit = 20): TextChatGate => ({
    mode,
    decision: { allowed: true, membership: 'DISCOVER', status: 'ACTIVE', dailyLimit },
  });
  const blocked = (mode: TextChatGate['mode'], code: 'TRIAL_EXPIRED' | 'PLAN_NOT_ELIGIBLE' | 'SUBSCRIPTION_NOT_ELIGIBLE'): TextChatGate => ({
    mode,
    decision: { allowed: false, membership: 'DISCOVER', status: 'EXPIRED', code },
  });
  const reserveWith = (gate: TextChatGate | null) =>
    reserveTurn(USER, CONV, { content: 'hello', client_message_id: CLIENT_ID }, limits, () => NOW, gate);

  it('gate off (default): no daily query, no entitlement fields — today’s behaviour', async () => {
    const turn = await reserveWith(null);
    const dailyCalls = tx.chat_messages.count.mock.calls.filter(([a]: any) => a.where.OR);
    expect(dailyCalls).toHaveLength(0);
    expect(turn.entitlement).toBeUndefined();
  });

  it.each([
    ['TRIAL_EXPIRED', 403],
    ['SUBSCRIPTION_NOT_ELIGIBLE', 403],
    ['PLAN_NOT_ELIGIBLE', 403],
  ] as const)('enforce: blocks %s with %i before storing anything', async (code, status) => {
    await expect(reserveWith(blocked('enforce', code))).rejects.toMatchObject({ code, statusCode: status });
    expect(tx.chat_messages.create).not.toHaveBeenCalled();
    // The lock is still taken first, like every other check.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('shadow: an ineligible member is NOT blocked, and the would-be outcome is reported', async () => {
    const turn = await reserveWith(blocked('shadow', 'TRIAL_EXPIRED'));
    expect(tx.chat_messages.create).toHaveBeenCalled();
    expect(turn.entitlement).toMatchObject({ mode: 'shadow', outcome: 'TRIAL_EXPIRED', membership: 'DISCOVER' });
  });

  it('counts today’s usage under the per-member lock, in the member’s time zone, across all conversations', async () => {
    counts({ daily: 5 });
    const turn = await reserveWith(allowed('enforce'));

    const lockOrder = tx.$executeRaw.mock.invocationCallOrder[0];
    const dailyIdx = tx.chat_messages.count.mock.calls.findIndex(([a]: any) => a.where.OR);
    expect(tx.chat_messages.count.mock.invocationCallOrder[dailyIdx]).toBeGreaterThan(lockOrder);

    const where = tx.chat_messages.count.mock.calls[dailyIdx][0].where;
    // NOW = 10:00Z = 21:00 on 2026-11-20 in Sydney (UTC+11) -> local day starts 2026-11-19 13:00Z.
    expect(where).toEqual(
      dailyUsageWhere(USER, new Date('2026-11-19T13:00:00.000Z'), new Date(NOW.getTime() - limits.staleAfterMs))
    );
    expect(where).not.toHaveProperty('conversation_id'); // new conversations cannot reset the count
    expect(turn.entitlement).toMatchObject({ outcome: 'allowed', used: 5, limit: 20, timeZone: 'Australia/Sydney' });
  });

  it('enforce: refuses the send at the limit with DAILY_LIMIT_REACHED, limit and reset time', async () => {
    counts({ daily: 20 });
    const error = await reserveWith(allowed('enforce', 20)).catch((e) => e);
    expect(error).toBeInstanceOf(ConversationError);
    expect(error).toMatchObject({
      code: 'DAILY_LIMIT_REACHED',
      statusCode: 429,
      details: { limit: 20, resets_at: '2026-11-20T13:00:00.000Z' },
    });
    expect(tx.chat_messages.create).not.toHaveBeenCalled();
  });

  it('allows the last message under the limit (19 of 20 used)', async () => {
    counts({ daily: 19 });
    await expect(reserveWith(allowed('enforce', 20))).resolves.toMatchObject({ entitlement: { used: 19, limit: 20 } });
  });

  it('shadow: over the limit is logged as DAILY_LIMIT_REACHED but the send proceeds', async () => {
    counts({ daily: 99 });
    const turn = await reserveWith(allowed('shadow', 20));
    expect(tx.chat_messages.create).toHaveBeenCalled();
    expect(turn.entitlement).toMatchObject({ outcome: 'DAILY_LIMIT_REACHED', used: 99, limit: 20 });
  });

  it('existing limits still apply first (rate limit beats the daily check)', async () => {
    counts({ lastMinute: 10, daily: 0 });
    await expect(reserveWith(allowed('enforce'))).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('dailyUsageWhere', () => {
  it('counts only user messages that are delivered or genuinely in flight', () => {
    const start = new Date('2026-11-20T13:00:00Z');
    const stale = new Date('2026-11-20T20:58:35Z');
    expect(dailyUsageWhere(USER, start, stale)).toEqual({
      user_id: USER,
      role: 'user', // assistant replies never count
      created_at: { gte: start },
      // failed / interrupted never count; a pending row abandoned past the staleness window stops counting
      OR: [{ status: 'complete' }, { status: 'pending', created_at: { gt: stale } }],
    });
  });
});

describe('completeTurn / failTurn', () => {
  it('marks the user message complete, stores the reply, and bumps the conversation', async () => {
    tx.chat_messages.update.mockResolvedValue({
      id: 'u1', conversation_id: CONV, role: 'user', content: 'q', status: 'complete', created_at: NOW,
    });
    const result = await completeTurn(USER, CONV, 'u1', 'Reply text', () => NOW);

    expect(tx.chat_messages.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1', user_id: USER },
      data: { status: 'complete' },
    }));
    expect(tx.chat_messages.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { conversation_id: CONV, user_id: USER, role: 'assistant', content: 'Reply text', status: 'complete' },
    }));
    expect(tx.chat_conversations.update).toHaveBeenCalledWith({
      where: { id: CONV },
      data: { last_message_at: NOW, updated_at: NOW },
    });
    expect(result.assistantMessage.role).toBe('assistant');
  });

  it('caps an oversized reply at the database limit', async () => {
    tx.chat_messages.update.mockResolvedValue({ id: 'u1', conversation_id: CONV, role: 'user', content: 'q', status: 'complete', created_at: NOW });
    await completeTurn(USER, CONV, 'u1', 'x'.repeat(25_000), () => NOW);
    expect(tx.chat_messages.create.mock.calls[0][0].data.content).toHaveLength(20_000);
  });

  it('failTurn marks only the member’s still-pending message failed, and never throws', async () => {
    await failTurn(USER, 'u1');
    expect(tx.chat_messages.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', user_id: USER, status: 'pending' },
      data: { status: 'failed' },
    });
    tx.chat_messages.updateMany.mockRejectedValueOnce(new Error('db down'));
    await expect(failTurn(USER, 'u1')).resolves.toBeUndefined();
  });
});
