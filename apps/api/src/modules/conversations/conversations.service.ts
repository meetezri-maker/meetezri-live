import { companionDisplayName } from '@meetezri/shared';
import prisma from '../../lib/prisma';
import {
  PREVIEW_MAX_CHARS,
  type ConversationListResponse,
  type ConversationMessage,
  type ConversationSummary,
  type CreateConversationInput,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type MessageListResponse,
} from './conversations.schema';

/**
 * Conversations Module (text chat) — persistence.
 *
 * OWNERSHIP: every read is scoped by `user_id` taken from the verified JWT. A conversation that
 * exists but belongs to someone else is indistinguishable from one that does not exist (404), so
 * ids cannot be probed. `chat_messages` additionally carries `user_id`, enforced equal to the
 * conversation owner by a composite foreign key.
 *
 * ISOLATION: this module touches only `chat_conversations` / `chat_messages`. It never reads or
 * writes `app_sessions`, `session_messages`, credits, or subscriptions.
 */

export type ConversationErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'INVALID_CURSOR'
  | 'PROFILE_NOT_FOUND'
  // Phase 2 — sending (conversations.turn.service.ts)
  | 'REPLY_IN_PROGRESS'
  | 'DUPLICATE_MESSAGE'
  | 'TOO_MANY_IN_FLIGHT'
  | 'RATE_LIMITED'
  // Phase 5 — text-chat entitlements (conversations/textChatEntitlements.ts)
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_NOT_ELIGIBLE'
  | 'PLAN_NOT_ELIGIBLE'
  | 'DAILY_LIMIT_REACHED';

export class ConversationError extends Error {
  constructor(
    readonly code: ConversationErrorCode,
    readonly statusCode: number,
    message: string,
    /** Extra, member-safe fields returned with the error (e.g. `limit`, `resets_at`). */
    readonly details?: Record<string, string | number>
  ) {
    super(message);
    this.name = 'ConversationError';
  }
}

const notFound = () =>
  new ConversationError('CONVERSATION_NOT_FOUND', 404, 'This conversation isn’t available.');

// ---------------------------------------------------------------------------------------------
// Cursors: base64url(JSON { t: ISO timestamp, id: uuid }) — opaque to clients.
// ---------------------------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: at.toISOString(), id }), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): { at: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      t?: unknown;
      id?: unknown;
    };
    const at = typeof parsed.t === 'string' ? new Date(parsed.t) : null;
    if (!at || Number.isNaN(at.getTime()) || typeof parsed.id !== 'string' || !UUID_RE.test(parsed.id)) {
      throw new Error('bad cursor');
    }
    return { at, id: parsed.id };
  } catch {
    throw new ConversationError('INVALID_CURSOR', 400, 'Invalid pagination cursor.');
  }
}

// ---------------------------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------------------------

export function toPreviewExcerpt(content: string | null | undefined): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd()}…` : text;
}

type ConversationRow = {
  id: string;
  companion_key: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  chat_messages?: Array<{ content: string }>;
};

function toSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    companion_key: row.companion_key,
    title: row.title,
    preview: toPreviewExcerpt(row.chat_messages?.[0]?.content),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    last_message_at: row.last_message_at.toISOString(),
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

function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role as ConversationMessage['role'],
    content: row.content,
    status: row.status as ConversationMessage['status'],
    created_at: row.created_at.toISOString(),
  };
}

const summarySelect = {
  id: true,
  companion_key: true,
  title: true,
  created_at: true,
  updated_at: true,
  last_message_at: true,
  chat_messages: {
    select: { content: true },
    orderBy: [{ created_at: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
  },
};

const messageSelect = {
  id: true,
  conversation_id: true,
  role: true,
  content: true,
  status: true,
  created_at: true,
};

// ---------------------------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------------------------

export function defaultConversationTitle(companionKey: string): string {
  const name = companionDisplayName(companionKey) || companionKey;
  return `New chat with ${name}`;
}

export async function createConversation(
  userId: string,
  input: CreateConversationInput
): Promise<ConversationSummary> {
  try {
    const row = await prisma.chat_conversations.create({
      data: {
        user_id: userId,
        companion_key: input.companion_key,
        title: input.title ?? defaultConversationTitle(input.companion_key),
      },
      select: summarySelect,
    });
    return toSummary(row);
  } catch (error: any) {
    // FK to profiles: the member has no profile row yet (onboarding incomplete).
    if (error?.code === 'P2003') {
      throw new ConversationError(
        'PROFILE_NOT_FOUND',
        400,
        'User profile not found. Please complete onboarding first.'
      );
    }
    throw error;
  }
}

export async function listConversations(
  userId: string,
  query: ListConversationsQuery
): Promise<ConversationListResponse> {
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const rows = await prisma.chat_conversations.findMany({
    where: {
      user_id: userId,
      ...(cursor
        ? {
            OR: [
              { last_message_at: { lt: cursor.at } },
              { last_message_at: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ last_message_at: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    select: summarySelect,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(toSummary),
    next_cursor: hasMore && last ? encodeCursor(last.last_message_at, last.id) : null,
  };
}

export async function getConversation(userId: string, conversationId: string): Promise<ConversationSummary> {
  const row = await prisma.chat_conversations.findFirst({
    where: { id: conversationId, user_id: userId },
    select: summarySelect,
  });
  if (!row) throw notFound();
  return toSummary(row);
}

export async function listMessages(
  userId: string,
  conversationId: string,
  query: ListMessagesQuery
): Promise<MessageListResponse> {
  // Ownership first: an unowned or unknown conversation is a 404, never an empty list.
  const owned = await prisma.chat_conversations.findFirst({
    where: { id: conversationId, user_id: userId },
    select: { id: true },
  });
  if (!owned) throw notFound();

  const before = query.before ? decodeCursor(query.before) : null;

  // Newest page first, then reversed so the response is oldest-first (render order).
  const rows = await prisma.chat_messages.findMany({
    where: {
      conversation_id: conversationId,
      user_id: userId,
      ...(before
        ? {
            OR: [
              { created_at: { lt: before.at } },
              { created_at: before.at, id: { lt: before.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    select: messageSelect,
  });

  const hasMore = rows.length > query.limit;
  const page = (hasMore ? rows.slice(0, query.limit) : rows).reverse();
  const oldest = page[0];

  return {
    items: page.map(toMessage),
    next_before: hasMore && oldest ? encodeCursor(oldest.created_at, oldest.id) : null,
  };
}
