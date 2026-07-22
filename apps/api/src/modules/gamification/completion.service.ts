/**
 * Completion reward service — the single, transactional path that marks an item
 * complete and awards its (once-only) reward.
 *
 * Every step runs inside one database transaction so a partial failure rolls
 * back cleanly. Idempotency is guaranteed by the ledger unique constraint, so
 * concurrent completion requests cannot award duplicate points.
 */
import prisma from "../../lib/prisma";
import {
  COMPLETION_PROGRESS,
  GamificationItemType,
  rewardForItemType,
} from "./rewards.constants";
import { computeNumericProgress } from "./progress.service";
import {
  PrismaClientLike,
  UserPointsSummary,
  getUserPointsSummary,
  recordPointTransaction,
} from "./points.service";

export interface CompletionResult {
  /** The persisted item after the attempt (null when not found / not owned). */
  item: unknown | null;
  /** Whether the item is at 100% and marked completed. */
  completed: boolean;
  /** True only when a reward row was newly inserted by THIS call. */
  awarded: boolean;
  /** True when the item had already been rewarded before this call. */
  alreadyRewarded: boolean;
  /** Reason a reward was not granted (e.g. "not_complete"). */
  reason?: "not_found" | "not_complete";
  /** User's total points + level after the attempt. */
  points: UserPointsSummary | null;
}

/** Official server-side progress for a personal goal. */
function goalProgress(goal: {
  progress_percentage: number | null;
  tracking_type?: string | null;
  current_value?: unknown;
  target_value?: unknown;
}): number {
  const trackingType = goal.tracking_type ?? "manual_milestone";
  const target = goal.target_value == null ? null : Number(goal.target_value);
  if ((trackingType === "count" || trackingType === "duration" || trackingType === "amount") && target && target > 0) {
    return computeNumericProgress(Number(goal.current_value ?? 0), target);
  }
  // Manual tracking: the stored percentage is the official progress.
  const pct = Number(goal.progress_percentage ?? 0);
  return Math.min(Math.max(Math.round(pct), 0), COMPLETION_PROGRESS);
}

/** Official server-side progress for a custom (personal) achievement. */
function achievementProgress(a: { progress: number | null; total: number | null }): number {
  const total = Number(a.total ?? 0);
  if (!(total > 0)) return 0;
  return computeNumericProgress(Number(a.progress ?? 0), total);
}

async function loadGoal(tx: PrismaClientLike, userId: string, itemId: string) {
  return tx.personal_goals.findFirst({ where: { id: itemId, user_id: userId } });
}

async function loadAchievement(tx: PrismaClientLike, userId: string, itemId: string) {
  return tx.custom_achievements.findFirst({ where: { id: itemId, user_id: userId } });
}

/**
 * Core completion logic, executed inside a caller-provided transaction so it can
 * be composed with the daily check-in write (single atomic unit).
 */
export async function completeItemWithinTx(
  tx: PrismaClientLike,
  params: { userId: string; itemType: GamificationItemType; itemId: string }
): Promise<CompletionResult> {
  const { userId, itemType, itemId } = params;

  // 1-3. Load (ownership-scoped) and read current reward state.
  const item =
    itemType === "personal_goal"
      ? await loadGoal(tx, userId, itemId)
      : await loadAchievement(tx, userId, itemId);

  if (!item) {
    return { item: null, completed: false, awarded: false, alreadyRewarded: false, reason: "not_found", points: null };
  }

  const rewardAwarded = Boolean((item as { reward_awarded?: boolean | null }).reward_awarded);

  // 4-5. Recalculate official progress and confirm it reached 100%.
  const progress =
    itemType === "personal_goal"
      ? goalProgress(item as never)
      : achievementProgress(item as never);

  if (progress < COMPLETION_PROGRESS) {
    const points = await getUserPointsSummary(userId, tx);
    return { item, completed: false, awarded: false, alreadyRewarded: rewardAwarded, reason: "not_complete", points };
  }

  // Already rewarded: keep it completed but never award twice.
  if (rewardAwarded) {
    const points = await getUserPointsSummary(userId, tx);
    return { item, completed: true, awarded: false, alreadyRewarded: true, points };
  }

  // 6-7. Mark completed + record completion date. 8. Reward from item type.
  const reward = rewardForItemType(itemType);
  const completedAt = new Date();

  let updatedItem: unknown;
  if (itemType === "personal_goal") {
    updatedItem = await tx.personal_goals.update({
      where: { id: itemId },
      data: {
        status: "completed",
        progress_percentage: COMPLETION_PROGRESS,
        reward_awarded: true,
        completed_at: completedAt,
        updated_at: completedAt,
      },
    });
  } else {
    updatedItem = await tx.custom_achievements.update({
      where: { id: itemId },
      data: {
        unlocked: true,
        points: reward.points,
        reward_awarded: true,
        completed_at: completedAt,
        updated_at: completedAt,
      },
    });
  }

  // 9. Insert the point transaction (idempotent under concurrency).
  const recorded = await recordPointTransaction(tx, {
    userId,
    sourceType: reward.sourceType,
    sourceItemId: itemId,
    points: reward.points,
    reason: `${itemType}_completion`,
  });

  // 10-11. Recalculate the user's derived total + level.
  const points = await getUserPointsSummary(userId, tx);

  // 12. Return updated item, points, and level.
  return {
    item: updatedItem,
    completed: true,
    awarded: recorded.inserted,
    alreadyRewarded: !recorded.inserted,
    points,
  };
}

/**
 * Public entry point: open a transaction and run completion atomically.
 */
export async function completeItem(params: {
  userId: string;
  itemType: GamificationItemType;
  itemId: string;
}): Promise<CompletionResult> {
  return prisma.$transaction((tx) => completeItemWithinTx(tx, params));
}
