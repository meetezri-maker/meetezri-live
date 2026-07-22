/**
 * Normalizes raw check-in rows from the backend (goal_check_ins /
 * achievement_check_ins) into a single display shape for the detail modal.
 * Backend remains the source of truth; this only maps fields for rendering.
 */
import { MILESTONE_STAGES } from './tracking';

export type CheckInItemType = 'goal' | 'achievement';

export interface NormalizedCheckIn {
  id: string;
  /** ISO timestamp used for ordering + display. */
  createdAt: string;
  /** Calendar date of the check-in (YYYY-MM-DD) when available. */
  checkInDate: string | null;
  valueAdded: number | null;
  /** Humanized milestone label (e.g. "Making Progress"), or null. */
  milestone: string | null;
  progressBefore: number | null;
  progressAfter: number | null;
  note: string | null;
}

const MILESTONE_LABELS: Record<string, string> = Object.fromEntries(
  MILESTONE_STAGES.map((s) => [s.value, s.label])
);

export function milestoneLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  return MILESTONE_LABELS[value] ?? value;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/** Map one raw check-in row to the normalized display shape. */
export function normalizeCheckIn(
  row: Record<string, unknown>,
  itemType: CheckInItemType
): NormalizedCheckIn {
  // Goal check-ins store the note in `notes`/`reflection`; achievement in `note`.
  const note =
    itemType === 'goal'
      ? str(row.notes) ?? str(row.reflection) ?? str(row.wins) ?? str(row.challenges_faced)
      : str(row.note);
  return {
    id: String(row.id ?? row.created_at ?? Math.random()),
    createdAt: String(row.created_at ?? ''),
    checkInDate: str(row.check_in_date),
    valueAdded: num(row.value_added),
    milestone: milestoneLabel(row.milestone),
    progressBefore: num(row.progress_before),
    progressAfter: num(row.progress_after),
    note,
  };
}

/**
 * Normalize + sort a list of raw rows chronologically (oldest first). The API
 * returns newest-first; the detail modal shows chronological order.
 */
export function normalizeHistory(
  rows: unknown,
  itemType: CheckInItemType
): NormalizedCheckIn[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => normalizeCheckIn(r as Record<string, unknown>, itemType))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}
