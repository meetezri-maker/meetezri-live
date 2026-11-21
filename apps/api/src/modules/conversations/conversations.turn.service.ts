import { Prisma } from '@prisma/client';
import { companionDisplayName } from '@meetezri/shared';
import prisma from '../../lib/prisma';
import { deriveConversationTitle } from './conversationTitle';
import type { ConversationMessage } from './conversations.schema';
import { ConversationError, defaultConversationTitle } from './conversations.service';
import type { EzriChatRequest, EzriHistoryItem } from './ezriChatClient';
import type { TextChatAccessCode, TextChatGate } from './textChatEntitlements';
import { usageWindowFor } from './usageWindow';

/**
 * Conversations Module — one chat turn: reserve (validate + limits + store the user message),
 * then complete (store the reply) or fail.
 *
 * SERVERLESS-SAFE LIMITS: every check runs in one transaction serialised per member by a
 * transaction-scoped advisory lock, and "a reply is in flight" is a `pending` user message in the
 * database (not process memory, which Vercel instances do not share). A pending row older than the
 * staleness window (function killed mid-reply) no longer blocks the member.
 *
 * Limit VALUES are proposals pending product sign-off (decision D3) and are configurable.
 *
 * ISOLATION: touches only chat_conversations / chat_messages (and reads profiles.timezone /
 * crisis_country_code). Never voice sessions, minutes, credits or subscriptions.
 */

export const MAX_MESSAGE_CHARS = 4000;
/** Max stored assistant length (DB CHECK allows 20 000). */
const MAX_REPLY_CHARS = 20_000;
/** Prior messages sent to Ezri as short-term context (Ezri further trims to ~1 200 tokens). */
export const HISTORY_MESSAGES = 20;

export interface TurnLimits {
  /** Simultaneous replies across all of a member's conversations. */
  maxInFlightPerUser: number;
  /** User messages accepted per rolling minute. */
  sendsPerMinute: number;
  /** After this, a still-`pending` message is considered abandoned. */
  staleAfterMs: number;
}

function intFromEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function readTurnLimits(replyTimeoutMs: number, env: NodeJS.ProcessEnv = process.env): TurnLimits {
  return {
    maxInFlightPerUser: intFromEnv(env.CONVERSATIONS_MAX_IN_FLIGHT_PER_USER, 2, 1, 10),
    sendsPerMinute: intFromEnv(env.CONVERSATIONS_SENDS_PER_MINUTE, 10, 1, 120),
    staleAfterMs: replyTimeoutMs + 30_000,
  };
}

export interface ReservedTurn {
  conversationId: string;
  userMessage: ConversationMessage;
  ezriRequest: EzriChatRequest;
  /** True when a previously failed message with the same client_message_id is being re-sent. */
  retried: boolean;
  /** Text-chat entitlement outcome (absent when the gate is off). Safe to log: no content. */
  entitlement?: EntitlementOutcome;
}

export interface EntitlementOutcome {
  mode: TextChatGate['mode'];
  /** 'allowed', or the code that blocked — or WOULD have blocked, in shadow mode. */
  outcome: 'allowed' | TextChatAccessCode | 'DAILY_LIMIT_REACHED';
  membership: string;
  status: string;
  used?: number;
  limit?: number;
  timeZone?: string;
}

const ACCESS_MESSAGES: Record<TextChatAccessCode, string> = {
  TRIAL_EXPIRED: 'Your trial has expired. Upgrade your plan to keep chatting.',
  SUBSCRIPTION_NOT_ELIGIBLE: 'Your membership has ended. Renew your plan to keep chatting.',
  PLAN_NOT_ELIGIBLE: 'Text chat isn’t available on your current plan.',
};

/**
 * User messages that count against today's allowance: delivered ones, plus ones whose reply is
 * genuinely in flight (so concurrent sends cannot slip past the limit). FAILED messages never
 * count, and a retry replaces its failed row, so a retried message counts once. Assistant replies
 * never count. Counted per member across ALL conversations, so new conversations cannot reset it.
 */
export function dailyUsageWhere(userId: string, windowStart: Date, staleCutoff: Date) {
  return {
    user_id: userId,
    role: 'user',
    created_at: { gte: windowStart },
    OR: [{ status: 'complete' }, { status: 'pending', created_at: { gt: staleCutoff } }],
  };
}

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  status: string;
  created_at: Date;
};

export function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role as ConversationMessage['role'],
    content: row.content,
    status: row.status as ConversationMessage['status'],
    created_at: row.created_at.toISOString(),
  };
}

const messageSelect = {
  id: true,
  conversation_id: true,
  role: true,
  content: true,
  status: true,
  created_at: true,
};

const limitError = (code: 'REPLY_IN_PROGRESS' | 'TOO_MANY_IN_FLIGHT' | 'RATE_LIMITED' | 'DUPLICATE_MESSAGE') => {
  switch (code) {
    case 'REPLY_IN_PROGRESS':
      return new ConversationError(code, 409, 'Please wait for the current reply.');
    case 'DUPLICATE_MESSAGE':
      return new ConversationError(code, 409, 'This message was already sent.');
    case 'TOO_MANY_IN_FLIGHT':
      return new ConversationError(code, 429, 'Please wait for your other conversations to reply.');
    default:
      return new ConversationError(code, 429, 'You’re sending messages quickly. Please wait a moment.');
  }
};

/**
 * Validates ownership and limits, stores the user message as `pending`, and builds the Ezri
 * request from the DATABASE (never from client-supplied history).
 */
export async function reserveTurn(
  userId: string,
  conversationId: string,
  input: { content: string; client_message_id: string },
  limits: TurnLimits,
  now: () => Date = () => new Date(),
  /** Text-chat entitlement gate (Phase 5). null/absent = gate off, today's behaviour. */
  gate: TextChatGate | null = null
): Promise<ReservedTurn> {
  const content = input.content.trim();
  let entitlement: EntitlementOutcome | undefined;

  return prisma.$transaction(
    async (tx) => {
      // Serialise this member's reservations so concurrent requests cannot both pass the checks.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chat_turn:${userId}`}::text))`;

      const conversation = await tx.chat_conversations.findFirst({
        where: { id: conversationId, user_id: userId },
        select: { id: true, companion_key: true, title: true },
      });
      if (!conversation) {
        throw new ConversationError('CONVERSATION_NOT_FOUND', 404, 'This conversation isn’t available.');
      }

      const at = now();
      const staleCutoff = new Date(at.getTime() - limits.staleAfterMs);

      // Plan eligibility (Phase 5). The decision was resolved through the entitlement engine before
      // the transaction; only enforce mode blocks, shadow mode records what it would have done.
      if (gate) {
        const { decision } = gate;
        entitlement = {
          mode: gate.mode,
          outcome: decision.allowed ? 'allowed' : decision.code,
          membership: decision.membership,
          status: decision.status,
        };
        if (!decision.allowed && gate.mode === 'enforce') {
          throw new ConversationError(decision.code, 403, ACCESS_MESSAGES[decision.code]);
        }
      }

      const existing = await tx.chat_messages.findFirst({
        where: { conversation_id: conversationId, user_id: userId, client_message_id: input.client_message_id },
        select: { id: true, status: true },
      });
      if (existing && existing.status !== 'failed') throw limitError('DUPLICATE_MESSAGE');

      const inConversation = await tx.chat_messages.count({
        where: { conversation_id: conversationId, user_id: userId, status: 'pending', created_at: { gt: staleCutoff } },
      });
      if (inConversation > 0) throw limitError('REPLY_IN_PROGRESS');

      const inFlight = await tx.chat_messages.count({
        where: { user_id: userId, status: 'pending', created_at: { gt: staleCutoff } },
      });
      if (inFlight >= limits.maxInFlightPerUser) throw limitError('TOO_MANY_IN_FLIGHT');

      const lastMinute = await tx.chat_messages.count({
        where: { user_id: userId, role: 'user', created_at: { gt: new Date(at.getTime() - 60_000) } },
      });
      if (lastMinute >= limits.sendsPerMinute) throw limitError('RATE_LIMITED');

      const profile = await tx.profiles.findUnique({
        where: { id: userId },
        select: { timezone: true, crisis_country_code: true },
      });

      // Daily allowance (Phase 5): counted under the same per-member lock as the checks above, so
      // concurrent sends across serverless instances cannot both take the last message.
      if (gate && gate.decision.allowed && entitlement) {
        const window = usageWindowFor(at, profile?.timezone);
        const used = await tx.chat_messages.count({ where: dailyUsageWhere(userId, window.start, staleCutoff) });
        const limit = gate.decision.dailyLimit;
        entitlement.used = used;
        entitlement.limit = limit;
        entitlement.timeZone = window.timeZone;
        if (used >= limit) {
          entitlement.outcome = 'DAILY_LIMIT_REACHED';
          if (gate.mode === 'enforce') {
            throw new ConversationError(
              'DAILY_LIMIT_REACHED',
              429,
              'You’ve reached today’s chat limit. It resets at midnight in your time zone.',
              { limit, resets_at: window.resetsAt.toISOString() }
            );
          }
        }
      }

      const priorUserMessages = await tx.chat_messages.count({
        where: { conversation_id: conversationId, user_id: userId, role: 'user' },
      });

      // Short-term context: the last N COMPLETE messages, oldest first. Pending/failed/interrupted
      // rows never reach the model.
      const historyRows = await tx.chat_messages.findMany({
        where: { conversation_id: conversationId, user_id: userId, status: 'complete' },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: HISTORY_MESSAGES,
        select: { role: true, content: true },
      });
      const history: EzriHistoryItem[] = historyRows
        .reverse()
        .map((row) => ({ role: row.role as EzriHistoryItem['role'], content: row.content }));

      // A re-send of a failed message replaces it, so it moves to "now" in the thread.
      if (existing) {
        await tx.chat_messages.delete({ where: { id: existing.id } });
      }
      const userMessage = await tx.chat_messages.create({
        data: {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content,
          status: 'pending',
          client_message_id: input.client_message_id,
        },
        select: messageSelect,
      });

      // The failed row being replaced does not count as an earlier message.
      const isFirstUserMessage = priorUserMessages - (existing ? 1 : 0) === 0;
      const derived = isFirstUserMessage && conversation.title === defaultConversationTitle(conversation.companion_key)
        ? deriveConversationTitle(content)
        : '';

      await tx.chat_conversations.update({
        where: { id: conversationId },
        data: { last_message_at: at, updated_at: at, ...(derived ? { title: derived } : {}) },
      });

      return {
        conversationId,
        userMessage: toMessage(userMessage),
        retried: Boolean(existing),
        ...(entitlement ? { entitlement } : {}),
        ezriRequest: {
          prompt: content,
          userId,
          sessionId: `text_${conversationId}`,
          history,
          avatarName: companionDisplayName(conversation.companion_key) || conversation.companion_key,
          countryCode: profile?.crisis_country_code ?? null,
          timezone: profile?.timezone ?? null,
        },
      };
    },
    { timeout: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  );
}

/** Stores the finished reply and marks the user message delivered. */
export async function completeTurn(
  userId: string,
  conversationId: string,
  userMessageId: string,
  replyText: string,
  now: () => Date = () => new Date()
): Promise<{ userMessage: ConversationMessage; assistantMessage: ConversationMessage }> {
  const content = replyText.length > MAX_REPLY_CHARS ? replyText.slice(0, MAX_REPLY_CHARS) : replyText;
  return prisma.$transaction(async (tx) => {
    const userMessage = await tx.chat_messages.update({
      where: { id: userMessageId, user_id: userId },
      data: { status: 'complete' },
      select: messageSelect,
    });
    const assistantMessage = await tx.chat_messages.create({
      data: { conversation_id: conversationId, user_id: userId, role: 'assistant', content, status: 'complete' },
      select: messageSelect,
    });
    const at = now();
    await tx.chat_conversations.update({
      where: { id: conversationId },
      data: { last_message_at: at, updated_at: at },
    });
    return { userMessage: toMessage(userMessage), assistantMessage: toMessage(assistantMessage) };
  });
}

/**
 * Marks the user message `failed` so the member can retry it (same client_message_id).
 * No partial reply is stored (decision D7 pending; this mirrors Ezri, which stores nothing for an
 * interrupted turn). Best-effort: never throws.
 */
export async function failTurn(userId: string, userMessageId: string): Promise<void> {
  try {
    await prisma.chat_messages.updateMany({
      where: { id: userMessageId, user_id: userId, status: 'pending' },
      data: { status: 'failed' },
    });
  } catch {
    // A stale `pending` row stops blocking after the staleness window anyway.
  }
}
