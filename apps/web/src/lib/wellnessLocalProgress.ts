/** Client-only aggregates for built-in wellness tools (string ids, no API tool row). */

export type WellnessProgressRow = {
  toolId: string;
  toolTitle: string;
  sessionsCompleted: number;
  /** Total duration across completed sessions (source of truth for display). */
  totalSeconds: number;
  /** Rounded whole minutes; prefer totalSeconds for precise UI. */
  totalMinutes: number;
};

/** Normalize API or merged rows that may predate `totalSeconds`. */
export function wellnessProgressTotalSeconds(p: {
  totalSeconds?: number;
  totalMinutes?: number;
}): number {
  if (typeof p.totalSeconds === "number" && !Number.isNaN(p.totalSeconds)) {
    return Math.max(0, Math.floor(p.totalSeconds));
  }
  return Math.max(0, Math.round((p.totalMinutes ?? 0) * 60));
}

/** e.g. "2 sec", "1 min 5 sec", "12 min" */
export function formatWellnessDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (rem === 0) return `${m} min`;
  return `${m} min ${rem} sec`;
}

type LocalAgg = {
  toolId: string;
  toolTitle: string;
  sessionsCompleted: number;
  totalSeconds: number;
};

const STORAGE_PREFIX = "wellness-builtin-progress:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadLocalProgress(userId: string): LocalAgg[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is LocalAgg =>
        Boolean(x) &&
        typeof x === "object" &&
        typeof (x as LocalAgg).toolId === "string" &&
        typeof (x as LocalAgg).toolTitle === "string" &&
        typeof (x as LocalAgg).sessionsCompleted === "number" &&
        typeof (x as LocalAgg).totalSeconds === "number"
    );
  } catch {
    return [];
  }
}

function saveLocalProgress(userId: string, rows: LocalAgg[]) {
  if (!userId || typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(rows));
}

/** Minimum seconds before a manual close counts as a session (avoids accidental taps). */
export const BUILTIN_MIN_SECONDS = 2;

export function recordBuiltinSession(
  userId: string,
  toolId: string,
  toolTitle: string,
  durationSeconds: number
) {
  if (!userId || durationSeconds < BUILTIN_MIN_SECONDS) return;
  const sec = Math.floor(durationSeconds);
  const rows = loadLocalProgress(userId);
  const idx = rows.findIndex((r) => r.toolId === toolId);
  if (idx >= 0) {
    rows[idx] = {
      ...rows[idx],
      toolTitle: toolTitle || rows[idx].toolTitle,
      sessionsCompleted: rows[idx].sessionsCompleted + 1,
      totalSeconds: rows[idx].totalSeconds + sec,
    };
  } else {
    rows.push({
      toolId,
      toolTitle,
      sessionsCompleted: 1,
      totalSeconds: sec,
    });
  }
  saveLocalProgress(userId, rows);
}

export function mergeWellnessProgressWithLocal(
  apiProgress: WellnessProgressRow[],
  localRows: LocalAgg[]
): WellnessProgressRow[] {
  const map = new Map<string, WellnessProgressRow>();

  for (const p of apiProgress) {
    const ts = wellnessProgressTotalSeconds(p);
    map.set(p.toolId, {
      ...p,
      totalSeconds: ts,
      totalMinutes: Math.round(ts / 60),
    });
  }

  for (const L of localRows) {
    const addSec = Math.max(0, Math.floor(L.totalSeconds));
    const existing = map.get(L.toolId);
    if (existing) {
      const newSec = wellnessProgressTotalSeconds(existing) + addSec;
      map.set(L.toolId, {
        toolId: L.toolId,
        toolTitle: existing.toolTitle || L.toolTitle,
        sessionsCompleted: existing.sessionsCompleted + L.sessionsCompleted,
        totalSeconds: newSec,
        totalMinutes: Math.round(newSec / 60),
      });
    } else {
      map.set(L.toolId, {
        toolId: L.toolId,
        toolTitle: L.toolTitle,
        sessionsCompleted: L.sessionsCompleted,
        totalSeconds: addSec,
        totalMinutes: Math.round(addSec / 60),
      });
    }
  }

  return Array.from(map.values());
}
