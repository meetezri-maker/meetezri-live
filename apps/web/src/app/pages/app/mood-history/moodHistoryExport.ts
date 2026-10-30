/**
 * Mood History CSV export (the "Export" menu on /app/mood-history → Download CSV).
 *
 * File layout: a short header describing the report (generated time, period, time zone,
 * completeness), a blank row, then one row per entry in the period, oldest first.
 * Journal-derived rows have no intensity: journals do not record one, and the on-screen value
 * for them is inferred from the mood label, so it is not exported as data.
 * The rows come from the shared report model (moodHistoryReport.ts), also used by the PDF.
 */
import { format } from 'date-fns';
import { buildCsv, type CsvValue } from '@/lib/csv';
import {
  MOOD_REPORT_PARTIAL,
  buildMoodHistoryReport,
  moodHistoryFileStem,
  type MoodHistoryExportInput,
} from './moodHistoryReport';

export type { MoodHistoryExportEntry, MoodHistoryExportInput, SourceStatus } from './moodHistoryReport';

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

export function buildMoodHistoryExport(input: MoodHistoryExportInput): MoodHistoryExportResult {
  const result = buildMoodHistoryReport(input);
  if (result.kind !== 'ok') return result;
  const { report } = result;
  const { period, generatedAt } = report;

  const rows: CsvValue[][] = [
    ['Solace Mood History'],
    ['Generated', format(generatedAt, 'yyyy-MM-dd HH:mm xxx')],
    ['Period', `${period.label}: ${format(period.start, 'yyyy-MM-dd')} to ${format(period.end, 'yyyy-MM-dd')}`],
    ['Time zone', report.timeZone],
    ['Includes', report.includes],
    ['Completeness', report.partial ? MOOD_REPORT_PARTIAL : 'Complete'],
    ['Entries', report.rows.length],
    [],
    [...MOOD_EXPORT_COLUMNS],
  ];

  for (const row of report.rows) {
    rows.push([
      format(row.at, 'yyyy-MM-dd'),
      format(row.at, 'HH:mm'),
      row.sourceLabel,
      row.mood,
      row.moodLabel,
      row.intensity,
      row.activities.join('; '),
      row.notes,
    ]);
  }

  return { kind: 'ok', csv: buildCsv(rows), partial: report.partial, rowCount: report.rows.length };
}

/** e.g. `solace-mood-history-2026-10-26-to-2026-11-01.csv` */
export function moodHistoryExportFileName(period: { start: Date; end: Date }): string {
  return `${moodHistoryFileStem(period)}.csv`;
}
