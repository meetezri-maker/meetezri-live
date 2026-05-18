import type { WellnessToolCategory } from "./wellnessToolCategories";

/**
 * Target session length per category (matches audio track lengths you provided).
 * Format MM:SS — used for built-in tools and CMS defaults.
 */
export const WELLNESS_CATEGORY_DURATION_MMSS: Record<WellnessToolCategory, string> = {
  Mindfulness: "15:29",
  "Sleep Health": "20:03",
  Meditation: "14:32",
  "Self-Care": "12:32",
  Relaxation: "11:07",
  "Stress Management": "5:12",
  Anxiousness: "2:00",
  "Low morale support": "5:05",
  /** No dedicated track listed — reasonable default */
  Exercise: "10:00",
};

export function mmssToSeconds(mmss: string): number {
  const parts = mmss.trim().split(":");
  if (parts.length !== 2) return 0;
  const mm = Number(parts[0]);
  const ss = Number(parts[1]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss >= 60) return 0;
  return mm * 60 + ss;
}

/** Rounded whole minutes for API `duration_minutes` (Int). */
export function mmssToRoundedMinutes(mmss: string): number {
  return Math.max(1, Math.round(mmssToSeconds(mmss) / 60));
}

/**
 * Parses built-in / UI duration labels: ∞, "12 min", or "15:29".
 */
export function parseWellnessDurationLabelToSeconds(durationLabel: string): number {
  const d = durationLabel.trim();
  if (d === "∞" || d.toLowerCase() === "infinity") return Number.POSITIVE_INFINITY;
  if (/^\d{1,3}:\d{2}$/.test(d)) {
    const sec = mmssToSeconds(d);
    return sec > 0 ? sec : Number.POSITIVE_INFINITY;
  }
  const n = parseInt(d.replace(/\s*min\s*/i, "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
  return n * 60;
}

export function formatSecondsAsMmSs(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Admin / forms: "15:29", "5 min", or plain number = whole minutes. */
export function parseFlexibleDurationInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{1,3}:\d{2}$/.test(t)) {
    const sec = mmssToSeconds(t);
    return sec > 0 ? sec : null;
  }
  if (/min/i.test(t)) {
    const n = parseInt(t.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n * 60 : null;
  }
  const digits = parseInt(t, 10);
  if (!Number.isFinite(digits) || digits <= 0) return null;
  return digits * 60;
}
