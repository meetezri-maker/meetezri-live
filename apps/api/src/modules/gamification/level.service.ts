/**
 * Centralized level calculation service — the single source of truth for how
 * total points map to a user level. Replaces the ad-hoc, mutually contradictory
 * level formulas previously computed per-module and client-side.
 *
 * Approved formula:
 *   level                  = floor(totalPoints / 100) + 1
 *   pointsWithinLevel      = totalPoints % 100
 *   pointsToNextLevel      = 100 - pointsWithinLevel
 *   levelProgressPercentage = pointsWithinLevel
 */

/** Points required to advance one level. */
export const POINTS_PER_LEVEL = 100;

export interface LevelInfo {
  /** Total points the level was computed from (floored, never negative). */
  totalPoints: number;
  /** Current level (>= 1). */
  level: number;
  /** Points accumulated within the current level (0..99). */
  pointsWithinLevel: number;
  /** Points still needed to reach the next level (1..100). */
  pointsToNextLevel: number;
  /** Progress toward the next level as a percentage (0..99). */
  levelProgressPercentage: number;
}

/**
 * Compute level information from a user's total points.
 *
 * Non-integer or negative inputs are normalized (floored, clamped at 0) so the
 * function is total and never returns a level below 1.
 */
export function calculateLevel(totalPoints: number): LevelInfo {
  const points = Number.isFinite(totalPoints) ? Math.max(0, Math.floor(totalPoints)) : 0;

  const level = Math.floor(points / POINTS_PER_LEVEL) + 1;
  const pointsWithinLevel = points % POINTS_PER_LEVEL;
  const pointsToNextLevel = POINTS_PER_LEVEL - pointsWithinLevel;
  const levelProgressPercentage = pointsWithinLevel;

  return {
    totalPoints: points,
    level,
    pointsWithinLevel,
    pointsToNextLevel,
    levelProgressPercentage,
  };
}
