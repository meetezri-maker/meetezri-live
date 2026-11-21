import { useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSafety } from "@/app/contexts/SafetyContext";
import { ChatPanel } from "../components/ChatPanel";
import { CompanionSelectorDialog } from "../components/CompanionSelectorDialog";
import { PreparingChatState } from "../components/ConversationStage";
import { resolveConversationCompanion } from "../conversationCompanions";
import { CONVERSATIONS_ROUTE_PATH } from "../conversationsFlag";
import { useConversationService, useConversationsSnapshot } from "../ConversationsServiceContext";
import { DESKTOP_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import type { ConversationCompanionKey } from "../types";
import { useStartConversation } from "../useStartConversation";
import { QuickChatLauncher } from "./QuickChatLauncher";
import { INITIAL_QUICK_CHAT_STATE, quickChatReducer } from "./quickChatState";
import { isQuickChatAllowed } from "./quickChatVisibility";
import { QuickChatActions, QuickChatWindow } from "./QuickChatWindow";

const EMPTY_MESSAGES: never[] = [];

/**
 * Floating quick chat — mounted by `AppLayout` only while `VITE_CONVERSATIONS_ENABLED` is on.
 *
 * Uses the same in-memory conversation service as the Conversations page, so a quick-chat thread
 * is the same thread everywhere: minimize/resume restores it, Expand opens it at
 * `/app/conversations/:id`, and Close only dismisses the window (the conversation stays listed).
 */
export function QuickChat({ compactNav = false }: { compactNav?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentState } = useSafety();
  const service = useConversationService();
  const snapshot = useConversationsSnapshot();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { start, preparing } = useStartConversation();
  const [state, dispatch] = useReducer(quickChatReducer, INITIAL_QUICK_CHAT_STATE);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const allowed = isQuickChatAllowed(location.pathname, currentState, true);
  const conversation = state.conversationId
    ? snapshot.conversations.find((c) => c.id === state.conversationId) ?? null
    : null;
  const companion = conversation ? resolveConversationCompanion(conversation.companionKey) : null;

  // Route or safety state no longer allows quick chat (voice session, safety screen, escalation…):
  // tuck the window away but keep the thread, so it can be resumed once allowed again.
  useEffect(() => {
    if (!allowed) dispatch({ type: "SUSPEND" });
  }, [allowed, state.mode]);

  useEffect(() => {
    if (state.conversationId && !conversation && state.mode !== "preparing") dispatch({ type: "FORGET" });
  }, [state.conversationId, conversation, state.mode]);

  // Return focus to the launcher when the desktop panel hides (the mobile sheet does it on close).
  const previousMode = useRef(state.mode);
  useEffect(() => {
    const wasShowing = previousMode.current === "open";
    previousMode.current = state.mode;
    if (wasShowing && state.mode !== "open" && isDesktop) launcherRef.current?.focus();
  }, [state.mode, isDesktop]);

  if (!allowed) return null;

  const confirm = async (companionKey: ConversationCompanionKey) => {
    dispatch({ type: "START_PREPARING" });
    const created = await start(companionKey);
    if (created) {
      dispatch({ type: "CREATED", conversationId: created.id });
    } else {
      dispatch({ type: "CREATE_FAILED" });
      toast.error(
        service.kind === "mock"
          ? "The preview couldn’t start a conversation. Please try again."
          : "We couldn’t start a conversation. Please try again."
      );
    }
  };

  const minimize = () => dispatch({ type: "MINIMIZE" });
  const close = () => dispatch({ type: "CLOSE" });
  const expand = () => {
    if (!state.conversationId) return;
    dispatch({ type: "EXPANDED" });
    navigate(`${CONVERSATIONS_ROUTE_PATH}/${encodeURIComponent(state.conversationId)}`);
  };

  const windowVisible = state.mode === "open" || state.mode === "preparing";
  const panelClass =
    "min-h-0 flex-1 shadow-[0_0_60px_-16px_rgba(168,85,247,0.6),0_30px_80px_-30px_rgba(0,0,0,0.8)] max-lg:rounded-b-none max-lg:border-b-0";

  return (
    <>
      {!windowVisible ? (
        <QuickChatLauncher
          ref={launcherRef}
          compactNav={compactNav}
          selectorOpen={state.mode === "selecting"}
          onStartNew={() => dispatch({ type: "OPEN_SELECTOR" })}
          resume={
            state.mode !== "selecting" && conversation && companion
              ? {
                  companion,
                  typing: snapshot.typingIds.includes(conversation.id),
                  onResume: () => dispatch({ type: "RESUME" }),
                  onClose: close,
                }
              : undefined
          }
        />
      ) : null}

      <CompanionSelectorDialog
        open={state.mode === "selecting"}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "CANCEL_SELECTOR" });
        }}
        onConfirm={confirm}
      />

      {windowVisible ? (
        <QuickChatWindow
          isDesktop={isDesktop}
          label={companion ? `Quick chat with ${companion.displayName}` : "Preparing your chat"}
          onMinimize={minimize}
          onRestoreFocus={() => launcherRef.current?.focus()}
        >
          {state.mode === "preparing" && preparing ? (
            <PreparingChatState companion={preparing} className={panelClass} />
          ) : conversation && companion ? (
            <ChatPanel
              key={conversation.id}
              variant="compact"
              autoFocusComposer
              conversation={conversation}
              companion={companion}
              messages={snapshot.messagesById[conversation.id] ?? EMPTY_MESSAGES}
              typing={snapshot.typingIds.includes(conversation.id)}
              headerActions={<QuickChatActions onMinimize={minimize} onExpand={expand} onClose={close} />}
              className={panelClass}
            />
          ) : null}
        </QuickChatWindow>
      ) : null}
    </>
  );
}

export default QuickChat;
