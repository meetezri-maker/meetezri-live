import type {
  ConversationCompanionKey,
  ConversationMessage,
  ConversationSummary,
} from "./types";

/**
 * Frontend-facing contract for the Conversations UI.
 *
 * Deliberately NOT modelled on any backend endpoint: the AI team owns the real chat system and its
 * transport/auth. A future adapter maps their approved contract onto this interface; components
 * never talk to a transport directly.
 *
 * Reads are synchronous snapshots (`getSnapshot`) so React can subscribe with
 * `useSyncExternalStore`; writes are async and report progress through the snapshot.
 */
export interface ConversationsSnapshot {
  /** Most recently active first. */
  conversations: ConversationSummary[];
  /** Messages per conversation id, oldest first. */
  messagesById: Readonly<Record<string, ConversationMessage[]>>;
  /** Conversation ids where the companion is currently "typing". */
  typingIds: readonly string[];
  /**
   * Conversation-list load state. The in-memory preview is always "ready"; the API adapter starts
   * "idle" and loads on the first `listConversations()` call.
   */
  listStatus?: "idle" | "loading" | "ready" | "error";
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  signal?: AbortSignal;
}

export interface ConversationService {
  /**
   * "mock" adapters must be labelled as previews in the UI. "api" is the real, authenticated
   * Solace API (`apiConversationService.ts`): replies come from the companion and are saved.
   */
  readonly kind: "mock" | "api";
  /**
   * Account isolation: the authenticated user whose data this service holds (null for the inert
   * placeholder used while nobody is signed in). A service is never reused for another user.
   */
  readonly ownerId?: string | null;
  /** True once disposed: it will never publish state or start requests again. */
  readonly disposed?: boolean;
  /** Abort all pending work, drop all data, and stop publishing. Idempotent. */
  dispose?(): void;
  getSnapshot(): ConversationsSnapshot;
  subscribe(listener: () => void): () => void;
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationSummary | null>;
  createConversation(input: { companionKey: ConversationCompanionKey }): Promise<ConversationSummary>;
  listMessages(conversationId: string): Promise<ConversationMessage[]>;
  /** Resolves with the companion reply. Rejects on validation, busy, failure or abort. */
  sendMessage(input: SendMessageInput): Promise<ConversationMessage>;
  /** Re-sends a `failed` user message in place. */
  retryMessage(messageId: string): Promise<ConversationMessage>;
}

export type ConversationServiceErrorCode =
  | "EMPTY_MESSAGE"
  | "NOT_FOUND"
  | "BUSY"
  | "SEND_FAILED"
  | "ABORTED";

export class ConversationServiceError extends Error {
  constructor(readonly code: ConversationServiceErrorCode, message: string) {
    super(message);
    this.name = "ConversationServiceError";
  }
}
