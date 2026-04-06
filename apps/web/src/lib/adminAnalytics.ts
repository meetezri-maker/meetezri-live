export type DashboardTimePreset = '7d' | '30d' | '90d' | '1y';

export function presetToRangeDays(p: DashboardTimePreset): number {
  switch (p) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
    default:
      return 30;
  }
}

/** UTC calendar dates for a rolling preset ending today. */
export function datesForPreset(preset: DashboardTimePreset, now = new Date()): { dateFrom: string; dateTo: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (presetToRangeDays(preset) - 1));
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    const blob = new Blob([''], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, filename);
    return;
  }
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename);
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  triggerDownload(blob, filename);
}

export function buildStatsQuery(opts: {
  chartPeriod: 'week' | 'month' | 'year';
  rangePreset: DashboardTimePreset;
  useCustomRange: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  const { chartPeriod, rangePreset, useCustomRange, dateFrom, dateTo } = opts;
  if (useCustomRange && dateFrom && dateTo) {
    return {
      chartPeriod,
      dateFrom,
      dateTo,
    };
  }
  const d = datesForPreset(rangePreset);
  return {
    chartPeriod,
    dateFrom: d.dateFrom,
    dateTo: d.dateTo,
  };
}
