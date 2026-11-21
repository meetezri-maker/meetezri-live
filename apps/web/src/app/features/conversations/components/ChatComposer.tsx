import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";
import { Plus, SendHorizontal, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { COARSE_POINTER_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { composerShell, sendButton } from "./conversationsUi";

export interface ChatComposerHandle {
  focus: () => void;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** A reply is in flight: typing stays allowed, sending does not. */
  busy: boolean;
  companionName: string;
  className?: string;
}

const MAX_HEIGHT_PX = 140;

/**
 * Message composer. Enter sends on desktop (fine pointer); Shift+Enter adds a line. On touch
 * devices Enter keeps its natural newline behaviour and the send button sends.
 * The "+" and emoji controls are visibly disabled — attachments and emoji are not part of this
 * package.
 */
export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { value, onChange, onSend, busy, companionName, className },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const coarsePointer = useMediaQuery(COARSE_POINTER_QUERY);
  const canSend = value.trim().length > 0 && !busy;

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    },
  }));

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || coarsePointer) return;
    event.preventDefault();
    if (canSend) onSend();
  };

  return (
    <form
      className={cn("flex items-end gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <button
        type="button"
        disabled
        title="Attachments aren’t available"
        aria-label="Add attachment (not available)"
        className="mb-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-violet-100 opacity-50 sm:flex [html[data-ezri-theme=light]_&]:border-violet-200 [html[data-ezri-theme=light]_&]:text-violet-700"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <div className={composerShell}>
        <label htmlFor="conversation-composer" className="sr-only">
          Message {companionName}
        </label>
        <textarea
          id="conversation-composer"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          enterKeyHint={coarsePointer ? "enter" : "send"}
          aria-describedby="conversation-composer-hint"
          className="max-h-[140px] min-h-[1.5rem] min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[0.9375rem] leading-6 text-[#24163d] placeholder:text-[#7a6a96] focus:outline-none"
        />
        <span id="conversation-composer-hint" className="sr-only">
          {coarsePointer ? "Use the send button to send." : "Press Enter to send, Shift and Enter for a new line."}
        </span>
        <button
          type="button"
          disabled
          title="Emoji aren’t available yet"
          aria-label="Emoji (not available)"
          className="mb-1 shrink-0 rounded-full p-1 text-[#7a6a96] opacity-50"
        >
          <Smile className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <button type="submit" disabled={!canSend} aria-label="Send message" className={sendButton}>
        <SendHorizontal className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </form>
  );
});
