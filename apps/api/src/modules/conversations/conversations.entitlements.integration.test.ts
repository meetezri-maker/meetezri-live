/**
 * Phase 5 — daily text-chat allowance against REAL PostgreSQL (the isolated integration database).
 *
 * Proves what mocks cannot: the per-member advisory lock serialises concurrent sends across
 * connections, so N simultaneous sends at the limit admit exactly the remaining allowance.
 * No Ezri, no AI: only reserve / fail / complete are exercised.
 */
import prisma from '../../lib/prisma';
import { cleanupIntegrationData, createMember } from '../../test-integration/factories';
import { completeTurn, failTurn, reserveTurn, type TurnLimits } from './conversations.turn.service';
import type { TextChatGate } from './textChatEntitlements';

jest.setTimeout(60_000);

beforeAll(cleanupIntegrationData);
afterEach(cleanupIntegrationData);
afterAll(cleanupIntegrationData);

// Generous existing limits so only the DAILY allowance is under test.
const limits: TurnLimits = { maxInFlightPerUser: 50, sendsPerMinute: 120, staleAfterMs: 85_000 };
const gate = (dailyLimit: number): TextChatGate => ({
  mode: 'enforce',
  decision: { allowed: true, membership: 'DISCOVER', status: 'ACTIVE', dailyLimit },
});

let seq = 0;
const clientId = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`;

async function newConversation(userId: string): Promise<string> {
  const c = await prisma.chat_conversations.create({
    data: { user_id: userId, companion_key: 'Sara Mitchell', title: 'New chat with Romy' },
    select: { id: true },
  });
  return c.id;
}

const send = (userId: string, conversationId: string, dailyLimit: number, id = clientId()) =>
  reserveTurn(userId, conversationId, { content: 'hello', client_message_id: id }, limits, () => new Date(), gate(dailyLimit));

describe('daily allowance on real PostgreSQL', () => {
  it('admits exactly the remaining allowance when sends race (8 parallel sends, limit 3)', async () => {
    const { userId } = await createMember('chat-race', 'trial');
    const conversations = await Promise.all(Array.from({ length: 8 }, () => newConversation(userId)));

    const results = await Promise.allSettled(conversations.map((id) => send(userId, id, 3)));

    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(3);
    expect(refused).toHaveLength(5);
    for (const r of refused) expect(r.reason).toMatchObject({ code: 'DAILY_LIMIT_REACHED', statusCode: 429 });
    expect(await prisma.chat_messages.count({ where: { user_id: userId, role: 'user' } })).toBe(3);
  });

  it('does not count failed messages, and a retry counts once', async () => {
    const { userId } = await createMember('chat-retry', 'trial');
    const conv = await newConversation(userId);
    const id = clientId();

    const first = await send(userId, conv, 1, id);
    await failTurn(userId, first.userMessage.id); // Ezri failed -> message marked failed

    // The failed message frees its slot: the retry (same client id) is admitted at limit 1.
    const retry = await send(userId, conv, 1, id);
    expect(retry.retried).toBe(true);
    await completeTurn(userId, conv, retry.userMessage.id, 'reply');

    expect(await prisma.chat_messages.count({ where: { user_id: userId, role: 'user' } })).toBe(1);
    // Assistant replies never count; the allowance is now used up.
    await expect(send(userId, conv, 1)).rejects.toMatchObject({ code: 'DAILY_LIMIT_REACHED' });
  });

  it('a new conversation cannot reset the allowance', async () => {
    const { userId } = await createMember('chat-newconv', 'trial');
    const a = await newConversation(userId);
    const r1 = await send(userId, a, 2);
    await completeTurn(userId, a, r1.userMessage.id, 'reply');
    const r2 = await send(userId, a, 2);
    await completeTurn(userId, a, r2.userMessage.id, 'reply');

    const b = await newConversation(userId);
    await expect(send(userId, b, 2)).rejects.toMatchObject({ code: 'DAILY_LIMIT_REACHED' });
  });

  it('KNOWN GAP (documented, not shipped): hard-deleting a conversation would reset usage', async () => {
    // There is no delete endpoint today (decision D6), so members cannot do this. This test pins
    // WHY the soft-delete column must land before deletion ships: the FK cascade removes the rows
    // the allowance is counted from.
    const { userId } = await createMember('chat-delete', 'trial');
    const a = await newConversation(userId);
    const r = await send(userId, a, 1);
    await completeTurn(userId, a, r.userMessage.id, 'reply');
    await expect(send(userId, a, 1)).rejects.toMatchObject({ code: 'DAILY_LIMIT_REACHED' });

    await prisma.chat_conversations.delete({ where: { id: a } });
    const b = await newConversation(userId);
    await expect(send(userId, b, 1)).resolves.toBeTruthy(); // allowance reset by the cascade
  });
});
