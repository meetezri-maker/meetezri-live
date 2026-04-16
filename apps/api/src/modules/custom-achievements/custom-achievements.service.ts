import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  CreateCustomAchievementInput,
  UpdateCustomAchievementInput,
} from "./custom-achievements.schema";

function toPayload(input: CreateCustomAchievementInput | UpdateCustomAchievementInput) {
  return {
    title: input.title,
    description: input.description,
    icon: input.icon,
    category: input.category,
    progress: input.progress,
    total: input.total,
    unlocked: input.unlocked,
    points: input.points,
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
  const rows = await prisma.$queryRaw`
    INSERT INTO public.custom_achievements (
      user_id, title, description, icon, category, progress, total, unlocked, points, rarity,
      goal_type, last_check_in_date, check_in_history, check_in_entries, goal_category,
      why_it_matters, target_outcome, start_date, target_date, priority, progress_status,
      check_in_frequency, reminder_enabled, action_steps, mood_tag, support_type, notes,
      linked_goal_id, sync_with_goals
    )
    VALUES (
      ${userId}::uuid,
      ${payload.title!},
      ${payload.description!},
      ${payload.icon!},
      ${payload.category!},
      ${payload.progress!},
      ${payload.total!},
      ${payload.unlocked!},
      ${payload.points!},
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
      ${payload.sync_with_goals ?? true}
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

  if (!assignments.length) {
    const rows = await prisma.$queryRaw`
      SELECT *
      FROM public.custom_achievements
      WHERE id = ${achievementId}::uuid
        AND user_id = ${userId}::uuid
      LIMIT 1
    `;
    return Array.isArray(rows) ? rows[0] ?? null : rows;
  }

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
  return Array.isArray(rows) ? rows[0] ?? null : rows;
}

export async function deleteCustomAchievement(userId: string, achievementId: string) {
  const count = await prisma.$executeRaw`
    DELETE FROM public.custom_achievements
    WHERE id = ${achievementId}::uuid
      AND user_id = ${userId}::uuid
  `;
  return count > 0;
}
