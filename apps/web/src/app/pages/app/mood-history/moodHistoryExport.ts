/**
 * Mood History CSV export (the "Export" button on /app/mood-history).
 *
 * File layout: a short header describing the report (generated time, period, time zone,
 * completeness), a blank row, then one row per entry in the period, oldest first.
 * Journal-derived rows have no intensity: journals do not record one, and the on-screen value
 * for them is inferred from the mood label, so it is not exported as data.
 */
import { format } from 'date-fns';
import { buildCsv, type CsvValue } from '@/lib/csv';
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

export type MoodHistoryExportResult =
  | { kind: 'ok'; csv: string; partial: boolean; rowCount: number }
  | { kind: 'source-unavailable' }
  | { kind: 'empty' };

export const MOOD_EXPORT_COLUMNS = [
  'Date',
  'Time',
  'Source',
  'Mood',
  'Mood label',
  'Intensity (1–10)',
  'Activities',
  'Notes',
] as const;

const SOURCE_LABEL = { 'check-in': 'Mood check-in', journal: 'Journal entry' } as const;

export function buildMoodHistoryExport(input: MoodHistoryExportInput): MoodHistoryExportResult {
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

  const rows: CsvValue[][] = [
    ['Solace Mood History'],
    ['Generated', format(generatedAt, 'yyyy-MM-dd HH:mm xxx')],
    ['Period', `${period.label}: ${format(period.start, 'yyyy-MM-dd')} to ${format(period.end, 'yyyy-MM-dd')}`],
    ['Time zone', timeZone],
    ['Includes', 'Mood check-ins and journal entries that have a mood tag'],
    [
      'Completeness',
      partial
        ? 'Partial: journal entries could not be loaded, so only mood check-ins are included'
        : 'Complete',
    ],
    ['Entries', inPeriod.length],
    [],
    [...MOOD_EXPORT_COLUMNS],
  ];

  for (const entry of inPeriod) {
    const when = new Date(entry.created_at);
    const isCheckIn = entry.source === 'check-in';
    rows.push([
      format(when, 'yyyy-MM-dd'),
      format(when, 'HH:mm'),
      SOURCE_LABEL[entry.source],
      entry.mood,
      moodLabel(entry.mood) ?? '',
      isCheckIn && typeof entry.intensity === 'number' ? entry.intensity : null,
      (entry.activities ?? []).join('; '),
      isCheckIn ? entry.notes ?? '' : htmlToReadableText(entry.notes),
    ]);
  }

  return { kind: 'ok', csv: buildCsv(rows), partial, rowCount: inPeriod.length };
}

/** e.g. `solace-mood-history-2026-10-26-to-2026-11-01.csv` */
export function moodHistoryExportFileName(period: { start: Date; end: Date }): string {
  return `solace-mood-history-${format(period.start, 'yyyy-MM-dd')}-to-${format(period.end, 'yyyy-MM-dd')}.csv`;
}
