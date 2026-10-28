/**
 * Journal exports (PDF and JSON): entry shape, date-range selection, JSON payload, file names.
 *
 * Dates follow the Journal page: each entry belongs to the calendar day of its `created_at` in
 * this device's time zone, and a range includes both of its (whole) end days.
 * The PDF layout lives in `journalExportPdf.ts`; rich text is read by `journalRichText.ts`.
 */
import { journalHtmlToPlainText } from "./journalRichText";
import { MOOD_CHECKIN_CARDS, insightLabelForMoodKey } from "@/app/pages/app/mood-check-in/moodCheckInData";

/** Minimal shape for journal export (matches Journal page entry fields). */
export interface JournalExportEntry {
  id: string;
  title: string | null;
  content: string | null;
  mood_tags: string[];
  is_private: boolean | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  favorite?: boolean;
  /** Present on API payloads; UI also sets `favorite`. */
  is_favorite?: boolean | null;
  /** Present on API payloads: the account the entry belongs to. */
  user_id?: string;
}

/** YYYY-MM-DD in the user's local calendar — matches `<input type="date">` semantics. */
export function localDateKey(isoOrDate: string | Date): string {
  const d =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The device time zone used for entry days and times (IANA name when available). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "device time";
  } catch {
    return "device time";
  }
}

export function getEntryContent(e: JournalExportEntry): string {
  const c = e.content;
  return typeof c === "string" ? c : "";
}

export function getEntryFavorite(e: JournalExportEntry): boolean {
  return Boolean(e.favorite ?? e.is_favorite);
}

/** Legacy journal entries may store emoji strings in mood_tags (same mapping as the Journal page). */
const LEGACY_EMOJI_TO_MOOD_VALUE: Record<string, string> = {
  "😊": "happy",
  "😌": "calm",
  "😰": "anxious",
  "😢": "sad",
  "🤩": "excited",
  "😡": "angry",
  "🥰": "grateful",
};

/** The label the Journal page shows for a stored mood tag. */
export function journalMoodLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const card = MOOD_CHECKIN_CARDS.find((c) => c.value === lower || c.label.toLowerCase() === lower);
  const key = card ? card.value : LEGACY_EMOJI_TO_MOOD_VALUE[trimmed] ?? lower;
  return insightLabelForMoodKey(key);
}

// --- Date range ---------------------------------------------------------------------------------

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in YYYY-MM-DD form. */
export function isDateKey(value: string): boolean {
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export type JournalDateRangeCheck = { ok: true } | { ok: false; message: string };

/** Empty bounds mean "no limit"; a set bound must be a real date, and start ≤ end. */
export function validateJournalDateRange(dateFrom: string, dateTo: string): JournalDateRangeCheck {
  if ((dateFrom && !isDateKey(dateFrom)) || (dateTo && !isDateKey(dateTo))) {
    return { ok: false, message: "Please choose valid dates for the export range." };
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { ok: false, message: "The start date must be on or before the end date." };
  }
  return { ok: true };
}

/**
 * Entries whose local calendar day falls within [dateFrom, dateTo], both inclusive; either bound
 * may be empty. An invalid range matches nothing (the export reports why). Entries with an
 * unreadable `created_at` are only included when no range is set.
 */
export function filterJournalEntriesByDateRange(
  entries: JournalExportEntry[],
  dateFrom: string,
  dateTo: string
): JournalExportEntry[] {
  if (!dateFrom && !dateTo) return [...entries];
  if (!validateJournalDateRange(dateFrom, dateTo).ok) return [];

  return entries.filter((e) => {
    if (Number.isNaN(new Date(e.created_at).getTime())) return false;
    const key = localDateKey(e.created_at);
    if (dateFrom && key < dateFrom) return false;
    if (dateTo && key > dateTo) return false;
    return true;
  });
}

/** Newest first, as on the Journal page. */
export function sortJournalEntries(entries: JournalExportEntry[]): JournalExportEntry[] {
  const time = (e: JournalExportEntry) => {
    const t = new Date(e.created_at).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  return entries.slice().sort((a, b) => time(b) - time(a));
}

// --- JSON ---------------------------------------------------------------------------------------

export interface JournalJsonOptions {
  dateFrom?: string;
  dateTo?: string;
  timeZone?: string;
}

/**
 * The JSON export. `contentHtml` is the stored rich text exactly as saved (null stays null);
 * `contentPlain` is a readable copy keeping paragraphs, line breaks, headings and lists.
 */
export function buildJournalJsonExport(
  entries: JournalExportEntry[],
  exportedAt: Date,
  options: JournalJsonOptions = {}
): string {
  const payload = {
    exportVersion: 1,
    app: "Solace Journal",
    exportedAt: exportedAt.toISOString(),
    dateRange: {
      from: options.dateFrom || null,
      to: options.dateTo || null,
      timeZone: options.timeZone ?? deviceTimeZone(),
    },
    entryCount: entries.length,
    entries: sortJournalEntries(entries).map((e) => ({
      id: e.id,
      title: e.title,
      contentHtml: typeof e.content === "string" ? e.content : null,
      contentPlain: journalHtmlToPlainText(getEntryContent(e)),
      moodTags: Array.isArray(e.mood_tags) ? e.mood_tags : [],
      favorite: getEntryFavorite(e),
      isPrivate: e.is_private,
      location: e.location,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/** e.g. `solace-journal-2026-10-01-to-2026-10-28.pdf`; without a range, the export day. */
export function journalExportFileName(format: "pdf" | "json", dateFrom: string, dateTo: string, now: Date): string {
  const today = localDateKey(now);
  if (dateFrom && dateTo) return `solace-journal-${dateFrom}-to-${dateTo}.${format}`;
  if (dateFrom) return `solace-journal-${dateFrom}-to-${today}.${format}`;
  if (dateTo) return `solace-journal-through-${dateTo}.${format}`;
  return `solace-journal-${today}.${format}`;
}
