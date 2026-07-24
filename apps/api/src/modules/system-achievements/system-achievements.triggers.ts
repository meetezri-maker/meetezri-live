/**
 * Centralized runtime evaluation trigger for system achievements.
 *
 * ONE hook, called from the authoritative backend write paths that change an
 * activity metric. Each call evaluates ONLY the achievements bound to the
 * metric that changed, so no request re-checks all 8 definitions.
 *
 * Event map (metric -> the backend write that moves it):
 *   sessions_completed  -> an app_sessions row is created            (sessions)
 *   mood_checkins       -> a mood_entries row is created             (moods)
 *   streak_days         -> a mood_entries row is created             (moods)
 *   journal_entries     -> a journal_entries row is created          (journal)
 *   wellness_exercises  -> a user_wellness_progress row is created   (wellness)
 *   community_posts     -> a community_posts row is created          (community)
 *
 * DELIBERATELY NOT wired to: the Progress Report GET, profile/session reads,
 * login, or any refresh path. Reading data must never mutate the ledger.
 */
import { evaluateSystemAchievements, type EvaluateResult } from "./system-achievements.service";
import type { SystemAchievementMetric } from "./system-achievements.constants";

/** Activity events the rest of the backend reports to this module. */
export type UserActivityEvent =
  | "session_completed"
  | "mood_logged"
  | "journal_created"
  | "wellness_exercise_completed"
  | "community_post_published";

/** Which metrics each activity event can move. */
const EVENT_METRICS: Record<UserActivityEvent, SystemAchievementMetric[]> = {
  session_completed: ["sessions_completed"],
  // A mood entry moves both the raw count and the derived streak.
  mood_logged: ["mood_checkins", "streak_days"],
  journal_created: ["journal_entries"],
  wellness_exercise_completed: ["wellness_exercises"],
  community_post_published: ["community_posts"],
};

/**
 * Report a completed user activity and award any system achievement the user
 * has newly unlocked. Safe to call after the primary write has committed.
 *
 * Failure-isolated on purpose: a reward problem must never fail (or roll back)
 * the user's actual action — the award itself is still transactional and
 * idempotent inside `evaluateSystemAchievements`, so a missed run is recovered
 * by the next activity of the same kind.
 */
export async function onUserActivity(
  userId: string,
  event: UserActivityEvent
): Promise<EvaluateResult | null> {
  if (!userId) return null;
  try {
    return await evaluateSystemAchievements(userId, { metrics: EVENT_METRICS[event] });
  } catch (error) {
    console.error(`[system-achievements] evaluation failed for ${event}`, error);
    return null;
  }
}
