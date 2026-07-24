/**
 * System-generated achievement catalog — the SINGLE backend definition of the
 * achievements the product awards automatically from a user's activity.
 *
 * These were previously hardcoded in the web client (Achievements.tsx) and were
 * therefore display-only: no persisted row, no completion date, no reward. This
 * module makes the backend authoritative. Definitions live here (not in the DB)
 * because the unlock rule is business logic; the DB stores per-user STATE only
 * (`achievements` catalog row + `user_achievements` progress/earned row).
 *
 * The ids are FIXED uuids so catalog rows, `user_achievements` rows and point
 * ledger entries are stable and idempotent across deploys. Never change them.
 */

/** Activity metrics an unlock rule can be evaluated against. */
export type SystemAchievementMetric =
  | "sessions_completed"
  | "mood_checkins"
  | "journal_entries"
  | "wellness_exercises"
  | "streak_days"
  | "community_posts";

export interface SystemAchievementDefinition {
  /** Stable catalog uuid — also the point-ledger `source_item_id`. */
  id: string;
  /** Legacy client-side id ('1'..'8'), kept so the UI can de-duplicate. */
  legacyId: string;
  title: string;
  description: string;
  /** Existing frontend icon-map key (no new icon system). */
  icon: string;
  category: string;
  metric: SystemAchievementMetric;
  /** Threshold at which the achievement unlocks (progress >= threshold). */
  threshold: number;
  /** Reward points — the EXISTING configured values, unchanged. */
  points: number;
  rarity: "common" | "rare" | "legendary";
}

export const SYSTEM_ACHIEVEMENTS: readonly SystemAchievementDefinition[] = [
  {
    id: "b1f2a3c4-0001-4a10-9c01-5e7d8a9b0001",
    legacyId: "1",
    title: "First Steps",
    description: "Complete your first Talk with Solace",
    icon: "footprints",
    category: "sessions",
    metric: "sessions_completed",
    threshold: 1,
    points: 10,
    rarity: "common",
  },
  {
    id: "b1f2a3c4-0002-4a10-9c01-5e7d8a9b0002",
    legacyId: "2",
    title: "Consistent Journey",
    description: "Complete 10 Talks with Solace",
    icon: "target",
    category: "sessions",
    metric: "sessions_completed",
    threshold: 10,
    points: 50,
    rarity: "rare",
  },
  {
    id: "b1f2a3c4-0003-4a10-9c01-5e7d8a9b0003",
    legacyId: "3",
    title: "Mood Master",
    description: "Log your mood 7 times",
    icon: "heart",
    category: "mood",
    metric: "mood_checkins",
    threshold: 7,
    points: 25,
    rarity: "rare",
  },
  {
    id: "b1f2a3c4-0004-4a10-9c01-5e7d8a9b0004",
    legacyId: "4",
    title: "Journaling Pro",
    description: "Write 20 journal entries",
    icon: "book",
    category: "journal",
    metric: "journal_entries",
    threshold: 20,
    points: 40,
    rarity: "rare",
  },
  {
    id: "b1f2a3c4-0005-4a10-9c01-5e7d8a9b0005",
    legacyId: "5",
    title: "Wellness Warrior",
    description: "Complete 5 wellness exercises",
    icon: "zap",
    category: "wellness",
    metric: "wellness_exercises",
    threshold: 5,
    points: 30,
    rarity: "common",
  },
  {
    id: "b1f2a3c4-0006-4a10-9c01-5e7d8a9b0006",
    legacyId: "6",
    title: "Night Owl",
    description: "Complete 14 wellness exercises",
    icon: "moon",
    category: "wellness",
    metric: "wellness_exercises",
    threshold: 14,
    points: 35,
    rarity: "rare",
  },
  {
    id: "b1f2a3c4-0007-4a10-9c01-5e7d8a9b0007",
    legacyId: "7",
    title: "Legendary Dedication",
    description: "Maintain a 30-day streak",
    icon: "trophy",
    category: "streak",
    metric: "streak_days",
    threshold: 30,
    points: 100,
    rarity: "legendary",
  },
  {
    id: "b1f2a3c4-0008-4a10-9c01-5e7d8a9b0008",
    legacyId: "8",
    title: "Community Contributor",
    description: "Publish 3 community posts",
    icon: "users",
    category: "community",
    metric: "community_posts",
    threshold: 3,
    points: 20,
    rarity: "common",
  },
] as const;

/**
 * Point-ledger source type for system achievement completions. Re-exported from
 * the canonical gamification constants — never redefined here.
 */
export { POINT_SOURCE_TYPES } from "../gamification/rewards.constants";
import { POINT_SOURCE_TYPES as SOURCE_TYPES } from "../gamification/rewards.constants";
export const SYSTEM_ACHIEVEMENT_COMPLETION = SOURCE_TYPES.SYSTEM_ACHIEVEMENT_COMPLETION;

export function findSystemAchievement(id: string): SystemAchievementDefinition | undefined {
  return SYSTEM_ACHIEVEMENTS.find((a) => a.id === id);
}
