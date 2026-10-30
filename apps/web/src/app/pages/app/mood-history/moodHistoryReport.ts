/**
 * Mood History report model: the entries and facts both exports (CSV and PDF) are written from.
 *
 * Rules (unchanged from the CSV export):
 * - The period is the page's selected week (Mon–Sun), month or year in local time; entries in it
 *   are listed oldest first (ties: source, then id).
 * - Mood check-ins are the primary source: if they failed to load there is no report. If journal
 *   entries failed, the report is partial (check-ins only) and says so.
 * - Check-ins keep their recorded intensity (including 0); journal-derived rows have none — the
 *   on-screen value for them is inferred from the mood label, so it is not reported as data.
 * - Check-in notes are kept as written; journal notes are converted from rich text to readable text.
 */
import { format } from 'date-fns';
import { htmlToReadableText } from '@/lib/htmlToReadableText';

export type SourceStatus = 'ok' | 'failed';

export interface MoodHistoryExportEntry {
  id: string;
  created_at: string;
  mood: string;
  /** Recorded intensity for check-ins; ignored for journal rows. */
  intensity: number;
  activities?: string[];
  /** Plain text for check-ins, rich-text HTML for journal entries. */
  notes?: string | null;
  source: 'journal' | 'check-in';
}

export interface MoodHistoryExportInput {
  entries: MoodHistoryExportEntry[];
  period: { label: string; start: Date; end: Date };
  sources: { checkIns: SourceStatus; journals: SourceStatus };
  moodLabel: (mood: string) => string | null | undefined;
  timeZone: string;
  generatedAt: Date;
}

export const MOOD_SOURCE_LABEL = { 'check-in': 'Mood check-in', journal: 'Journal entry' } as const;

export const MOOD_REPORT_INCLUDES = 'Mood check-ins and journal entries that have a mood tag';
export const MOOD_REPORT_PARTIAL =
  'Partial: journal entries could not be loaded, so only mood check-ins are included';

export interface MoodHistoryReportRow {
  id: string;
  /** When the entry was recorded (local time is used for date and time). */
  at: Date;
  source: MoodHistoryExportEntry['source'];
  sourceLabel: string;
  /** The stored mood value. */
  mood: string;
  /** The app's label for it, or '' when it has none. */
  moodLabel: string;
  /** Recorded intensity (check-ins only); null when there is none. */
  intensity: number | null;
  activities: string[];
  /** Readable text ('' when there are no notes). */
  notes: string;
}

export interface MoodHistoryReport {
  generatedAt: Date;
  period: { label: string; start: Date; end: Date };
  timeZone: string;
  includes: string;
  /** True when journal entries failed to load (only check-ins are included). */
  partial: boolean;
  rows: MoodHistoryReportRow[];
}

export type MoodHistoryReportResult =
  | { kind: 'ok'; report: MoodHistoryReport }
  | { kind: 'source-unavailable' }
  | { kind: 'empty' };

export function buildMoodHistoryReport(input: MoodHistoryExportInput): MoodHistoryReportResult {
  const { entries, period, sources, moodLabel, timeZone, generatedAt } = input;

  // Check-ins are the primary source: without them an export would look empty or journal-only.
  if (sources.checkIns === 'failed') return { kind: 'source-unavailable' };

  const inPeriod = entries
    .filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= period.start.getTime() && t <= period.end.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
        a.source.localeCompare(b.source) ||
        a.id.localeCompare(b.id)
    );

  const partial = sources.journals === 'failed';
  if (inPeriod.length === 0 && !partial) return { kind: 'empty' };

  const rows = inPeriod.map((entry): MoodHistoryReportRow => {
    const isCheckIn = entry.source === 'check-in';
    return {
      id: entry.id,
      at: new Date(entry.created_at),
      source: entry.source,
      sourceLabel: MOOD_SOURCE_LABEL[entry.source],
      mood: entry.mood,
      moodLabel: moodLabel(entry.mood) ?? '',
      intensity: isCheckIn && typeof entry.intensity === 'number' ? entry.intensity : null,
      activities: entry.activities ?? [],
      notes: isCheckIn ? entry.notes ?? '' : htmlToReadableText(entry.notes),
    };
  });

  return { kind: 'ok', report: { generatedAt, period, timeZone, includes: MOOD_REPORT_INCLUDES, partial, rows } };
}

/** File name stem shared by both formats, e.g. `solace-mood-history-2026-10-26-to-2026-11-01`. */
export function moodHistoryFileStem(period: { start: Date; end: Date }): string {
  return `solace-mood-history-${format(period.start, 'yyyy-MM-dd')}-to-${format(period.end, 'yyyy-MM-dd')}`;
}
