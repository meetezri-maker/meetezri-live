import { describe, expect, it } from "vitest";
import { DEFAULT_AI_COMPANIONS } from "@meetezri/shared";
import { listConversationCompanions, resolveConversationCompanion } from "./conversationCompanions";
import {
  deriveConversationTitle,
  filterConversationsByTitle,
  formatConversationListDate,
  formatMessageTime,
  sortConversationsByRecent,
  toPreviewExcerpt,
} from "./conversationList";
import { buildPreviewConversations } from "./mocks/previewConversations";

describe("conversation companions (shared registry)", () => {
  it("offers all seven companions in the reference order, by display name", () => {
    expect(listConversationCompanions().map((c) => c.displayName)).toEqual([
      "Romy",
      "Frankie",
      "Tessa",
      "Andre",
      "Bianca",
      "Damian",
      "Sasha",
    ]);
  });

  it("keys every companion by its canonical registry id, never a display name", () => {
    const registryIds = DEFAULT_AI_COMPANIONS.map((c) => c.id);
    const companions = listConversationCompanions();
    for (const companion of companions) {
      expect(registryIds).toContain(companion.key);
    }
    expect(companions.map((c) => c.key)).toEqual([
      "Sara Mitchell",
      "Alex",
      "Maya Chen",
      "Jordan Taylor",
      "Bianca",
      "Damian",
      "Sasha",
    ]);
  });

  it("resolves an existing portrait asset for every companion", () => {
    const expectedFiles: Record<string, string> = {
      "Sara Mitchell": "Sara%20Mitchell.png",
      Alex: "Alex.png",
      "Maya Chen": "maya%20chen.png",
      "Jordan Taylor": "jordan%20Taylor.png",
      Bianca: "Bianca.png",
      Damian: "Damian.png",
      Sasha: "Sasha.png",
    };
    for (const companion of listConversationCompanions()) {
      expect(companion.portraitUrl).toMatch(new RegExp(`avatars/${expectedFiles[companion.key]}$`));
    }
  });

  it("maps canonical keys to member-facing names", () => {
    expect(resolveConversationCompanion("Maya Chen").displayName).toBe("Tessa");
    expect(resolveConversationCompanion("Alex").displayName).toBe("Frankie");
    expect(resolveConversationCompanion("Jordan Taylor").displayName).toBe("Andre");
    expect(resolveConversationCompanion("Sara Mitchell").displayName).toBe("Romy");
  });

  it("never shows another companion's face for an unknown key", () => {
    const unknown = resolveConversationCompanion("Someone Else");
    expect(unknown.portraitUrl).toBeNull();
    expect(unknown.displayName).toBe("Someone Else");
  });
});

describe("conversation list helpers", () => {
  const now = new Date(2026, 10, 18, 15, 0, 0);

  it("labels dates Today / Yesterday / short date", () => {
    expect(formatConversationListDate(new Date(2026, 10, 18, 9).toISOString(), now)).toBe("Today");
    expect(formatConversationListDate(new Date(2026, 10, 17, 23).toISOString(), now)).toBe("Yesterday");
    expect(formatConversationListDate(new Date(2026, 9, 27, 12).toISOString(), now)).toBe("Oct 27");
    expect(formatConversationListDate("not-a-date", now)).toBe("");
  });

  it("sorts most recent first without mutating the input", () => {
    const rows = buildPreviewConversations(now.getTime());
    const reversed = [...rows].reverse();
    const sorted = sortConversationsByRecent(reversed);
    expect(sorted.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    expect(reversed[0].id).toBe(rows[rows.length - 1].id);
  });

  it("filters by title, case-insensitively", () => {
    const rows = buildPreviewConversations(now.getTime());
    expect(filterConversationsByTitle(rows, "  overwhelm ").map((r) => r.title)).toEqual(["Managing Overwhelm"]);
    expect(filterConversationsByTitle(rows, "")).toHaveLength(rows.length);
    expect(filterConversationsByTitle(rows, "zzz")).toEqual([]);
  });

  it("derives a title from the first user message", () => {
    expect(deriveConversationTitle("  i want   to talk  ")).toBe("I want to talk");
    expect(deriveConversationTitle("   ")).toBe("");
    const long = deriveConversationTitle("I have been thinking a lot about how my mornings start lately");
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(41);
    expect(long).toBe("I have been thinking a lot about how my…");
  });

  it("formats bubble times and list excerpts", () => {
    expect(formatMessageTime(new Date(2026, 10, 18, 10, 24).toISOString())).toBe("10:24 AM");
    expect(formatMessageTime("bad")).toBe("");
    expect(toPreviewExcerpt("a\n b")).toBe("a b");
    expect(toPreviewExcerpt("x".repeat(80))).toHaveLength(58);
  });

  it("uses canonical companion keys in preview rows", () => {
    const registryIds = DEFAULT_AI_COMPANIONS.map((c) => c.id);
    for (const row of buildPreviewConversations(now.getTime())) {
      expect(registryIds).toContain(row.companionKey);
    }
  });
});
