/**
 * Floating quick-chat state machine. In memory only (no storage): it lives in the member shell
 * (`AppLayout`), which stays mounted across `/app/*` navigation, so the thread survives page changes
 * and resets on refresh — the same lifetime as the in-memory conversation service.
 *
 *   idle ──open──▶ selecting ──confirm──▶ preparing ──created──▶ open
 *    ▲                 │cancel                │failed              │minimize / suspend / expand
 *    │                 ▼                      ▼                    ▼
 *    └────close──── (idle | minimized) ◀──────────────────── minimized ──resume──▶ open
 */
export type QuickChatMode = "idle" | "selecting" | "preparing" | "open" | "minimized";

export interface QuickChatState {
  mode: QuickChatMode;
  /** The quick-chat thread (resumable while minimized). */
  conversationId: string | null;
}

export type QuickChatAction =
  | { type: "OPEN_SELECTOR" }
  | { type: "CANCEL_SELECTOR" }
  | { type: "START_PREPARING" }
  | { type: "CREATED"; conversationId: string }
  | { type: "CREATE_FAILED" }
  | { type: "MINIMIZE" }
  | { type: "RESUME" }
  | { type: "EXPANDED" }
  | { type: "CLOSE" }
  /** Quick chat is not allowed here (route or safety state): tuck everything away, keep the thread. */
  | { type: "SUSPEND" }
  /** The thread no longer exists (e.g. service reset). */
  | { type: "FORGET" };

export const INITIAL_QUICK_CHAT_STATE: QuickChatState = { mode: "idle", conversationId: null };

const restingMode = (state: QuickChatState): QuickChatMode => (state.conversationId ? "minimized" : "idle");

export function quickChatReducer(state: QuickChatState, action: QuickChatAction): QuickChatState {
  switch (action.type) {
    case "OPEN_SELECTOR":
      return { ...state, mode: "selecting" };
    case "CANCEL_SELECTOR":
      return state.mode === "selecting" ? { ...state, mode: restingMode(state) } : state;
    case "START_PREPARING":
      return { ...state, mode: "preparing" };
    case "CREATED":
      // A new conversation replaces the previous quick-chat thread; the old one stays in Conversations.
      return { mode: "open", conversationId: action.conversationId };
    case "CREATE_FAILED":
      return { ...state, mode: restingMode(state) };
    case "MINIMIZE":
    case "EXPANDED":
      return { ...state, mode: restingMode(state) };
    case "RESUME":
      return state.conversationId ? { ...state, mode: "open" } : state;
    case "CLOSE":
      return INITIAL_QUICK_CHAT_STATE;
    case "SUSPEND":
      return state.mode === "open" || state.mode === "selecting" ? { ...state, mode: restingMode(state) } : state;
    case "FORGET":
      return INITIAL_QUICK_CHAT_STATE;
    default:
      return state;
  }
}
