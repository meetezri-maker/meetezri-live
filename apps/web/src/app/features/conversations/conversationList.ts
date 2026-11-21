import type { ConversationSummary } from "./types";

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** List timestamp label: "Today", "Yesterday", otherwise "Oct 27". */
export function formatConversationListDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / DAY_MS);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Bubble timestamp, e.g. "10:24 AM". */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const TITLE_MAX_CHARS = 40;

/**
 * Basic title from the first user message: whitespace collapsed, cut at a word boundary within
 * 40 characters with an ellipsis. Returns "" for blank input so callers keep their default title.
 */
export function deriveConversationTitle(firstUserMessage: string): string {
  const text = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= TITLE_MAX_CHARS) return text.charAt(0).toUpperCase() + text.slice(1);
  const cut = text.slice(0, TITLE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > 15 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, "");
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}…`;
}

/** List preview excerpt: single line, ~60 characters. */
export function toPreviewExcerpt(content: string): string {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}

/** Most recent activity first. Does not mutate the input. */
export function sortConversationsByRecent(items: readonly ConversationSummary[]): ConversationSummary[] {
  return [...items].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

/** Title search (case-insensitive). An empty query returns everything. */
export function filterConversationsByTitle(
  items: readonly ConversationSummary[],
  query: string
): ConversationSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => item.title.toLowerCase().includes(q));
}
