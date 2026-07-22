/**
 * Frontend tracking-method definitions. These MIRROR the backend
 * (apps/api/src/modules/gamification) for labels, units, and input validation
 * ONLY. The official progress percentage is computed and owned by the backend —
 * the client never persists a computed percentage.
 */

export type TrackingMethod = "count" | "duration" | "amount" | "manual_milestone";

export const TRACKING_METHODS: readonly TrackingMethod[] = [
  "count",
  "duration",
  "amount",
  "manual_milestone",
] as const;

export const TRACKING_METHOD_LABELS: Record<TrackingMethod, string> = {
  count: "Count",
  duration: "Duration",
  amount: "Amount",
  manual_milestone: "Manual Milestones",
};

/** Label for the per-tracking-method check-in input field. */
export const CHECK_IN_FIELD_LABELS: Record<TrackingMethod, string> = {
  count: "Completed today",
  duration: "Time completed",
  amount: "Amount completed",
  manual_milestone: "Progress milestone",
};

/** Manual milestone stages in canonical order (label -> backend value). */
export const MILESTONE_STAGES = [
  { value: "not_started", label: "Not Started" },
  { value: "started", label: "Started" },
  { value: "making_progress", label: "Making Progress" },
  { value: "significant_progress", label: "Significant Progress" },
  { value: "completed", label: "Completed" },
] as const;

export type MilestoneStage = (typeof MILESTONE_STAGES)[number]["value"];

/** Canonical percentage for a milestone stage (display only; backend is source of truth). */
export const MILESTONE_PROGRESS: Record<MilestoneStage, number> = {
  not_started: 0,
  started: 25,
  making_progress: 50,
  significant_progress: 75,
  completed: 100,
};

/** Approved Duration units (canonical value -> label). */
export const DURATION_UNITS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
] as const;

/** Approved Amount units; "custom" reveals a free-text unit field. */
export const AMOUNT_UNITS = [
  { value: "currency", label: "Currency ($)" },
  { value: "kilometres", label: "Kilometres" },
  { value: "litres", label: "Litres" },
  { value: "kilograms", label: "Kilograms" },
  { value: "custom", label: "Custom" },
] as const;

const AMOUNT_PRESET_VALUES = new Set(
  AMOUNT_UNITS.filter((u) => u.value !== "custom").map((u) => u.value as string)
);

/** True when an Amount unit string is one of the fixed presets (not a custom unit). */
export function isAmountPresetUnit(unit: string): boolean {
  return AMOUNT_PRESET_VALUES.has(unit);
}

export function isNumericTracking(method: TrackingMethod): boolean {
  return method === "count" || method === "duration" || method === "amount";
}

/**
 * Whether editing must ask for confirmation before changing the tracking method:
 * only when the method actually changes AND the item already has check-ins
 * (changing it may reinterpret historical progress).
 */
export function requiresTrackingChangeConfirmation(
  originalMethod: TrackingMethod | undefined,
  nextMethod: TrackingMethod,
  hasCheckIns: boolean
): boolean {
  return hasCheckIns && !!originalMethod && originalMethod !== nextMethod;
}

export function isMilestoneStage(value: unknown): value is MilestoneStage {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MILESTONE_PROGRESS, value);
}

/** Client-side pre-validation only (backend re-validates authoritatively). */
export function isValidTargetValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isValidCheckInValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Display-only progress estimate for optimistic UI. NEVER send this to the API
 * as the official percentage — the backend recomputes and persists progress.
 */
export function displayProgressEstimate(
  method: TrackingMethod,
  opts: { currentValue?: number; targetValue?: number; milestone?: MilestoneStage }
): number {
  if (method === "manual_milestone") {
    return opts.milestone ? MILESTONE_PROGRESS[opts.milestone] : 0;
  }
  const target = opts.targetValue ?? 0;
  if (!(target > 0)) return 0;
  const current = Math.max(0, opts.currentValue ?? 0);
  return Math.min(Math.round((current / target) * 100), 100);
}
