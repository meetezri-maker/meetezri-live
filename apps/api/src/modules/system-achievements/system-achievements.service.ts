/**
 * System achievement lifecycle — backend authoritative.
 *
 * Progress is DERIVED from the user's real activity counts (never client input).
 * Earned state is persisted in `user_achievements` (existing table), and the
 * reward is written to the existing `point_transactions` ledger through the
 * existing `recordPointTransaction` helper — the points engine is NOT duplicated.
 *
 * IMPORTANT (retroactive policy): `evaluateSystemAchievements` awards points for
 * every currently-met threshold that has no ledger row yet. For an existing user
 * base this would award historic unlocks in bulk, so it is deliberately NOT wired
 * into any automatic read path. It runs only when called explicitly (approved
 * script/endpoint). See system-achievements.preflight.sql for the impact report.
 */
import prisma from "../../lib/prisma";
import { calculateStreak } from "../users/user.service";
import { recordPointTransaction, type PrismaClientLike } from "../gamification/points.service";
import {
  SYSTEM_ACHIEVEMENTS,
  SYSTEM_ACHIEVEMENT_COMPLETION,
  type SystemAchievementDefinition,
  type SystemAchievementMetric,
} from "./system-achievements.constants";

export type SystemAchievementMetrics = Record<SystemAchievementMetric, number>;

export interface SystemAchievementState {
  definition: SystemAchievementDefinition;
  /** Raw metric value (capped at the threshold for display parity). */
  progress: number;
  unlocked: boolean;
  /** Completion timestamp from `user_achievements.earned_at`, when earned. */
  earnedAt: Date | null;
  /** True when a ledger row exists for this user + achievement. */
  rewarded: boolean;
}

/**
 * Compute the activity metrics the unlock rules are evaluated against. All
 * counts are strictly scoped to the authenticated user.
 */
export async function getSystemAchievementMetrics(
  userId: string
): Promise<SystemAchievementMetrics> {
  const [sessions, moods, journals, wellness, community, moodRows] = await Promise.all([
    prisma.app_sessions.count({ where: { user_id: userId } }),
    prisma.mood_entries.count({ where: { user_id: userId } }),
    prisma.journal_entries.count({ where: { user_id: userId } }),
    prisma.user_wellness_progress.count({ where: { user_id: userId } }),
    prisma.community_posts.count({ where: { user_id: userId, deleted_at: null } }),
    // Streak reuses the EXISTING calculation (never re-implemented here).
    prisma.mood_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
  ]);

  return {
    sessions_completed: sessions,
    mood_checkins: moods,
    journal_entries: journals,
    wellness_exercises: wellness,
    community_posts: community,
    streak_days: calculateStreak(moodRows as unknown as any[]),
  };
}

/**
 * Read-only view of every system achievement for a user: derived progress plus
 * persisted earned/reward state. Performs NO writes — safe for the report.
 */
export async function listSystemAchievementStates(
  userId: string
): Promise<SystemAchievementState[]> {
  const ids = SYSTEM_ACHIEVEMENTS.map((a) => a.id);
  const [metrics, earnedRows, ledgerRows] = await Promise.all([
    getSystemAchievementMetrics(userId),
    prisma.user_achievements.findMany({
      where: { user_id: userId, achievement_id: { in: ids } },
    }),
    prisma.point_transactions.findMany({
      where: {
        user_id: userId,
        source_type: SYSTEM_ACHIEVEMENT_COMPLETION,
        source_item_id: { in: ids },
      },
      select: { source_item_id: true },
    }),
  ]);

  const earnedById = new Map(earnedRows.map((r) => [String(r.achievement_id), r]));
  const rewardedIds = new Set(ledgerRows.map((r) => String(r.source_item_id)));

  return SYSTEM_ACHIEVEMENTS.map((definition) => {
    const row = earnedById.get(definition.id);
    const raw = metrics[definition.metric] ?? 0;
    return {
      definition,
      progress: Math.min(raw, definition.threshold),
      // Earned state is persisted; derived metric alone never "completes" an item.
      unlocked: Boolean(row),
      earnedAt: row?.earned_at ?? null,
      rewarded: rewardedIds.has(definition.id),
    };
  });
}

/** Ensure the catalog row exists so `user_achievements` FK is satisfiable. */
async function ensureCatalogRow(
  client: PrismaClientLike,
  definition: SystemAchievementDefinition
): Promise<void> {
  await (client as typeof prisma).achievements.upsert({
    where: { id: definition.id },
    update: {},
    create: {
      id: definition.id,
      name: definition.title,
      description: definition.description,
      category: definition.category,
      points: definition.points,
    },
  });
}

export interface EvaluateResult {
  /** Achievement ids newly marked earned by this run. */
  newlyEarned: string[];
  /** Achievement ids that produced a NEW ledger row (points actually awarded). */
  newlyRewarded: string[];
  /** Total points awarded by this run. */
  pointsAwarded: number;
}

/**
 * Evaluate every system achievement for a user and, for each met threshold that
 * is not yet earned, persist the earned row AND award the reward atomically.
 *
 * Idempotency is enforced by the database, not by a pre-read:
 *  - `user_achievements` PK (user_id, achievement_id) prevents duplicate earns.
 *  - `point_transactions` unique (user_id, source_type, source_item_id) prevents
 *    duplicate rewards; `recordPointTransaction` maps P2002 to a no-op.
 * Each achievement is committed in its own transaction so one failure cannot
 * leave an earned row without its ledger entry (or vice versa).
 *
 * `dryRun` computes what WOULD happen and writes nothing.
 */
export async function evaluateSystemAchievements(
  userId: string,
  options: { dryRun?: boolean; metrics?: SystemAchievementMetric[] } = {}
): Promise<EvaluateResult> {
  const dryRun = options.dryRun === true;
  // Only evaluate achievements whose metric the caller actually changed. This
  // keeps activity hooks cheap instead of re-checking all 8 on every request.
  const scope = options.metrics && options.metrics.length ? new Set(options.metrics) : null;

  const states = await listSystemAchievementStates(userId);
  const metrics = await getSystemAchievementMetrics(userId);

  const result: EvaluateResult = { newlyEarned: [], newlyRewarded: [], pointsAwarded: 0 };

  for (const state of states) {
    const { definition } = state;
    if (scope && !scope.has(definition.metric)) continue;
    const meets = (metrics[definition.metric] ?? 0) >= definition.threshold;
    if (!meets) continue;
    if (state.unlocked && state.rewarded) continue; // already fully processed

    if (dryRun) {
      if (!state.unlocked) result.newlyEarned.push(definition.id);
      if (!state.rewarded) {
        result.newlyRewarded.push(definition.id);
        result.pointsAwarded += definition.points;
      }
      continue;
    }

    // Completion + reward are atomic per achievement.
    const awarded = await prisma.$transaction(async (tx) => {
      await ensureCatalogRow(tx, definition);

      const earned = await tx.user_achievements.upsert({
        where: {
          user_id_achievement_id: { user_id: userId, achievement_id: definition.id },
        },
        update: { progress: definition.threshold },
        create: {
          user_id: userId,
          achievement_id: definition.id,
          progress: definition.threshold,
        },
      });

      const ledger = await recordPointTransaction(tx, {
        userId,
        sourceType: SYSTEM_ACHIEVEMENT_COMPLETION,
        sourceItemId: definition.id,
        points: definition.points,
        reason: `System achievement completed: ${definition.title}`,
      });

      return { created: Boolean(earned), inserted: ledger.inserted };
    });

    if (!state.unlocked) result.newlyEarned.push(definition.id);
    if (awarded.inserted) {
      result.newlyRewarded.push(definition.id);
      result.pointsAwarded += definition.points;
    }
  }

  return result;
}
