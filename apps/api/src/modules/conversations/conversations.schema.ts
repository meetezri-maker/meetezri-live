import { z } from 'zod';
import { DEFAULT_AI_COMPANIONS } from '@meetezri/shared';

/**
 * Conversations Module (text chat) — request/response contracts.
 *
 * Kept entirely separate from `sessions.schema.ts`: text chat never touches voice sessions,
 * `session_messages`, or minutes billing.
 */

/** Canonical companion ids (e.g. "Sara Mitchell"), never display names (e.g. "Romy"). */
export const CONVERSATION_COMPANION_KEYS: readonly string[] = DEFAULT_AI_COMPANIONS.map((c) => c.id);

export const TITLE_MAX_CHARS = 200;
export const PREVIEW_MAX_CHARS = 120;
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 50;
export const MESSAGES_DEFAULT_LIMIT = 50;
export const MESSAGES_MAX_LIMIT = 100;

export const createConversationSchema = z
  .object({
    companion_key: z
      .string()
      .trim()
      .refine((key) => CONVERSATION_COMPANION_KEYS.includes(key), {
        message: 'Unknown companion.',
      }),
    title: z.string().trim().min(1).max(TITLE_MAX_CHARS).optional(),
  })
  .strict();

export const conversationParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Opaque pagination cursor (base64url). Shape is validated when decoded. */
const cursorSchema = z.string().min(1).max(200);

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_MAX_LIMIT).default(LIST_DEFAULT_LIMIT),
  cursor: cursorSchema.optional(),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MESSAGES_MAX_LIMIT).default(MESSAGES_DEFAULT_LIMIT),
  /** Load messages OLDER than this cursor (scrolling back through a thread). */
  before: cursorSchema.optional(),
});

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  companion_key: z.string(),
  title: z.string(),
  /** Excerpt of the latest message, or "" when the thread has no messages yet. */
  preview: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  last_message_at: z.string(),
});

export const conversationMessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  status: z.enum(['pending', 'complete', 'interrupted', 'failed']),
  created_at: z.string(),
});

export const conversationListResponseSchema = z.object({
  items: z.array(conversationSummarySchema),
  next_cursor: z.string().nullable(),
});

export const messageListResponseSchema = z.object({
  /** Oldest first within the page. */
  items: z.array(conversationMessageSchema),
  /** Pass as `before` to load the previous (older) page; null when there is none. */
  next_before: z.string().nullable(),
});

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  code: z.string(),
  message: z.string(),
  /** DAILY_LIMIT_REACHED only: the member's allowance and when it resets (UTC ISO). */
  limit: z.number().optional(),
  resets_at: z.string().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
