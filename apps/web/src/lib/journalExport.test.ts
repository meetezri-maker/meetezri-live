import { describe, it, expect } from "vitest";
import {
  buildJournalJsonExport,
  filterJournalEntriesByDateRange,
  journalExportFileName,
  journalMoodLabel,
  validateJournalDateRange,
  type JournalExportEntry,
} from "./journalExport";

/** created_at for a local wall-clock time (the filter uses this device's calendar). */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

const entry = (id: string, created_at: string, over: Partial<JournalExportEntry> = {}): JournalExportEntry => ({
  id, title: `Entry ${id}`, content: "<div>Text</div>", mood_tags: [], is_private: false, location: null,
  created_at, updated_at: created_at, ...over,
});

const ENTRIES = [
  entry("before", local(2026, 9, 30, 23, 59)),
  entry("start", local(2026, 10, 1, 0, 0)),
  entry("mid", local(2026, 10, 15)),
  entry("end-late", local(2026, 10, 28, 23, 59)),
  entry("after", local(2026, 10, 29, 0, 1)),
];
const ids = (list: JournalExportEntry[]) => list.map((e) => e.id).sort();

describe("journal date range", () => {
  it("includes both whole end days in the device calendar", () => {
    expect(ids(filterJournalEntriesByDateRange(ENTRIES, "2026-10-01", "2026-10-28"))).toEqual(["end-late", "mid", "start"]);
  });

  it("handles no range, start-only and end-only", () => {
    expect(filterJournalEntriesByDateRange(ENTRIES, "", "")).toHaveLength(5);
    expect(ids(filterJournalEntriesByDateRange(ENTRIES, "2026-10-28", ""))).toEqual(["after", "end-late"]);
    expect(ids(filterJournalEntriesByDateRange(ENTRIES, "", "2026-10-01"))).toEqual(["before", "start"]);
  });

  it("rejects reversed or invalid ranges instead of guessing", () => {
    expect(validateJournalDateRange("2026-10-28", "2026-10-01")).toEqual({ ok: false, message: "The start date must be on or before the end date." });
    expect(validateJournalDateRange("2026-02-30", "")).toMatchObject({ ok: false });
    expect(validateJournalDateRange("28/10/2026", "")).toMatchObject({ ok: false });
    expect(validateJournalDateRange("2026-10-01", "2026-10-01")).toEqual({ ok: true });
    expect(filterJournalEntriesByDateRange(ENTRIES, "2026-10-28", "2026-10-01")).toEqual([]);
  });

  it("leaves entries with an unreadable date out of ranged exports only", () => {
    const bad = entry("bad", "not a date");
    expect(filterJournalEntriesByDateRange([bad], "", "")).toHaveLength(1);
    expect(filterJournalEntriesByDateRange([bad], "2026-10-01", "")).toHaveLength(0);
  });
});

describe("journal JSON export", () => {
  const html = '<h2>Tag &amp; title</h2><div>آج میں نے بہت سکون محسوس کیا۔ 😊</div><ul><li>One</li><li>Two</li></ul>';
  const parsed = () =>
    JSON.parse(
      buildJournalJsonExport(
        [
          entry("a", local(2026, 10, 2), { content: html, mood_tags: ["calm", "😊"], favorite: true, is_private: true, location: "Home" }),
          entry("b", local(2026, 10, 3), { title: null, content: null, is_private: null, mood_tags: [] }),
          entry("c", local(2026, 10, 1), { title: "", content: "", is_private: false, is_favorite: false }),
        ],
        new Date("2026-10-28T10:00:00.000Z"),
        { dateFrom: "2026-10-01", dateTo: "2026-10-28", timeZone: "Asia/Karachi" }
      )
    );

  it("keeps the original HTML and Unicode exactly, with a readable contentPlain", () => {
    const json = parsed();
    const a = json.entries.find((e: { id: string }) => e.id === "a");
    expect(a.contentHtml).toBe(html);
    expect(a.contentPlain).toBe("Tag & title\n\nآج میں نے بہت سکون محسوس کیا۔ 😊\n\n- One\n- Two");
    expect(a.moodTags).toEqual(["calm", "😊"]);
  });

  it("keeps the existing fields and their null / false / empty values", () => {
    const json = parsed();
    expect(Object.keys(json)).toEqual(["exportVersion", "app", "exportedAt", "dateRange", "entryCount", "entries"]);
    expect(json.dateRange).toEqual({ from: "2026-10-01", to: "2026-10-28", timeZone: "Asia/Karachi" });
    expect(json.entryCount).toBe(3);
    expect(json.entries.map((e: { id: string }) => e.id)).toEqual(["b", "a", "c"]); // newest first
    const [b, a, c] = json.entries;
    expect(Object.keys(a)).toEqual(["id", "title", "contentHtml", "contentPlain", "moodTags", "favorite", "isPrivate", "location", "createdAt", "updatedAt"]);
    expect(a).toMatchObject({ favorite: true, isPrivate: true, location: "Home" });
    expect(b).toMatchObject({ title: null, contentHtml: null, contentPlain: "", isPrivate: null, location: null, favorite: false });
    expect(c).toMatchObject({ title: "", contentHtml: "", contentPlain: "", isPrivate: false, favorite: false });
  });
});

describe("names and labels", () => {
  it("names the file after the selection, using local calendar days", () => {
    const now = new Date(2026, 9, 28, 23, 30);
    expect(journalExportFileName("pdf", "2026-10-01", "2026-10-28", now)).toBe("solace-journal-2026-10-01-to-2026-10-28.pdf");
    expect(journalExportFileName("json", "", "", now)).toBe("solace-journal-2026-10-28.json");
    expect(journalExportFileName("pdf", "2026-10-01", "", now)).toBe("solace-journal-2026-10-01-to-2026-10-28.pdf");
    expect(journalExportFileName("pdf", "", "2026-10-05", now)).toBe("solace-journal-through-2026-10-05.pdf");
  });

  it("shows the Journal page's mood labels, including legacy emoji tags", () => {
    expect(journalMoodLabel("calm")).toBe("Calm");
    expect(journalMoodLabel("😊")).toBe("Happy");
    expect(journalMoodLabel("Hopeful")).toBe("Hopeful");
    expect(journalMoodLabel("custom")).toBe("Custom");
  });
});
