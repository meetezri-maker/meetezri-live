/**
 * Progress tracking model — the single source of truth for how an item's
 * official progress percentage is computed and validated.
 *
 * The frontend never controls the official progress percentage: it submits raw
 * inputs (a check-in value, or a milestone label) and the backend derives the
 * percentage here.
 */
import {
  COMPLETION_PROGRESS,
  MILESTONE_PROGRESS,
  MilestoneLabel,
  TrackingType,
  isMilestoneLabel,
} from "./rewards.constants";

/** Raised when a caller supplies invalid tracking/check-in data. */
export class ProgressValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgressValidationError";
  }
}

/** A target value must be a finite number strictly greater than zero. */
export function validateTargetValue(targetValue: number): void {
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    throw new ProgressValidationError("Target value must be greater than zero");
  }
}

/** A check-in value added to progress must be a finite, non-negative number. */
export function validateCheckInValue(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ProgressValidationError("Check-in value must not be negative");
  }
}

/**
 * Numeric progress for count / duration / amount tracking:
 *   progress = min(round((currentValue / targetValue) * 100), 100)
 * Current value is clamped at 0 so progress can never go negative.
 */
export function computeNumericProgress(currentValue: number, targetValue: number): number {
  validateTargetValue(targetValue);
  const current = Math.max(0, Number.isFinite(currentValue) ? currentValue : 0);
  const pct = Math.round((current / targetValue) * 100);
  return Math.min(Math.max(pct, 0), COMPLETION_PROGRESS);
}

/** Map a validated manual-milestone label to its canonical progress percentage. */
export function milestoneToProgress(milestone: string): number {
  if (!isMilestoneLabel(milestone)) {
    throw new ProgressValidationError(`Invalid milestone: ${String(milestone)}`);
  }
  return MILESTONE_PROGRESS[milestone as MilestoneLabel];
}

/**
 * Add a non-negative check-in value to the current value and return the new,
 * clamped current value (never negative). Used by numeric tracking types.
 */
export function applyCheckInValue(currentValue: number, valueAdded: number): number {
  validateCheckInValue(valueAdded);
  const current = Math.max(0, Number.isFinite(currentValue) ? currentValue : 0);
  return current + valueAdded;
}

export interface ProgressInput {
  trackingType: TrackingType;
  /** Current accumulated value (count/duration/amount). */
  currentValue?: number;
  /** Target value (count/duration/amount). Must be > 0 for numeric types. */
  targetValue?: number;
  /** Milestone label (manual_milestone tracking only). */
  milestone?: string;
}

/**
 * Compute the official progress percentage for any tracking type. This is the
 * canonical entry point used by the completion and check-in services.
 */
export function computeProgress(input: ProgressInput): number {
  switch (input.trackingType) {
    case "manual_milestone":
      if (input.milestone == null) {
        throw new ProgressValidationError("Milestone is required for manual tracking");
      }
      return milestoneToProgress(input.milestone);
    case "count":
    case "duration":
    case "amount":
      if (input.targetValue == null) {
        throw new ProgressValidationError("Target value is required for numeric tracking");
      }
      return computeNumericProgress(input.currentValue ?? 0, input.targetValue);
    default:
      throw new ProgressValidationError(`Unsupported tracking type: ${String(input.trackingType)}`);
  }
}

/**
 * Whether a milestone transition is a regression (progress decreases). The
 * caller must require explicit confirmation before persisting a regression.
 */
export function isMilestoneRegression(fromMilestone: string, toMilestone: string): boolean {
  return milestoneToProgress(toMilestone) < milestoneToProgress(fromMilestone);
}

export function isComplete(progress: number): boolean {
  return progress >= COMPLETION_PROGRESS;
}

export interface CheckInSubmission {
  /** Numeric tracking: value added this check-in (count/duration/amount). */
  value?: number;
  /** Manual tracking: the milestone stage selected. */
  milestone?: string;
}

export interface AppliedCheckIn {
  /** New accumulated current value (numeric tracking; unchanged for manual). */
  currentValue: number;
  /** New official progress percentage (0..100). */
  progress: number;
  /** Value added this check-in (numeric tracking). */
  valueAdded?: number;
  /** Milestone stored this check-in (manual tracking). */
  milestone?: string;
}

/**
 * Apply a single check-in submission to an item's stored tracking state and
 * return the new current value + official progress. This is the ONE place a
 * check-in's official progress is derived — the client never supplies it.
 */
export function applyCheckIn(params: {
  trackingType: TrackingType;
  currentValue: number;
  targetValue?: number | null;
  submission: CheckInSubmission;
}): AppliedCheckIn {
  const { trackingType, currentValue, targetValue, submission } = params;

  if (trackingType === "manual_milestone") {
    if (submission.milestone == null) {
      throw new ProgressValidationError("Milestone is required for manual tracking");
    }
    const progress = milestoneToProgress(submission.milestone);
    return { currentValue, progress, milestone: submission.milestone };
  }

  // Numeric tracking (count / duration / amount).
  if (submission.value == null) {
    throw new ProgressValidationError("A check-in value is required for numeric tracking");
  }
  validateCheckInValue(submission.value);
  const target = targetValue == null ? NaN : Number(targetValue);
  validateTargetValue(target);
  const nextCurrent = applyCheckInValue(currentValue, submission.value);
  const progress = computeNumericProgress(nextCurrent, target);
  return { currentValue: nextCurrent, progress, valueAdded: submission.value };
}
