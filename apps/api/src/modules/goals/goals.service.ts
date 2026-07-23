import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  CreateGoalCheckInInput,
  CreateGoalInput,
  UpdateGoalInput,
  UpdateGoalStatusInput,
} from "./goals.schema";
import { COMPLETION_PROGRESS, TrackingType } from "../gamification/rewards.constants";
import { userCalendarDate } from "../gamification/calendar";
import { applyCheckIn, computeNumericProgress } from "../gamification/progress.service";
import { completeItemWithinTx, CompletionResult } from "../gamification/completion.service";

const nowIso = () => new Date().toISOString();

/** Raised when a second check-in is attempted for the same item on the same user calendar day. */
export class DuplicateCheckInError extends Error {
  constructor() {
    super("A check-in already exists for this goal today");
    this.name = "DuplicateCheckInError";
  }
}

/** Raised when a client tries to set completion directly instead of via the completion service. */
export class DirectCompletionError extends Error {
  constructor() {
    super("Goals are completed automatically when progress reaches 100%");
    this.name = "DirectCompletionError";
  }
}

const goalsListCache = new Map<string, { data: any[]; timestamp: number }>();
const goalByIdCache = new Map<string, { data: any; timestamp: number }>();
const goalCheckinsCache = new Map<string, { data: any[]; timestamp: number }>();
const GOALS_CACHE_TTL = 5 * 1000; // 5 seconds

function invalidateGoalsCache(userId: string, goalId?: string) {
  goalsListCache.delete(userId);
  if (goalId) {
    goalByIdCache.delete(`${userId}|${goalId}`);
    goalCheckinsCache.delete(`${userId}|${goalId}`);
  } else {
    const prefix = `${userId}|`;
    for (const key of goalByIdCache.keys()) if (key.startsWith(prefix)) goalByIdCache.delete(key);
    for (const key of goalCheckinsCache.keys()) if (key.startsWith(prefix)) goalCheckinsCache.delete(key);
  }
}

export async function listGoals(userId: string) {
  const cached = goalsListCache.get(userId);
  if (cached && Date.now() - cached.timestamp < GOALS_CACHE_TTL) return cached.data;
  const data = await prisma.personal_goals.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
  goalsListCache.set(userId, { data, timestamp: Date.now() });
  return data;
}

export async function getGoalById(userId: string, goalId: string) {
  const key = `${userId}|${goalId}`;
  const cached = goalByIdCache.get(key);
  if (cached && Date.now() - cached.timestamp < GOALS_CACHE_TTL) return cached.data;
  const data = await prisma.personal_goals.findFirst({
    where: { id: goalId, user_id: userId },
  });
  goalByIdCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  // Progress is backend-owned: a new goal always starts at 0. Numeric tracking
  // requires a positive target; manual tracking needs none.
  const trackingType = input.tracking_type ?? "manual_milestone";
  const isNumeric = trackingType === "count" || trackingType === "duration" || trackingType === "amount";

  const created = await prisma.personal_goals.create({
    data: {
      user_id: userId,
      goal_title: input.goal_title,
      goal_category: input.goal_category,
      goal_description: input.goal_description,
      why_this_goal_matters: input.why_this_goal_matters,
      target_outcome: input.target_outcome,
      priority_level: input.priority_level,
      status: "not_started",
      start_date: input.start_date,
      target_date: input.target_date || null,
      progress_percentage: 0,
      tracking_type: trackingType,
      target_value: isNumeric && input.target_value != null ? input.target_value : null,
      current_value: 0,
      tracking_unit: input.tracking_unit || null,
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
  invalidateGoalsCache(userId);
  return created;
}

export async function updateGoal(userId: string, goalId: string, patch: UpdateGoalInput) {
  // Fresh read (the write path must not trust the cache).
  const existing = await prisma.personal_goals.findFirst({
    where: { id: goalId, user_id: userId },
  });
  if (!existing) return null;

  // Completion is reached only via the completion service (progress hits 100%).
  // A client may not mark a goal completed through a descriptive edit.
  if (patch.status === "completed" && existing.status !== "completed") {
    throw new DirectCompletionError();
  }

  // Historical integrity: once a goal is completed AND rewarded, its tracking
  // configuration is frozen. Silently ignore any tracking changes (descriptive
  // fields still apply) so no client — UI or direct API — can alter the recorded
  // progress/completion/reward. Completed goals stay completed + 100% forever.
  const isLocked = existing.status === "completed" && Boolean(existing.reward_awarded);
  if (isLocked) {
    patch.tracking_type = undefined;
    patch.target_value = undefined;
    patch.tracking_unit = undefined;
  }

  // Only descriptive/tracking-config fields are patchable here. Official
  // progress, current value, completion, and reward fields are never accepted.
  const {
    status: _status,
    completion_note: _completionNote,
    ...descriptive
  } = patch;

  // Recompute official progress from the STORED current value + the (possibly
  // edited) target, so an edited target is reflected immediately and the label/
  // bar can never show a stale percentage. Numeric tracking only; manual keeps
  // its milestone-derived progress untouched.
  const effTrackingType = (patch.tracking_type ??
    existing.tracking_type ??
    "manual_milestone") as TrackingType;
  const effTarget =
    patch.target_value !== undefined
      ? patch.target_value
      : existing.target_value == null
        ? null
        : Number(existing.target_value);
  const isNumeric =
    effTrackingType === "count" || effTrackingType === "duration" || effTrackingType === "amount";
  const currentValue = Number(existing.current_value ?? 0);
  // Locked goals never recompute progress (it stays exactly as recorded).
  const recomputedProgress =
    !isLocked && isNumeric && effTarget != null && Number(effTarget) > 0
      ? computeNumericProgress(currentValue, Number(effTarget))
      : null;

  const baseStatus = patch.status ?? existing.status;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.personal_goals.update({
      where: { id: goalId },
      data: {
        ...descriptive,
        target_date: patch.target_date === undefined ? undefined : patch.target_date || null,
        reminder_time: patch.reminder_time === undefined ? undefined : patch.reminder_time || null,
        emotion_tag: patch.emotion_tag === undefined ? undefined : patch.emotion_tag || null,
        support_type_needed:
          patch.support_type_needed === undefined ? undefined : patch.support_type_needed || null,
        notes: patch.notes === undefined ? undefined : patch.notes || null,
        tracking_unit: patch.tracking_unit === undefined ? undefined : patch.tracking_unit || null,
        progress_percentage: recomputedProgress == null ? undefined : recomputedProgress,
        status:
          recomputedProgress != null && recomputedProgress > 0 && baseStatus === "not_started"
            ? "active"
            : baseStatus,
        updated_at: nowIso(),
      },
    });

    // If the edit brings progress to 100%, complete + reward through the SAME
    // centralized, idempotent completion service (never a second reward; the
    // frontend computes/awards nothing).
    let completion: CompletionResult | null = null;
    if (recomputedProgress != null && recomputedProgress >= COMPLETION_PROGRESS) {
      completion = await completeItemWithinTx(tx, {
        userId,
        itemType: "personal_goal",
        itemId: goalId,
      });
    }
    return { updated, completion };
  });

  invalidateGoalsCache(userId, goalId);
  return result.completion?.item ?? result.updated;
}

export async function updateGoalStatus(
  userId: string,
  goalId: string,
  input: UpdateGoalStatusInput
) {
  const existing = await getGoalById(userId, goalId);
  if (!existing) return null;

  // Direct "completed" transitions are rejected — completion (and its reward)
  // can only happen through the centralized completion service.
  if (input.status === "completed" && existing.status !== "completed") {
    throw new DirectCompletionError();
  }

  const updated = await prisma.personal_goals.update({
    where: { id: goalId },
    data: {
      status: input.status,
      updated_at: nowIso(),
    },
  });
  invalidateGoalsCache(userId, goalId);
  return updated;
}

export async function removeGoal(userId: string, goalId: string) {
  const existing = await getGoalById(userId, goalId);
  if (!existing) return false;
  await prisma.personal_goals.delete({ where: { id: goalId } });
  invalidateGoalsCache(userId, goalId);
  return true;
}

export async function listGoalCheckIns(userId: string, goalId: string) {
  const key = `${userId}|${goalId}`;
  const cached = goalCheckinsCache.get(key);
  if (cached && Date.now() - cached.timestamp < GOALS_CACHE_TTL) return cached.data;
  const data = await prisma.goal_check_ins.findMany({
    where: { user_id: userId, goal_id: goalId },
    orderBy: { created_at: "desc" },
  });
  goalCheckinsCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function addGoalCheckIn(
  userId: string,
  goalId: string,
  input: CreateGoalCheckInInput
) {
  // Ownership check (fetch fresh; the write path must not trust the cache).
  const goal = await prisma.personal_goals.findFirst({
    where: { id: goalId, user_id: userId },
  });
  if (!goal) return null;

  // One check-in per item per USER calendar day (enforced in DB below).
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const checkInDate = userCalendarDate(profile?.timezone);

  const progressBefore = Number(goal.progress_percentage ?? 0);
  // The backend derives the official progress from the submitted value/milestone
  // and the goal's stored tracking config — never from a client percentage.
  const applied = applyCheckIn({
    trackingType: (goal.tracking_type as TrackingType) ?? "manual_milestone",
    currentValue: Number(goal.current_value ?? 0),
    targetValue: goal.target_value == null ? null : Number(goal.target_value),
    submission: { value: input.value, milestone: input.milestone },
  });
  const progressAfter = applied.progress;

  // Insert + progress update + (optional) completion in ONE transaction so a
  // failure at any step rolls back both the check-in and the progress change.
  const result = await prisma.$transaction(async (tx) => {
    let checkIn;
    try {
      checkIn = await tx.goal_check_ins.create({
        data: {
          user_id: userId,
          goal_id: goalId,
          progress_percentage: progressAfter,
          progress_before: progressBefore,
          progress_after: progressAfter,
          value_added: applied.valueAdded ?? null,
          milestone: applied.milestone ?? null,
          check_in_date: new Date(`${checkInDate}T00:00:00.000Z`),
          mood: input.mood || null,
          reflection: input.reflection || null,
          challenges_faced: input.challenges_faced || null,
          wins: input.wins || null,
          notes: input.note || input.notes || null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new DuplicateCheckInError();
      }
      throw err;
    }

    await tx.personal_goals.update({
      where: { id: goalId },
      data: {
        progress_percentage: progressAfter,
        current_value: applied.currentValue,
        last_check_in_date: checkIn.created_at.toISOString(),
        status:
          progressAfter >= COMPLETION_PROGRESS
            ? "completed"
            : goal.status === "not_started"
              ? "active"
              : goal.status,
        updated_at: nowIso(),
      },
    });

    // Reaching 100% routes through the centralized completion service, which
    // awards the reward at most once (idempotent via the ledger constraint).
    let completion: CompletionResult | null = null;
    if (progressAfter >= COMPLETION_PROGRESS) {
      completion = await completeItemWithinTx(tx, {
        userId,
        itemType: "personal_goal",
        itemId: goalId,
      });
    }

    return { checkIn, completion };
  });

  invalidateGoalsCache(userId, goalId);
  return { ...result.checkIn, completion: result.completion };
}
