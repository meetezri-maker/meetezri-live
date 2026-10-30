/**
 * Progress report model: the rows both exports (CSV and PDF) are written from.
 *
 * Every row states the period its value actually covers:
 * - Selected-period rows are counted here from timestamped records, with the page's own range
 *   rules (`filterByProgressRange`, local time).
 * - The current streak is a snapshot as of the export, not a value at the end of the period.
 * - Weekly activity, wellness scores and monthly activity come pre-aggregated from the server
 *   (GET /wellness/stats) over fixed windows; they are reported as-is with those windows.
 * - Wellness tool totals (GET /wellness/progress) have no timestamps, so they are all-time.
 * A source that failed to load is reported as Unavailable with no value, never as 0; a talk count
 * from the capped list is a lower bound.
 */
import { format } from 'date-fns';
import {
  PROGRESS_TIME_RANGE_OPTIONS,
  filterByProgressRange,
  progressRangeBounds,
  type ProgressTimeRange,
} from './progressInsights';

/** `GET /sessions?limit=` is clamped to this many rows by the API. */
export const SESSION_LIST_LIMIT_CAP = 200;

export type LoadState<T> = { ok: true; data: T } | { ok: false };

export interface ProgressExportInput {
  range: ProgressTimeRange;
  now: Date;
  timeZone: string;
  sessions: LoadState<Array<{ started_at?: string; ended_at?: string | null }>> & {
    /** True when the list may be missing older talks (it hit the API cap). */
    limited?: boolean;
  };
  moods: LoadState<Array<{ created_at: string }>>;
  journals: LoadState<Array<{ created_at: string }>>;
  currentStreakDays: number | null;
  stats: LoadState<{
    weeklyProgress?: Array<{ name: string; sessions: number; mood: number; wellness: number }>;
    wellnessScore?: Array<{ subject: string; A: number; fullMark: number }>;
    monthlyActivity?: Array<{ month: string; value: number }>;
  }>;
  tools: LoadState<
    Array<{ toolId: string; toolTitle: string; sessionsCompleted: number; totalSeconds: number }>
  >;
}

export const PROGRESS_UNAVAILABLE = 'Unavailable: could not be loaded';

/** Server-side windows for each wellness score (see wellness.service getStats). */
const SCORE_SCOPE: Record<string, string> = {
  Emotional: 'Last 28 days (server time)',
  Mental: 'Last 28 days (server time)',
  Physical: 'Last 28 days (server time)',
  Social: 'All time',
  Sleep: 'Most recent 10 sleep entries',
};

export type ProgressSection = 'Summary' | 'Weekly activity' | 'Wellness scores' | 'Monthly activity' | 'Wellness tools';

/** How a row's value relates to time, for grouping in the PDF. */
export type ProgressRowKind = 'selected-period' | 'snapshot' | 'fixed-window';

export interface ProgressReportRow {
  section: ProgressSection;
  kind: ProgressRowKind;
  metric: string;
  /** null when unavailable (never shown as 0). */
  value: number | null;
  unit: string;
  scope: string;
  status: string;
}

export interface ProgressExportReport {
  range: ProgressTimeRange;
  rangeLabel: string;
  now: Date;
  timeZone: string;
  bounds: { start: Date; end: Date };
  /** e.g. "This Month (2026-10-01 to 2026-10-28)" or "All Time (up to 2026-10-28)". */
  selected: string;
  /** What could not be loaded or is only partly counted (empty when complete). */
  issues: string[];
  /** "Complete" or "Partial: …" (as written in the CSV header). */
  completeness: string;
  rows: ProgressReportRow[];
}

export function progressRangeLabel(range: ProgressTimeRange): string {
  return PROGRESS_TIME_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range;
}

export function buildProgressReport(input: ProgressExportInput): ProgressExportReport {
  const { range, now, timeZone, sessions, moods, journals, stats, tools } = input;
  const bounds = progressRangeBounds(range, now);
  const label = progressRangeLabel(range);
  const selected =
    range === 'all'
      ? `${label} (up to ${format(bounds.end, 'yyyy-MM-dd')})`
      : `${label} (${format(bounds.start, 'yyyy-MM-dd')} to ${format(bounds.end, 'yyyy-MM-dd')})`;
  const periodScope = `Selected period: ${selected}`;

  const issues: string[] = [];
  const rows: ProgressReportRow[] = [];
  const row = (section: ProgressSection, kind: ProgressRowKind, metric: string, value: number | null, unit: string, scope: string, status: string) =>
    rows.push({ section, kind, metric, value, unit, scope, status });

  // --- Summary (selected period, from timestamped records) ---------------------------------
  if (sessions.ok) {
    const talks = filterByProgressRange(sessions.data.filter((s) => s.ended_at), range, now).length;
    if (sessions.limited) {
      issues.push(`talks counted from the most recent ${SESSION_LIST_LIMIT_CAP} only`);
      row('Summary', 'selected-period', 'Talks completed', talks, 'talks', periodScope,
        `Lower bound: only the most recent ${SESSION_LIST_LIMIT_CAP} talks could be loaded`);
    } else {
      row('Summary', 'selected-period', 'Talks completed', talks, 'talks', periodScope, 'Complete');
    }
  } else {
    issues.push('talks');
    row('Summary', 'selected-period', 'Talks completed', null, 'talks', periodScope, PROGRESS_UNAVAILABLE);
  }

  if (moods.ok) {
    row('Summary', 'selected-period', 'Mood check-ins', filterByProgressRange(moods.data, range, now).length, 'check-ins', periodScope, 'Complete');
  } else {
    issues.push('mood check-ins');
    row('Summary', 'selected-period', 'Mood check-ins', null, 'check-ins', periodScope, PROGRESS_UNAVAILABLE);
  }

  if (journals.ok) {
    row('Summary', 'selected-period', 'Journal entries', filterByProgressRange(journals.data, range, now).length, 'entries', periodScope, 'Complete');
  } else {
    issues.push('journal entries');
    row('Summary', 'selected-period', 'Journal entries', null, 'entries', periodScope, PROGRESS_UNAVAILABLE);
  }

  row(
    'Summary',
    'snapshot',
    'Current streak',
    input.currentStreakDays,
    'days',
    `As of ${format(now, 'yyyy-MM-dd')}`,
    input.currentStreakDays === null ? 'Unavailable' : 'Complete'
  );

  // --- Server aggregates over fixed windows --------------------------------------------------
  if (stats.ok) {
    const weeks = stats.data.weeklyProgress ?? [];
    const weeklyScope = 'Last 28 days in 7-day blocks, Week 1 oldest (server time); not the selected period';
    weeks.forEach((w, i) => {
      const name = `${w.name}${i === 0 ? ' (oldest)' : i === weeks.length - 1 ? ' (most recent)' : ''}`;
      row('Weekly activity', 'fixed-window', `${name}: talks started`, w.sessions, 'talks', weeklyScope, 'Complete');
      row('Weekly activity', 'fixed-window', `${name}: mood check-ins`, w.mood, 'check-ins', weeklyScope, 'Complete');
      row('Weekly activity', 'fixed-window', `${name}: wellness tool sessions completed`, w.wellness, 'sessions', weeklyScope, 'Complete');
    });

    for (const s of stats.data.wellnessScore ?? []) {
      const scope = SCORE_SCOPE[s.subject];
      row('Wellness scores', 'fixed-window', `${s.subject} score`, s.A, `score (0–${s.fullMark})`, scope ?? 'Scope unknown',
        scope ? 'Complete' : 'Scope unknown');
    }

    const months = stats.data.monthlyActivity ?? [];
    for (const m of months) {
      row('Monthly activity', 'fixed-window', `${m.month}: activities logged`, m.value,
        'talks + mood check-ins + wellness tool sessions + journal entries',
        'Last 6 calendar months, current month last (server time); not the selected period', 'Complete');
    }
  } else {
    issues.push('weekly activity, wellness scores and monthly activity');
    for (const section of ['Weekly activity', 'Wellness scores', 'Monthly activity'] as const) {
      row(section, 'fixed-window', 'All metrics', null, '', 'Fixed server window', PROGRESS_UNAVAILABLE);
    }
  }

  if (tools.ok) {
    if (tools.data.length === 0) {
      row('Wellness tools', 'fixed-window', 'Wellness tool sessions completed', 0, 'sessions', 'All time', 'Complete');
    }
    for (const t of tools.data) {
      const title = t.toolTitle || t.toolId;
      row('Wellness tools', 'fixed-window', `${title}: wellness tool sessions completed`, t.sessionsCompleted, 'sessions', 'All time', 'Complete');
      row('Wellness tools', 'fixed-window', `${title}: total time`, t.totalSeconds, 'seconds', 'All time', 'Complete');
    }
  } else {
    issues.push('wellness tools');
    row('Wellness tools', 'fixed-window', 'All metrics', null, '', 'All time', PROGRESS_UNAVAILABLE);
  }

  return {
    range,
    rangeLabel: label,
    now,
    timeZone,
    bounds,
    selected,
    issues,
    completeness: issues.length ? `Partial: ${issues.join('; ')}` : 'Complete',
    rows,
  };
}

/** File name stem shared by both formats, e.g. `solace-progress-this-month-2026-10-28`. */
export function progressFileStem(range: ProgressTimeRange, now: Date): string {
  return `solace-progress-${range.replace(/_/g, '-')}-${format(now, 'yyyy-MM-dd')}`;
}
