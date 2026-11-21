import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Check, CheckCheck, Clock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "../conversationList";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import type { ConversationCompanion, ConversationMessage } from "../types";
import { CompanionAvatar } from "./CompanionAvatar";
import { companionBubble, promptChip, userBubble } from "./conversationsUi";

/** Reference starters. Selecting one fills the composer; it is never sent automatically. */
export const SUGGESTED_PROMPTS = [
  "I’ve been feeling overwhelmed",
  "I want to gain clarity",
  "I just want to talk",
] as const;

const NEAR_BOTTOM_PX = 96;

function UserStatus({ message, read, onRetry }: { message: ConversationMessage; read: boolean; onRetry: () => void }) {
  if (message.status === "failed") {
    return (
      <span className="flex items-center gap-2 text-[11px] text-rose-200 [html[data-ezri-theme=light]_&]:text-rose-600">
        Not sent
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      </span>
    );
  }
  if (message.status === "pending") {
    return (
      <span className="inline-flex items-center" title="Sending">
        <Clock className="h-3 w-3" aria-hidden />
        <span className="sr-only">Sending</span>
      </span>
    );
  }
  return read ? (
    <span className="inline-flex items-center text-violet-700" title="Read">
      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Read</span>
    </span>
  ) : (
    <span className="inline-flex items-center" title="Sent">
      <Check className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Sent</span>
    </span>
  );
}

export function TypingIndicator({ companion }: { companion: ConversationCompanion }) {
  return (
    <div className="flex items-end gap-2.5" role="status" aria-live="polite">
      <CompanionAvatar companion={companion} sizeClassName="h-8 w-8" />
      <div className={cn(companionBubble, "flex items-center gap-1.5 px-4 py-3")} aria-hidden>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 rounded-full bg-violet-400 motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">{companion.displayName} is typing…</span>
    </div>
  );
}

interface ChatMessagesProps {
  conversationId: string;
  messages: ConversationMessage[];
  companion: ConversationCompanion;
  typing: boolean;
  /** In-memory preview: show the "replies are simulated" notice. Off for real conversations. */
  preview?: boolean;
  showPrompts: boolean;
  onPrompt: (prompt: string) => void;
  onRetry: (messageId: string) => void;
}

/**
 * Scrollable message log. Sticks to the newest message while the member is at the bottom, leaves
 * them alone while they read older messages (offering a "latest" shortcut), and jumps to the end
 * when a different thread opens.
 */
export function ChatMessages({
  conversationId,
  messages,
  companion,
  typing,
  preview = true,
  showPrompts,
  onPrompt,
  onRetry,
}: ChatMessagesProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [hasUnseen, setHasUnseen] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  const scrollToEnd = (smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (smooth && !reducedMotion && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    nearBottomRef.current = true;
    setHasUnseen(false);
  };

  // A streaming reply grows in place; follow it while the member is at the bottom.
  const last = messages[messages.length - 1];
  const streamingLength = last?.status === "streaming" ? last.content.length : 0;

  useLayoutEffect(() => {
    scrollToEnd(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (nearBottomRef.current) scrollToEnd(true);
    else setHasUnseen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typing, streamingLength]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottomRef.current) setHasUnseen(false);
  };

  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="solace-scroll h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 max-lg:[@media(max-height:480px)]:py-2"
      >
        {preview ? (
          <p className="mx-auto mb-4 max-lg:[@media(max-height:480px)]:mb-2 w-fit max-w-full rounded-full border border-white/15 bg-black/20 px-3 py-1 text-center text-[11px] text-violet-100/90 backdrop-blur-sm [html[data-ezri-theme=light]_&]:border-violet-200 [html[data-ezri-theme=light]_&]:bg-white/80 [html[data-ezri-theme=light]_&]:text-violet-800">
            Preview · replies are simulated · nothing is saved
          </p>
        ) : null}

        <ol className="flex flex-col gap-3" aria-label={`Messages with ${companion.displayName}`}>
          {messages.map((message, index) => {
            const time = formatMessageTime(message.createdAt);
            if (message.role === "user") {
              return (
                <li key={message.id} className="flex flex-col items-end gap-1 pl-8 sm:pl-16">
                  <div className={cn(userBubble, "max-w-[min(34rem,100%)] whitespace-pre-wrap break-words")}>
                    <span className="sr-only">You, {time}: </span>
                    {message.content}
                    <span className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-[#5b3d8c]">
                      <span aria-hidden>{time}</span>
                      {message.status !== "failed" ? (
                        <UserStatus message={message} read={lastAssistantIndex > index} onRetry={() => onRetry(message.id)} />
                      ) : null}
                    </span>
                  </div>
                  {message.status === "failed" ? (
                    <UserStatus message={message} read={false} onRetry={() => onRetry(message.id)} />
                  ) : null}
                </li>
              );
            }
            return (
              <li key={message.id} className="flex items-end gap-2.5 pr-8 sm:pr-16">
                <CompanionAvatar companion={companion} sizeClassName="h-8 w-8" />
                <div className={cn(companionBubble, "max-w-[min(34rem,100%)] whitespace-pre-wrap break-words")}>
                  <span className="sr-only">{companion.displayName}, {time}: </span>
                  {message.content}
                  <span className="mt-1 block text-right text-[11px] text-[#6b5a8a]" aria-hidden>
                    {time}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {showPrompts ? (
          <div className="mt-3 flex flex-wrap gap-2 pl-[2.625rem]" role="group" aria-label="Suggested conversation starters">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" className={promptChip} onClick={() => onPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {typing ? (
          <div className="mt-3">
            <TypingIndicator companion={companion} />
          </div>
        ) : null}
      </div>

      {hasUnseen ? (
        <button
          type="button"
          onClick={() => scrollToEnd(true)}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          New messages
        </button>
      ) : null}
    </div>
  );
}
