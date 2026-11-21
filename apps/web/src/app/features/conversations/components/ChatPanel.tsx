import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationServiceError } from "../conversationService";
import { useConversationService } from "../ConversationsServiceContext";
import { DESKTOP_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { useKeyboardInset } from "../hooks/useKeyboardInset";
import type { ConversationCompanion, ConversationMessage, ConversationSummary } from "../types";
import { ChatComposer, type ChatComposerHandle } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";
import { CompanionAvatar } from "./CompanionAvatar";
import { ConversationSafety, type ConversationSafetyHandle } from "./ConversationSafety";
import { ListToggleButton, StageShell, type ListToggle } from "./ConversationStage";
import { conversationsPreviewBadge } from "./conversationsUi";

interface ChatPanelProps {
  conversation: ConversationSummary;
  companion: ConversationCompanion;
  messages: ConversationMessage[];
  typing: boolean;
  /** Mobile (page variant): back to the list. */
  onBack?: () => void;
  listToggle?: ListToggle;
  /** Page-level signal: aborts in-flight sends when the Conversations page unmounts. */
  getSignal?: () => AbortSignal | undefined;
  /**
   * `page`: full Conversations page (back button, list toggle).
   * `compact`: floating quick chat — `headerActions` (minimize / expand / close) replace them.
   */
  variant?: "page" | "compact";
  headerActions?: ReactNode;
  /** Focus the composer on mount (quick chat opening). */
  autoFocusComposer?: boolean;
  className?: string;
}

// Short landscape phones (e.g. 667×375) use `max-lg:[@media(max-height:480px)]:` variants below to
// tighten chrome so messages get the height. Written out literally — Tailwind only sees literals.

function errorText(error: unknown, preview: boolean): string | null {
  if (error instanceof ConversationServiceError) {
    return error.code === "ABORTED" ? null : error.message;
  }
  return preview ? "Something went wrong in the preview. Please try again." : "Something went wrong. Please try again.";
}

/** Full thread: companion header, message log, suggested starters, composer. */
export function ChatPanel({
  conversation,
  companion,
  messages,
  typing,
  onBack,
  listToggle,
  getSignal,
  variant = "page",
  headerActions,
  autoFocusComposer = false,
  className,
}: ChatPanelProps) {
  const compact = variant === "compact";
  const service = useConversationService();
  const preview = service.kind === "mock";
  // Real (saved, AI-replied) conversations only: client-side safety checks, as in voice sessions.
  const safetyRef = useRef<ConversationSafetyHandle>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const sendingRef = useRef(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const keyboardInset = useKeyboardInset(!isDesktop);

  const busy = sending || typing;
  const hasUserMessage = messages.some((m) => m.role === "user");

  const run = async (task: () => Promise<unknown>) => {
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(errorText(err, preview));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const send = () => {
    const text = draft;
    // Ref guard blocks a second submit in the same tick, before React re-renders.
    if (!text.trim() || sendingRef.current || typing) return;
    setDraft("");
    safetyRef.current?.check(text);
    void run(() => service.sendMessage({ conversationId: conversation.id, content: text, signal: getSignal?.() }));
  };

  const retry = (messageId: string) => {
    if (sendingRef.current || typing) return;
    void run(() => service.retryMessage(messageId));
  };

  const applyPrompt = (prompt: string) => {
    setDraft(prompt);
    composerRef.current?.focus();
  };

  useEffect(() => {
    if (autoFocusComposer) composerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StageShell label={`Conversation with ${companion.displayName}: ${conversation.title}`} className={className}>
      <header
        className={cn(
          "relative z-10 flex items-center gap-2.5 border-b border-white/10 px-3 sm:px-4 [html[data-ezri-theme=light]_&]:border-violet-100",
          compact ? "py-2" : "py-2.5 max-lg:[@media(max-height:480px)]:py-1"
        )}
      >
        {!compact && onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="rounded-full p-2 text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 lg:hidden [html[data-ezri-theme=light]_&]:text-[color:var(--solace-text)]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {!compact && listToggle ? <ListToggleButton toggle={listToggle} className="-ml-1 text-white/80" /> : null}
        <CompanionAvatar
          companion={companion}
          sizeClassName={
            compact
              ? "h-9 w-9"
              : "h-11 w-11 max-lg:[@media(max-height:480px)]:h-8 max-lg:[@media(max-height:480px)]:w-8"
          }
          className="ring-2 ring-fuchsia-200/50"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white [html[data-ezri-theme=light]_&]:text-[color:var(--solace-text)]">
            {companion.displayName}
          </h2>
          <p className="truncate text-xs text-violet-100/80 max-lg:[@media(max-height:480px)]:hidden [html[data-ezri-theme=light]_&]:text-[color:var(--solace-muted)]">
            Your Solace companion
          </p>
        </div>
        {preview ? (
          <span
            className={conversationsPreviewBadge}
            title="Simulated preview. Replies are not from Solace’s AI and nothing is saved."
          >
            Preview
          </span>
        ) : null}
        {headerActions}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ChatMessages
          conversationId={conversation.id}
          messages={messages}
          companion={companion}
          typing={typing}
          preview={preview}
          showPrompts={!hasUserMessage && !busy}
          onPrompt={applyPrompt}
          onRetry={retry}
        />
      </div>

      <div
        className={cn(
          "relative z-10 px-3 pt-2 sm:px-4",
          "pb-[calc(max(env(safe-area-inset-bottom,0px),0.75rem)+var(--conversation-keyboard-inset,0px))]",
          "max-lg:[@media(max-height:480px)]:pt-1 max-lg:[@media(max-height:480px)]:pb-[calc(max(env(safe-area-inset-bottom,0px),0.375rem)+var(--conversation-keyboard-inset,0px))]"
        )}
        style={{ ["--conversation-keyboard-inset" as string]: `${keyboardInset}px` }}
      >
        {error ? (
          <p role="alert" className="mb-2 text-center text-xs text-rose-200 [html[data-ezri-theme=light]_&]:text-rose-600">
            {error}
          </p>
        ) : null}
        <ChatComposer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSend={send}
          busy={busy}
          companionName={companion.displayName}
        />
      </div>
      {!preview ? <ConversationSafety ref={safetyRef} variant={variant} /> : null}
    </StageShell>
  );
}
