/**
 * DEVELOPMENT-ONLY SEED DATA — Conversations Module preview.
 *
 * Sample history for visual review of the list and thread layouts. Never sent anywhere, never
 * saved, and excluded from production builds: the only reader (`createDefaultConversationService`)
 * gates it behind `import.meta.env.DEV`, which Vite folds to `false` in `vite build`.
 *
 * Companion messages are deliberately neutral "sample" text — they must not read as real
 * wellness guidance from Solace's AI.
 */
import type { ConversationMessage, ConversationSummary } from "../types";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

interface SeedThread {
  id: string;
  companionKey: string;
  title: string;
  ageMs: number;
  turns: Array<[ConversationMessage["role"], string]>;
}

const SAMPLE_REPLY = "Sample companion message for layout review.";

const SEED_THREADS: SeedThread[] = [
  {
    id: "preview-1",
    companionKey: "Maya Chen",
    title: "A Lighter Mind",
    ageMs: 1 * HOUR_MS,
    turns: [
      ["user", "I've been feeling a bit overwhelmed lately. It's hard to slow down."],
      ["assistant", SAMPLE_REPLY],
    ],
  },
  {
    id: "preview-2",
    companionKey: "Jordan Taylor",
    title: "Managing Overwhelm",
    ageMs: 1 * DAY_MS,
    turns: [
      ["user", "Can we break my week down together?"],
      ["assistant", SAMPLE_REPLY],
    ],
  },
  {
    id: "preview-3",
    companionKey: "Sara Mitchell",
    title: "Building Better Habits",
    ageMs: 5 * DAY_MS,
    turns: [
      ["user", "I want to build a small evening routine."],
      ["assistant", SAMPLE_REPLY],
    ],
  },
  {
    id: "preview-4",
    companionKey: "Alex",
    title: "A Fresh Perspective",
    ageMs: 8 * DAY_MS,
    turns: [
      ["user", "I keep going over the same conversation in my head."],
      ["assistant", SAMPLE_REPLY],
    ],
  },
  {
    id: "preview-5",
    companionKey: "Bianca",
    title: "Finding Balance",
    ageMs: 11 * DAY_MS,
    turns: [
      ["user", "Work and rest feel out of balance this month."],
      ["assistant", SAMPLE_REPLY],
    ],
  },
];

export interface PreviewSeed {
  conversations: ConversationSummary[];
  messagesById: Record<string, ConversationMessage[]>;
}

export function buildPreviewSeed(now: number = Date.now()): PreviewSeed {
  const conversations: ConversationSummary[] = [];
  const messagesById: Record<string, ConversationMessage[]> = {};
  for (const thread of SEED_THREADS) {
    const end = now - thread.ageMs;
    const messages = thread.turns.map(([role, content], index): ConversationMessage => ({
      id: `${thread.id}-m${index + 1}`,
      conversationId: thread.id,
      role,
      content,
      createdAt: new Date(end - (thread.turns.length - 1 - index) * 2 * MINUTE_MS).toISOString(),
      status: "complete",
    }));
    const startedAt = messages[0].createdAt;
    const last = messages[messages.length - 1];
    conversations.push({
      id: thread.id,
      companionKey: thread.companionKey,
      title: thread.title,
      preview: last.content,
      createdAt: startedAt,
      updatedAt: last.createdAt,
      lastMessageAt: last.createdAt,
    });
    messagesById[thread.id] = messages;
  }
  return { conversations, messagesById };
}

/** List-only rows (Package 1 helper, still used by tests). */
export function buildPreviewConversations(now: number = Date.now()): ConversationSummary[] {
  return buildPreviewSeed(now).conversations;
}
