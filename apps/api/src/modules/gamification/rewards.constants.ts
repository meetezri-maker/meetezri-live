/**
 * Centralized reward + gamification constants (single source of truth).
 *
 * These values are the ONLY place completion reward amounts are defined.
 * Routes/services MUST import from here and MUST NOT accept reward values
 * from the frontend. Do not duplicate these numeric literals elsewhere.
 */

/** Points awarded the first time a personal goal reaches 100%. */
export const PERSONAL_GOAL_COMPLETION_POINTS = 20;

/** Points awarded the first time a personal achievement reaches 100%. */
export const PERSONAL_ACHIEVEMENT_COMPLETION_POINTS = 10;

/** Item types this module can reward. */
export type GamificationItemType = "personal_goal" | "personal_achievement";

/**
 * Point-ledger source types. One row per (user, source_type, source_item_id)
 * is enforced by a DB unique constraint (see migration), guaranteeing a reward
 * can only ever be granted once per item.
 */
export const POINT_SOURCE_TYPES = {
  PERSONAL_GOAL_COMPLETION: "personal_goal_completion",
  PERSONAL_ACHIEVEMENT_COMPLETION: "personal_achievement_completion",
  /**
   * System-generated achievements (activity-derived, backend-awarded). Kept as a
   * distinct source type so reporting can tell personal and system rewards apart
   * without overloading the personal types.
   */
  SYSTEM_ACHIEVEMENT_COMPLETION: "system_achievement_completion",
} as const;

export type PointSourceType =
  (typeof POINT_SOURCE_TYPES)[keyof typeof POINT_SOURCE_TYPES];

/** Reward definition (source type + point amount) for a given item type. */
export interface CompletionReward {
  sourceType: PointSourceType;
  points: number;
}

const COMPLETION_REWARDS: Record<GamificationItemType, CompletionReward> = {
  personal_goal: {
    sourceType: POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION,
    points: PERSONAL_GOAL_COMPLETION_POINTS,
  },
  personal_achievement: {
    sourceType: POINT_SOURCE_TYPES.PERSONAL_ACHIEVEMENT_COMPLETION,
    points: PERSONAL_ACHIEVEMENT_COMPLETION_POINTS,
  },
};

/**
 * Resolve the reward (source type + points) for an item type. The reward is
 * derived exclusively from the item type on the backend — never from input.
 */
export function rewardForItemType(itemType: GamificationItemType): CompletionReward {
  return COMPLETION_REWARDS[itemType];
}

/** Progress tracking strategies supported by the foundation. */
export const TRACKING_TYPES = ["count", "duration", "amount", "manual_milestone"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export function isTrackingType(value: unknown): value is TrackingType {
  return typeof value === "string" && (TRACKING_TYPES as readonly string[]).includes(value);
}

/** Manual-milestone label -> canonical progress percentage. */
export const MILESTONE_PROGRESS = {
  not_started: 0,
  started: 25,
  making_progress: 50,
  significant_progress: 75,
  completed: 100,
} as const;

export type MilestoneLabel = keyof typeof MILESTONE_PROGRESS;

/** Manual-milestone labels in canonical (ascending) order. */
export const MILESTONE_LABELS = [
  "not_started",
  "started",
  "making_progress",
  "significant_progress",
  "completed",
] as const;

export function isMilestoneLabel(value: unknown): value is MilestoneLabel {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MILESTONE_PROGRESS, value);
}

/** Progress percentage that marks an item complete. */
export const COMPLETION_PROGRESS = 100;
