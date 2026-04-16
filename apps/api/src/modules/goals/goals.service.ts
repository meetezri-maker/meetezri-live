import prisma from "../../lib/prisma";
import {
  CreateGoalCheckInInput,
  CreateGoalInput,
  UpdateGoalInput,
  UpdateGoalStatusInput,
} from "./goals.schema";

const nowIso = () => new Date().toISOString();

export async function listGoals(userId: string) {
  return prisma.personal_goals.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
}

export async function getGoalById(userId: string, goalId: string) {
  return prisma.personal_goals.findFirst({
    where: { id: goalId, user_id: userId },
  });
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  const progress = Number(input.progress_percentage ?? 0);
  const status =
    progress >= 100 ? "completed" : progress > 0 ? "active" : "not_started";

  return prisma.personal_goals.create({
    data: {
      user_id: userId,
      goal_title: input.goal_title,
      goal_category: input.goal_category,
      goal_description: input.goal_description,
      why_this_goal_matters: input.why_this_goal_matters,
      target_outcome: input.target_outcome,
      priority_level: input.priority_level,
      status,
      start_date: input.start_date,
      target_date: input.target_date || null,
      progress_percentage: progress,
      check_in_frequency: input.check_in_frequency ?? "daily",
      reminder_enabled: input.reminder_enabled ?? false,
      reminder_time: input.reminder_time || null,
      small_action_steps: input.small_action_steps ?? [],
      emotion_tag: input.emotion_tag || null,
      support_type_needed: input.support_type_needed || null,
      notes: input.notes || null,
      last_check_in_date: null,
      streak_count: 0,
      ai_suggestions: [],
      partner_visibility: input.partner_visibility ?? false,
      partner_comment_enabled: input.partner_comment_enabled ?? false,
      completion_note: null,
    },
  });
}

export async function updateGoal(userId: string, goalId: string, patch: UpdateGoalInput) {
  const existing = await getGoalById(userId, goalId);
  if (!existing) return null;

  const nextProgress =
    patch.progress_percentage == null
      ? existing.progress_percentage
      : Number(patch.progress_percentage);
  const nextStatus =
    patch.status ??
    (nextProgress >= 100
      ? "completed"
      : nextProgress > 0 && existing.status === "not_started"
        ? "active"
        : existing.status);

  return prisma.personal_goals.update({
    where: { id: goalId },
    data: {
      ...patch,
      target_date: patch.target_date === undefined ? undefined : patch.target_date || null,
      reminder_time: patch.reminder_time === undefined ? undefined : patch.reminder_time || null,
      emotion_tag: patch.emotion_tag === undefined ? undefined : patch.emotion_tag || null,
      support_type_needed:
        patch.support_type_needed === undefined ? undefined : patch.support_type_needed || null,
      notes: patch.notes === undefined ? undefined : patch.notes || null,
      progress_percentage: nextProgress,
      status: nextStatus,
      updated_at: nowIso(),
    },
  });
}

export async function updateGoalStatus(
  userId: string,
  goalId: string,
  input: UpdateGoalStatusInput
) {
  const existing = await getGoalById(userId, goalId);
  if (!existing) return null;

  return prisma.personal_goals.update({
    where: { id: goalId },
    data: {
      status: input.status,
      updated_at: nowIso(),
    },
  });
}

export async function removeGoal(userId: string, goalId: string) {
  const existing = await getGoalById(userId, goalId);
  if (!existing) return false;
  await prisma.personal_goals.delete({ where: { id: goalId } });
  return true;
}

export async function listGoalCheckIns(userId: string, goalId: string) {
  return prisma.goal_check_ins.findMany({
    where: { user_id: userId, goal_id: goalId },
    orderBy: { created_at: "desc" },
  });
}

export async function addGoalCheckIn(
  userId: string,
  goalId: string,
  input: CreateGoalCheckInInput
) {
  const goal = await getGoalById(userId, goalId);
  if (!goal) return null;

  const created = await prisma.goal_check_ins.create({
    data: {
      user_id: userId,
      goal_id: goalId,
      progress_percentage: input.progress_percentage,
      mood: input.mood || null,
      reflection: input.reflection || null,
      challenges_faced: input.challenges_faced || null,
      wins: input.wins || null,
      notes: input.notes || null,
    },
  });

  await prisma.personal_goals.update({
    where: { id: goalId },
    data: {
      progress_percentage: input.progress_percentage,
      last_check_in_date: created.created_at.toISOString(),
      status:
        input.progress_percentage >= 100
          ? "completed"
          : goal.status === "not_started"
            ? "active"
            : goal.status,
      updated_at: nowIso(),
    },
  });

  return created;
}
