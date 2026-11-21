import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./components/ChatPanel";
import { CompanionSelectorDialog } from "./components/CompanionSelectorDialog";
import { ConversationListPanel } from "./components/ConversationListPanel";
import {
  ConversationNotFoundState,
  ConversationStartState,
  LoadingConversationState,
  PreparingChatState,
  type ListToggle,
} from "./components/ConversationStage";
import { resolveConversationCompanion } from "./conversationCompanions";
import { filterConversationsByTitle } from "./conversationList";
import { CONVERSATIONS_ROUTE_PATH } from "./conversationsFlag";
import { useConversationService, useConversationsSnapshot } from "./ConversationsServiceContext";
import { useMediaQuery, WIDE_DESKTOP_QUERY } from "./hooks/useMediaQuery";
import type { ConversationCompanionKey } from "./types";
import { useStartConversation } from "./useStartConversation";

const EMPTY_MESSAGES: never[] = [];

/**
 * Conversations Module — list + thread.
 *
 * - Wide desktop (≥1280): sidebar (AppLayout) · history column · chat.
 * - Compact desktop (1024–1279): the history column collapses while a thread is open, with an
 *   accessible toggle to bring it back.
 * - Mobile / tablet (<1024): the list is one screen; `/app/conversations/:id` is a full-screen
 *   thread (AppLayout hides the bottom navigation on that route).
 *
 * All data comes from the in-memory preview service; nothing reaches a backend or AI.
 */
export function ConversationsPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const service = useConversationService();
  const snapshot = useConversationsSnapshot();
  const isWide = useMediaQuery(WIDE_DESKTOP_QUERY);

  const [query, setQuery] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { start, preparing, error: startError, clearError } = useStartConversation();
  const [listPreference, setListPreference] = useState<boolean | null>(null);

  // One controller per page visit: leaving Conversations cancels any simulated reply in flight.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    return () => controller.abort();
  }, []);
  const getSignal = () => abortRef.current?.signal;

  const conversations = snapshot.conversations;
  const visible = useMemo(() => filterConversationsByTitle(conversations, query), [conversations, query]);
  const selected = conversationId ? conversations.find((c) => c.id === conversationId) ?? null : null;
  const companion = selected ? resolveConversationCompanion(selected.companionKey) : null;
  const preview = service.kind === "mock";
  // The preview has no load step (undefined = ready); the API service loads on first use.
  const listStatus = snapshot.listStatus ?? "ready";
  const [lookupPending, setLookupPending] = useState(false);

  // Load saved conversations (no-op cost for the in-memory preview).
  useEffect(() => {
    service.listConversations().catch(() => undefined);
  }, [service]);

  // Open thread: load its messages. A deep link outside the first page is fetched on its own.
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (selectedId) service.listMessages(selectedId).catch(() => undefined);
  }, [service, selectedId]);

  useEffect(() => {
    // The preview holds everything in memory already; only saved conversations need a lookup.
    if (preview || !conversationId || selectedId || listStatus !== "ready") return;
    let cancelled = false;
    setLookupPending(true);
    service
      .getConversation(conversationId)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLookupPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service, preview, conversationId, selectedId, listStatus]);

  const resolvingDeepLink =
    Boolean(conversationId) && !selected && (listStatus === "idle" || listStatus === "loading" || lookupPending);
  const inThread = Boolean(conversationId) || preparing !== null;

  const listVisible = listPreference ?? (isWide || !conversationId);
  const listToggle: ListToggle = { visible: listVisible, onToggle: () => setListPreference(!listVisible) };

  const backToList = () => navigate(CONVERSATIONS_ROUTE_PATH);
  const openSelector = () => {
    clearError();
    setSelectorOpen(true);
  };

  const startConversation = async (companionKey: ConversationCompanionKey) => {
    setSelectorOpen(false);
    const created = await start(companionKey);
    if (created) navigate(`${CONVERSATIONS_ROUTE_PATH}/${encodeURIComponent(created.id)}`);
  };

  const stageClass = "min-w-0 flex-1";

  let stage;
  if (preparing) {
    stage = <PreparingChatState companion={preparing} className={stageClass} />;
  } else if (selected && companion) {
    stage = (
      <ChatPanel
        key={selected.id}
        conversation={selected}
        companion={companion}
        messages={snapshot.messagesById[selected.id] ?? EMPTY_MESSAGES}
        typing={snapshot.typingIds.includes(selected.id)}
        onBack={backToList}
        listToggle={listToggle}
        getSignal={getSignal}
        className={stageClass}
      />
    );
  } else if (resolvingDeepLink) {
    stage = <LoadingConversationState className={stageClass} />;
  } else if (conversationId) {
    stage = (
      <ConversationNotFoundState
        onBack={backToList}
        onStartNew={openSelector}
        listToggle={listToggle}
        preview={preview}
        className={stageClass}
      />
    );
  } else {
    stage = <ConversationStartState onStartNew={openSelector} listToggle={listToggle} className={stageClass} />;
  }

  return (
    <div
      className={cn(
        // Bottom padding comes from AppLayout's main (lg:pb-8 / compact lg:pb-5); adding our own
        // on top left a 52px band under the panels.
        "relative flex w-full flex-col overflow-x-hidden lg:h-full lg:min-h-0 lg:px-6 lg:pt-5 lg:pb-0",
        inThread
          ? // Short landscape phones: drop the frame padding so the thread gets every pixel.
            "h-full min-h-0 p-0 sm:p-3 max-lg:[@media(max-height:480px)]:p-0"
          : "min-h-full px-3 py-4 sm:px-5 sm:py-5"
      )}
    >
      {listStatus === "error" ? (
        <p role="alert" className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 [html[data-ezri-theme=light]_&]:text-rose-700">
          We couldn’t load your conversations. Please refresh to try again.
        </p>
      ) : null}
      {startError ? (
        <p role="alert" className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 [html[data-ezri-theme=light]_&]:text-rose-700">
          {startError}
        </p>
      ) : null}
      {/* Full width of the member content area (no centred max-width): the history column keeps its
          fixed width and the chat panel takes the rest, as in the desktop references. */}
      <div className="flex min-h-0 w-full flex-1 gap-4 xl:gap-5">
        <ConversationListPanel
          conversations={visible}
          totalCount={conversations.length}
          preview={preview}
          query={query}
          onQueryChange={setQuery}
          selectedId={selected?.id ?? null}
          onStartNew={openSelector}
          className={cn(
            "w-full lg:w-[21rem] lg:shrink-0 xl:w-[23rem]",
            inThread && "max-lg:hidden",
            !listVisible && "lg:hidden"
          )}
        />
        {/* Mobile thread: square edges flush to the screen; desktop keeps the rounded panel. */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1",
            !inThread && "max-lg:hidden",
            inThread &&
              "max-sm:[&>section]:rounded-none max-sm:[&>section]:border-0 max-lg:[@media(max-height:480px)]:[&>section]:rounded-none max-lg:[@media(max-height:480px)]:[&>section]:border-0"
          )}
        >
          {stage}
        </div>
      </div>
      <CompanionSelectorDialog open={selectorOpen} onOpenChange={setSelectorOpen} onConfirm={startConversation} />
    </div>
  );
}
