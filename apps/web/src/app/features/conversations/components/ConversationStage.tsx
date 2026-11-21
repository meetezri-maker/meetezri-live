import type { ReactNode } from "react";
import { ArrowLeft, MessageSquareMore, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationCompanion } from "../types";
import { ChatHorizon } from "./ChatHorizon";
import { CompanionAvatar } from "./CompanionAvatar";
import { conversationsPanel, conversationsPrimaryPill } from "./conversationsUi";

export const CONVERSATION_LIST_PANEL_ID = "conversation-history-panel";

/** Desktop-only show/hide control for the history column (compact desktop widths). */
export interface ListToggle {
  visible: boolean;
  onToggle: () => void;
}

export function ListToggleButton({ toggle, className }: { toggle: ListToggle; className?: string }) {
  const Icon = toggle.visible ? PanelLeftClose : PanelLeftOpen;
  return (
    <button
      type="button"
      onClick={toggle.onToggle}
      aria-expanded={toggle.visible}
      aria-controls={CONVERSATION_LIST_PANEL_ID}
      aria-label={toggle.visible ? "Hide conversation list" : "Show conversation list"}
      title={toggle.visible ? "Hide conversation list" : "Show conversation list"}
      className={cn(
        "hidden rounded-full p-2 text-[color:var(--solace-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--solace-text)_8%,transparent)] hover:text-[color:var(--solace-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 lg:inline-flex",
        className
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Shared glass panel + horizon artwork for every main-region state. */
export function StageShell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={cn(conversationsPanel, "flex min-h-0 flex-col", className)}>
      <ChatHorizon />
      {children}
    </section>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      {children}
    </div>
  );
}

function StageIcon() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-500/80 to-fuchsia-500/60 text-white shadow-[0_0_40px_-6px_rgba(192,132,252,0.75)]">
      <MessageSquareMore className="h-7 w-7" aria-hidden />
    </span>
  );
}

const stageTitle = "mt-5 text-2xl font-semibold tracking-tight text-white [html[data-ezri-theme=light]_&]:text-[color:var(--solace-text)]";
const stageBody = "mt-2 max-w-sm text-sm text-violet-100/85 [html[data-ezri-theme=light]_&]:text-[color:var(--solace-muted)]";

/** Nothing selected: "Start a Conversation". */
export function ConversationStartState({
  onStartNew,
  listToggle,
  className,
}: {
  onStartNew: () => void;
  listToggle?: ListToggle;
  className?: string;
}) {
  return (
    <StageShell label="Start a conversation" className={className}>
      {listToggle && !listToggle.visible ? (
        <ListToggleButton toggle={listToggle} className="absolute left-3 top-3 z-20 text-white/80" />
      ) : null}
      <CenteredState>
        <StageIcon />
        <h2 className={stageTitle}>Start a Conversation</h2>
        <p className={stageBody}>Choose a companion and begin a new chat whenever you’re ready.</p>
        <button type="button" onClick={onStartNew} className={cn(conversationsPrimaryPill, "mt-6 px-6")}>
          <Plus className="h-4 w-4" aria-hidden />
          Start a New Conversation
        </button>
      </CenteredState>
    </StageShell>
  );
}

/** Brief "Preparing your chat…" moment while the conversation is created. */
export function PreparingChatState({ companion, className }: { companion: ConversationCompanion; className?: string }) {
  return (
    <StageShell label="Preparing your chat" className={className}>
      <CenteredState>
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          <span className="relative">
            <span className="absolute inset-0 rounded-full bg-fuchsia-400/40 blur-xl motion-safe:animate-pulse" aria-hidden />
            <CompanionAvatar companion={companion} sizeClassName="h-20 w-20" className="relative ring-2 ring-fuchsia-200/70" />
          </span>
          <p className={cn(stageTitle, "text-lg")}>Preparing your chat…</p>
          <p className={stageBody}>Starting your conversation with {companion.displayName}.</p>
          <span className="mt-4 flex gap-1.5" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-violet-200 motion-safe:animate-pulse"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </div>
      </CenteredState>
    </StageShell>
  );
}

/** Deep link to a thread while the saved conversations are still loading (API service only). */
export function LoadingConversationState({ className }: { className?: string }) {
  return (
    <StageShell label="Loading conversation" className={className}>
      <CenteredState>
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          <StageIcon />
          <p className={cn(stageTitle, "text-lg")}>Loading your conversation…</p>
        </div>
      </CenteredState>
    </StageShell>
  );
}

/** Unknown id — including preview threads lost on refresh (in-memory only). */
export function ConversationNotFoundState({
  onBack,
  onStartNew,
  listToggle,
  preview = true,
  className,
}: {
  onBack: () => void;
  onStartNew: () => void;
  listToggle?: ListToggle;
  /** Preview copy explains lost in-memory chats; the saved (API) service doesn't lose them. */
  preview?: boolean;
  className?: string;
}) {
  return (
    <StageShell label="Conversation not found" className={className}>
      <header className="relative z-10 flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 lg:hidden [html[data-ezri-theme=light]_&]:text-[color:var(--solace-text)]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        {listToggle && !listToggle.visible ? <ListToggleButton toggle={listToggle} className="text-white/80" /> : null}
      </header>
      <CenteredState>
        <StageIcon />
        <h2 className={stageTitle}>This conversation isn’t available</h2>
        <p className={stageBody}>
          {preview
            ? "It may have been a preview conversation — preview chats aren’t saved and reset when the page reloads."
            : "It may have been removed, or the link may be incorrect."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onStartNew} className={cn(conversationsPrimaryPill, "px-6")}>
            <Plus className="h-4 w-4" aria-hidden />
            Start a New Conversation
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 [html[data-ezri-theme=light]_&]:border-violet-200 [html[data-ezri-theme=light]_&]:text-violet-800"
          >
            Back to Conversations
          </button>
        </div>
      </CenteredState>
    </StageShell>
  );
}
