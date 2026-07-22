import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  CreateAchievementCheckInInput,
  CreateCustomAchievementInput,
  UpdateCustomAchievementInput,
} from "./custom-achievements.schema";
import { COMPLETION_PROGRESS, TrackingType } from "../gamification/rewards.constants";
import { userCalendarDate } from "../gamification/calendar";
import { applyCheckIn, computeNumericProgress } from "../gamification/progress.service";
import { completeItem, completeItemWithinTx, CompletionResult } from "../gamification/completion.service";

/** Raised when a second achievement check-in is attempted on the same user calendar day. */
export class DuplicateAchievementCheckInError extends Error {
  constructor() {
    super("A check-in already exists for this achievement today");
    this.name = "DuplicateAchievementCheckInError";
  }
}

/**
 * Derive `unlocked` from progress/total on the server. Returns undefined when
 * neither progress nor total is known (so an UPDATE leaves the column alone).
 */
function deriveUnlocked(
  progress: number | undefined,
  total: number | undefined
): boolean | undefined {
  if (progress == null || total == null) return undefined;
  if (!(total > 0)) return false;
  return progress >= total;
}

function toPayload(input: CreateCustomAchievementInput | UpdateCustomAchievementInput) {
  return {
    title: input.title,
    description: input.description,
    icon: input.icon,
    category: input.category,
    progress: input.progress,
    total: input.total,
    // Server-derived, never client-supplied. `points` is awarded only by the
    // completion service, so it is never written from create/update input.
    unlocked: deriveUnlocked(input.progress, input.total),
    rarity: input.rarity,
    goal_type: input.goalType ?? null,
    last_check_in_date: input.lastCheckInDate ?? null,
    check_in_history: input.checkInHistory ?? undefined,
    check_in_entries: input.checkInEntries ?? undefined,
    goal_category: input.goalCategory ?? null,
    why_it_matters: input.whyItMatters ?? null,
    target_outcome: input.targetOutcome ?? null,
    start_date: input.startDate ?? null,
    target_date: input.targetDate ?? null,
    priority: input.priority ?? null,
    progress_status: input.progressStatus ?? null,
    check_in_frequency: input.checkInFrequency ?? null,
    reminder_enabled: input.reminderEnabled ?? null,
    action_steps: input.actionSteps ?? null,
    mood_tag: input.moodTag ?? null,
    support_type: input.supportType ?? null,
    notes: input.notes ?? null,
    linked_goal_id: input.linkedGoalId ?? null,
    sync_with_goals: input.syncWithGoals ?? true,
    tracking_type: input.trackingType ?? undefined,
    tracking_unit: input.trackingUnit ?? undefined,
  };
}

export async function listCustomAchievements(userId: string) {
  return prisma.$queryRaw`
    SELECT *
    FROM public.custom_achievements
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
  `;
}

export async function createCustomAchievement(userId: string, input: CreateCustomAchievementInput) {
  const payload = toPayload(input);
  // Manual-milestone items use total=100 so the milestone percentage maps
  // directly to progress (and completion recomputes correctly).
  if (payload.tracking_type === "manual_milestone") {
    payload.total = 100;
    payload.progress = 0;
  }
  const rows = await prisma.$queryRaw`
    INSERT INTO public.custom_achievements (
      user_id, title, description, icon, category, progress, total, unlocked, points, rarity,
      goal_type, last_check_in_date, check_in_history, check_in_entries, goal_category,
      why_it_matters, target_outcome, start_date, target_date, priority, progress_status,
      check_in_frequency, reminder_enabled, action_steps, mood_tag, support_type, notes,
      linked_goal_id, sync_with_goals, tracking_type, tracking_unit
    )
    VALUES (
      ${userId}::uuid,
      ${payload.title!},
      ${payload.description!},
      ${payload.icon!},
      ${payload.category!},
      ${payload.progress!},
      ${payload.total!},
      ${payload.unlocked ?? false},
      ${0},
      ${payload.rarity!},
      ${payload.goal_type},
      ${payload.last_check_in_date},
      ${payload.check_in_history ?? []},
      ${payload.check_in_entries ? JSON.stringify(payload.check_in_entries) : null}::jsonb,
      ${payload.goal_category},
      ${payload.why_it_matters},
      ${payload.target_outcome},
      ${payload.start_date},
      ${payload.target_date},
      ${payload.priority},
      ${payload.progress_status},
      ${payload.check_in_frequency},
      ${payload.reminder_enabled},
      ${payload.action_steps},
      ${payload.mood_tag},
      ${payload.support_type},
      ${payload.notes},
      ${payload.linked_goal_id}::uuid,
      ${payload.sync_with_goals ?? true},
      ${payload.tracking_type ?? "count"},
      ${payload.tracking_unit ?? null}
    )
    RETURNING *
  `;
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function updateCustomAchievement(
  userId: string,
  achievementId: string,
  input: UpdateCustomAchievementInput
) {
  const payload = toPayload(input);
  const assignments: Prisma.Sql[] = [];
  const entries = Object.entries(payload) as Array<[keyof typeof payload, unknown]>;

  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (key === "check_in_entries") {
      assignments.push(
        Prisma.sql`${Prisma.raw(key)} = ${value ? JSON.stringify(value) : null}::jsonb`
      );
      continue;
    }
    if (key === "linked_goal_id") {
      assignments.push(Prisma.sql`${Prisma.raw(key)} = ${value}::uuid`);
      continue;
    }
    assignments.push(Prisma.sql`${Prisma.raw(key)} = ${value}`);
  }

  let row: Record<string, unknown> | null;
  if (!assignments.length) {
    const rows = await prisma.$queryRaw`
      SELECT *
      FROM public.custom_achievements
      WHERE id = ${achievementId}::uuid
        AND user_id = ${userId}::uuid
      LIMIT 1
    `;
    row = (Array.isArray(rows) ? rows[0] ?? null : rows) as Record<string, unknown> | null;
  } else {
    assignments.push(Prisma.sql`updated_at = timezone('utc'::text, now())`);
    const rows = await prisma.$queryRaw(
      Prisma.sql`
        UPDATE public.custom_achievements
        SET ${Prisma.join(assignments, ", ")}
        WHERE id = ${achievementId}::uuid
          AND user_id = ${userId}::uuid
        RETURNING *
      `
    );
    row = (Array.isArray(rows) ? rows[0] ?? null : rows) as Record<string, unknown> | null;
  }

  if (!row) return null;

  // If an edit (e.g. lowering the target) brings progress to/above the target,
  // complete + reward through the SAME centralized, idempotent completion
  // service (never a second +10; the frontend computes/awards nothing).
  const progress = Number(row.progress ?? 0);
  const total = Number(row.total ?? 0);
  const alreadyRewarded = Boolean(row.reward_awarded);
  if (!alreadyRewarded && total > 0 && progress >= total) {
    const completion = await completeItem({
      userId,
      itemType: "personal_achievement",
      itemId: achievementId,
    });
    if (completion.item) return completion.item;
  }

  return row;
}

export async function deleteCustomAchievement(userId: string, achievementId: string) {
  const count = await prisma.$executeRaw`
    DELETE FROM public.custom_achievements
    WHERE id = ${achievementId}::uuid
      AND user_id = ${userId}::uuid
  `;
  return count > 0;
}

interface AchievementRow {
  id: string;
  user_id: string;
  progress: number;
  total: number;
  tracking_type: string | null;
}

export async function listAchievementCheckIns(userId: string, achievementId: string) {
  // Ownership-scoped by user_id.
  return prisma.achievement_check_ins.findMany({
    where: { user_id: userId, achievement_id: achievementId },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Database-backed achievement check-in. The frontend submits only a value or a
 * milestone; the backend derives progress, enforces one-per-calendar-day, and
 * routes 100% through the centralized completion service (10-pt reward, once).
 */
export async function addAchievementCheckIn(
  userId: string,
  achievementId: string,
  input: CreateAchievementCheckInInput
) {
  // Ownership check via Prisma model (custom_achievements is exposed as a model).
  const achievement = (await prisma.custom_achievements.findFirst({
    where: { id: achievementId, user_id: userId },
    select: { id: true, user_id: true, progress: true, total: true, tracking_type: true },
  })) as AchievementRow | null;
  if (!achievement) return null;

  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const checkInDate = userCalendarDate(profile?.timezone);

  const trackingType = (achievement.tracking_type as TrackingType) ?? "count";
  const total = Number(achievement.total ?? 1);
  const isManual = trackingType === "manual_milestone";

  // For numeric tracking the stored `progress` IS the current value (count/amount/
  // duration). For manual tracking, `progress` stores the milestone percentage
  // (with total = 100), so it recomputes to the correct percentage.
  const currentValue = isManual ? Number(achievement.progress ?? 0) : Number(achievement.progress ?? 0);
  const applied = applyCheckIn({
    trackingType,
    currentValue,
    targetValue: isManual ? 100 : total,
    submission: { value: input.value, milestone: input.milestone },
  });

  const progressBefore = isManual
    ? Number(achievement.progress ?? 0)
    : computeNumericProgress(Number(achievement.progress ?? 0), total);
  const progressAfter = applied.progress;

  // New stored `progress`: milestone % for manual; capped count for numeric.
  const storedProgress = isManual
    ? applied.progress
    : Math.min(Math.round(applied.currentValue), total);

  const result = await prisma.$transaction(async (tx) => {
    try {
      await tx.achievement_check_ins.create({
        data: {
          user_id: userId,
          achievement_id: achievementId,
          check_in_date: new Date(`${checkInDate}T00:00:00.000Z`),
          value_added: applied.valueAdded ?? null,
          milestone: applied.milestone ?? null,
          progress_before: progressBefore,
          progress_after: progressAfter,
          note: input.note || null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new DuplicateAchievementCheckInError();
      }
      throw err;
    }

    await tx.custom_achievements.update({
      where: { id: achievementId },
      data: {
        progress: storedProgress,
        last_check_in_date: checkInDate,
        updated_at: new Date(),
      },
    });

    // Reaching 100% routes through the centralized completion service (10 pts, once).
    let completion: CompletionResult | null = null;
    if (progressAfter >= COMPLETION_PROGRESS) {
      completion = await completeItemWithinTx(tx, {
        userId,
        itemType: "personal_achievement",
        itemId: achievementId,
      });
    }

    return { progressAfter, completion };
  });

  return { achievementId, progress: progressAfter, completion: result.completion };
}
