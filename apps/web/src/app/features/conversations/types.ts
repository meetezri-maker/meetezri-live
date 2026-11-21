/**
 * Conversations Module — UI types.
 *
 * Shaped after the conceptual schema from the Phase 1 audit so a future adapter can map the
 * approved backend contract onto them. Nothing here is persisted.
 *
 * `companionKey` is ALWAYS a canonical id from `DEFAULT_AI_COMPANIONS` (e.g. "Maya Chen"),
 * never a member-facing display name (e.g. "Tessa"). Display names are derived at render time.
 */

/** Canonical companion id from `DEFAULT_AI_COMPANIONS[].id`. */
export type ConversationCompanionKey = string;

export interface ConversationSummary {
  id: string;
  companionKey: ConversationCompanionKey;
  title: string;
  /** Short excerpt of the latest message, already trimmed for display. */
  preview: string;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export type ConversationMessageRole = "user" | "assistant";

/**
 * `pending`  — user message accepted locally, not yet acknowledged.
 * `complete` — delivered (user) / finished (assistant).
 * `failed`   — could not be delivered; the UI offers a retry.
 * `streaming` is reserved for a future streaming adapter.
 */
export type ConversationMessageStatus = "pending" | "streaming" | "complete" | "failed";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: string;
  status: ConversationMessageStatus;
}

/** A selectable companion, derived from the shared registry — never defined independently. */
export interface ConversationCompanion {
  key: ConversationCompanionKey;
  displayName: string;
  /** `null` when no portrait asset resolves; callers render an initial instead. */
  portraitUrl: string | null;
}
