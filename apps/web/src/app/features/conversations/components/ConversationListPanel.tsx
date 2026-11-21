import { Link } from "react-router-dom";
import { MessageSquareMore, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONVERSATIONS_ROUTE_PATH } from "../conversationsFlag";
import { formatConversationListDate } from "../conversationList";
import { resolveConversationCompanion } from "../conversationCompanions";
import type { ConversationSummary } from "../types";
import { CompanionAvatar } from "./CompanionAvatar";
import { CONVERSATION_LIST_PANEL_ID } from "./ConversationStage";
import {
  conversationsField,
  conversationsPanel,
  conversationsPreviewBadge,
  conversationsPrimaryPill,
  conversationsRowActive,
} from "./conversationsUi";

interface ConversationListPanelProps {
  conversations: ConversationSummary[];
  /** Total before search filtering — distinguishes "no conversations" from "no matches". */
  totalCount: number;
  /** Data comes from the simulated preview service. */
  preview: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | null;
  onStartNew: () => void;
  className?: string;
}

/** Conversation history column: header, Start New Conversation, title search, list. */
export function ConversationListPanel({
  conversations,
  totalCount,
  preview,
  query,
  onQueryChange,
  selectedId,
  onStartNew,
  className,
}: ConversationListPanelProps) {
  return (
    <section
      id={CONVERSATION_LIST_PANEL_ID}
      aria-labelledby="conversations-heading"
      className={cn(conversationsPanel, "flex min-h-0 flex-col p-4 sm:p-5", className)}
    >
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-500/15 text-violet-200 shadow-[0_0_20px_-6px_rgba(168,85,247,0.6)] [html[data-ezri-theme=light]_&]:bg-violet-100 [html[data-ezri-theme=light]_&]:text-violet-600">
          <MessageSquareMore className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              id="conversations-heading"
              className="text-xl font-semibold tracking-tight text-[color:var(--solace-text)]"
            >
              Conversations
            </h1>
            {preview ? (
              <span
                className={conversationsPreviewBadge}
                title="Simulated preview. Conversations aren’t loaded from or saved to your account."
              >
                Preview
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-[color:var(--solace-muted)]">Your text chats with Solace.</p>
        </div>
      </header>

      <button type="button" onClick={onStartNew} className={cn(conversationsPrimaryPill, "mt-4 w-full")}>
        <Plus className="h-4 w-4" aria-hidden />
        Start a New Conversation
      </button>

      <label className={cn(conversationsField, "mt-3")}>
        <Search className="h-4 w-4 shrink-0 text-[color:var(--solace-muted)]" aria-hidden />
        <span className="sr-only">Search conversations by title</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search conversations…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--solace-text)] placeholder:text-[color:var(--solace-muted)] focus:outline-none"
        />
      </label>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain lg:-mr-2 lg:pr-2">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <p className="text-sm font-medium text-[color:var(--solace-text)]">No conversations yet</p>
            <p className="mt-1 text-xs text-[color:var(--solace-muted)]">
              Start a new conversation with a Solace companion.
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[color:var(--solace-muted)]" role="status">
            No conversations match “{query.trim()}”.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Conversation history">
            {conversations.map((conversation) => {
              const companion = resolveConversationCompanion(conversation.companionKey);
              const active = conversation.id === selectedId;
              return (
                <li key={conversation.id}>
                  <Link
                    to={`${CONVERSATIONS_ROUTE_PATH}/${encodeURIComponent(conversation.id)}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70",
                      active
                        ? conversationsRowActive
                        : "hover:bg-[color-mix(in_srgb,var(--solace-text)_5%,transparent)]"
                    )}
                  >
                    <CompanionAvatar companion={companion} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[color:var(--solace-text)]">
                          {conversation.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-[color:var(--solace-muted)]">
                          {formatConversationListDate(conversation.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[color:var(--solace-muted)]">
                        <span className="sr-only">With {companion.displayName}. </span>
                        {conversation.preview}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
