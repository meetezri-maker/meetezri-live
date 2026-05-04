import prisma from "../../lib/prisma";
import { CreateHabitInput, UpdateHabitInput, LogHabitInput } from "./habits.schema";

const HABITS_CACHE_TTL = 60 * 1000; // 60 seconds
const habitsCache = new Map<string, { data: any[]; timestamp: number }>();
const habitsInFlight = new Map<string, Promise<any[]>>();

function clearHabitsCacheForUser(userId: string) {
  habitsCache.delete(userId);
  habitsInFlight.delete(userId);
}

function patchHabitsCacheAddLog(userId: string, habitId: string, log: { id: string; habit_id: string; completed_at: Date }) {
  const cached = habitsCache.get(userId);
  if (!cached) return false;
  const next = cached.data.map((h: any) => {
    if (h?.id !== habitId) return h;
    const prevLogs: any[] = Array.isArray(h?.habit_logs) ? h.habit_logs : [];
    // Keep newest-first order, and cap at 365 to match query.
    const merged = [log, ...prevLogs].slice(0, 365);
    return { ...h, habit_logs: merged };
  });
  habitsCache.set(userId, { data: next, timestamp: Date.now() });
  return true;
}

function patchHabitsCacheRemoveLogs(userId: string, habitId: string, logIds: string[]) {
  const cached = habitsCache.get(userId);
  if (!cached) return false;
  const toRemove = new Set(logIds);
  const next = cached.data.map((h: any) => {
    if (h?.id !== habitId) return h;
    const prevLogs: any[] = Array.isArray(h?.habit_logs) ? h.habit_logs : [];
    const kept = prevLogs.filter((l) => !toRemove.has(String(l?.id)));
    return { ...h, habit_logs: kept };
  });
  habitsCache.set(userId, { data: next, timestamp: Date.now() });
  return true;
}

export async function createHabit(userId: string, data: CreateHabitInput) {
  // Check if profile exists
  const profile = await prisma.profiles.findUnique({
    where: { id: userId }
  });

  if (!profile) {
    throw new Error('User profile not found. Please complete onboarding first.');
  }

  const created = await prisma.habits.create({
    data: {
      name: data.name!,
      category: data.category,
      frequency: data.frequency,
      color: data.color,
      icon: data.icon,
      profiles: {
        connect: { id: userId },
      },
    },
  });
  clearHabitsCacheForUser(userId);
  return created;
}

export async function getHabits(userId: string) {
  const now = Date.now();
  const cached = habitsCache.get(userId);
  if (cached && (now - cached.timestamp < HABITS_CACHE_TTL)) {
    return cached.data;
  }

  const inFlight = habitsInFlight.get(userId);
  if (inFlight) return await inFlight;

  const run = (async () => {
    const result = await prisma.habits.findMany({
      where: {
        user_id: userId,
        is_archived: false,
      },
      include: {
        habit_logs: {
          orderBy: {
            completed_at: 'desc',
          },
          take: 365, // Fetch enough history for streaks
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    habitsCache.set(userId, { data: result, timestamp: Date.now() });
    return result;
  })().finally(() => {
    habitsInFlight.delete(userId);
  });

  habitsInFlight.set(userId, run);
  return await run;
}

const ALL_HABITS_CACHE_TTL = 120 * 1000; // 120 seconds
let allHabitsCache: { data: any[]; timestamp: number } | null = null;

export async function getAllHabitsAdmin(startDate?: Date, endDate?: Date) {
  const isFiltered = startDate != null || endDate != null;

  if (!isFiltered) {
    const now = Date.now();
    if (allHabitsCache && now - allHabitsCache.timestamp < ALL_HABITS_CACHE_TTL) {
      return allHabitsCache.data;
    }
  }

  const logsWhere: any = {};
  if (startDate || endDate) {
    logsWhere.completed_at = {};
    if (startDate) logsWhere.completed_at.gte = startDate;
    if (endDate) logsWhere.completed_at.lt = endDate;
  }

  const result = await prisma.habits.findMany({
    where: { is_archived: false },
    include: {
      profiles: {
        select: { email: true, full_name: true },
      },
      habit_logs: {
        where: isFiltered ? logsWhere : undefined,
        orderBy: { completed_at: "desc" },
        take: isFiltered ? undefined : 60,
      },
    },
    orderBy: { created_at: "desc" },
  });

  if (!isFiltered) {
    allHabitsCache = { data: result, timestamp: Date.now() };
  }
  return result;
}

export async function updateHabit(userId: string, habitId: string, data: UpdateHabitInput) {
  // Verify ownership
  const habit = await prisma.habits.findFirst({
    where: { id: habitId, user_id: userId },
  });

  if (!habit) {
    throw new Error("Habit not found or unauthorized");
  }

  const updated = await prisma.habits.update({
    where: { id: habitId },
    data,
  });
  clearHabitsCacheForUser(userId);
  return updated;
}

export async function deleteHabit(userId: string, habitId: string) {
  // Verify ownership
  const habit = await prisma.habits.findFirst({
    where: { id: habitId, user_id: userId },
  });

  if (!habit) {
    throw new Error("Habit not found or unauthorized");
  }

  // Instead of hard delete, we might want to archive, but the requirement implies deletion capability.
  // The schema supports hard delete (cascade), so we can just delete.
  const deleted = await prisma.habits.delete({
    where: { id: habitId },
  });
  clearHabitsCacheForUser(userId);
  return deleted;
}

export async function logHabitCompletion(userId: string, habitId: string, data: LogHabitInput) {
  // Verify ownership
  const habit = await prisma.habits.findFirst({
    where: { id: habitId, user_id: userId },
  });

  if (!habit) {
    throw new Error("Habit not found or unauthorized");
  }

  const completedAt = data.completed_at ? new Date(data.completed_at) : new Date();

  // Check if already logged for this day (if frequency is daily)
  // Or just create a new log. The frontend requirement implies toggling.
  // If we want to toggle, we should check if a log exists for today.
  // But the service just "logs" it. We can have a separate "unlog" or "toggle" endpoint,
  // or handle it in the controller.
  // For simplicity, let's create a log. If the user wants to "uncomplete", they delete the log.
  
  const created = await prisma.habit_logs.create({
    data: {
      habit_id: habitId,
      completed_at: completedAt,
    },
  });
  // Keep the next GET /habits fast by patching cache when present.
  if (!patchHabitsCacheAddLog(userId, habitId, created as any)) {
    clearHabitsCacheForUser(userId);
  }
  return created;
}

export async function removeHabitCompletion(userId: string, habitId: string, dateStr: string) {
  // Verify ownership via habit
  const habit = await prisma.habits.findFirst({
    where: { id: habitId, user_id: userId },
  });

  if (!habit) {
    throw new Error("Habit not found or unauthorized");
  }

  // Find logs on that date
  const date = new Date(dateStr);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const logs = await prisma.habit_logs.findMany({
    where: {
      habit_id: habitId,
      completed_at: {
        gte: date,
        lt: nextDay,
      },
    },
  });

  if (logs.length > 0) {
    // Delete all logs for that day (in case of duplicates)
    await prisma.habit_logs.deleteMany({
      where: {
        id: {
          in: logs.map((l: typeof logs[number]) => l.id),
        },
      },
    });
    // Keep the next GET /habits fast by patching cache when present.
    if (!patchHabitsCacheRemoveLogs(userId, habitId, logs.map((l) => l.id))) {
      clearHabitsCacheForUser(userId);
    }
    return { success: true, count: logs.length };
  }

  return { success: false, message: "No logs found for this date" };
}
