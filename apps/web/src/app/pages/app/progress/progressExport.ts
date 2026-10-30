/**
 * Progress CSV export (the "Export Report" menu on /app/progress → Download CSV).
 *
 * One table — Section, Metric, Value, Unit, Scope, Status — after a short report header.
 * The rows, scopes and statuses come from the shared report model (progressReportModel.ts),
 * which the PDF also uses; see it for how each value's period is determined.
 */
import { format } from 'date-fns';
import { buildCsv, type CsvValue } from '@/lib/csv';
import type { ProgressTimeRange } from './progressInsights';
import { buildProgressReport, progressFileStem, type ProgressExportInput } from './progressReportModel';

export {
  SESSION_LIST_LIMIT_CAP,
  progressRangeLabel,
  type LoadState,
  type ProgressExportInput,
} from './progressReportModel';

export function buildProgressExportCsv(input: ProgressExportInput): string {
  const report = buildProgressReport(input);
  const header: CsvValue[][] = [
    ['Solace Progress Report'],
    ['Generated', format(report.now, 'yyyy-MM-dd HH:mm xxx')],
    ['Selected period', report.selected],
    ['Time zone', `${report.timeZone} (selected-period counts use this time zone)`],
    ['Completeness', report.completeness],
    [],
    ['Section', 'Metric', 'Value', 'Unit', 'Scope', 'Status'],
  ];
  const rows: CsvValue[][] = report.rows.map((r) => [r.section, r.metric, r.value, r.unit, r.scope, r.status]);
  return buildCsv([...header, ...rows]);
}

/** e.g. `solace-progress-this-month-2026-10-28.csv` */
export function progressExportFileName(range: ProgressTimeRange, now: Date): string {
  return `${progressFileStem(range, now)}.csv`;
}
