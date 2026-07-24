import prisma from "../../lib/prisma";
import { CreateMoodInput } from "./moods.schema";
import { onUserActivity } from "../system-achievements/system-achievements.triggers";
import { invalidateRecentActivityCache, invalidateUserProfileCache } from "../users/user.service";
import { notificationsService } from "../notifications/notifications.service";

const userMoodsCache = new Map<string, { data: any[]; timestamp: number }>();
const USER_MOODS_CACHE_TTL = 30 * 1000; // 30s: list can be large; avoid re-querying during navigation
const userMoodsInFlight = new Map<string, Promise<any[]>>();

const ALL_MOODS_CACHE_TTL = 120 * 1000; // 120 seconds
let allMoodsCache: { data: any[]; timestamp: number } | null = null;

function clearMoodsCache() {
  allMoodsCache = null;
}

function clearUserMoodsCache(userId: string) {
  userMoodsCache.delete(userId);
  userMoodsInFlight.delete(userId);
}

export async function createMood(userId: string, input: CreateMoodInput) {
  // Update user profile current mood as well
  await prisma.profiles.update({
    where: { id: userId },
    data: { current_mood: input.mood },
  });

  const created = await prisma.mood_entries.create({
    data: {
      user_id: userId,
      mood: input.mood,
      intensity: input.intensity,
      activities: input.activities,
      notes: input.notes,
    },
  });
  invalidateUserProfileCache(userId);
  invalidateRecentActivityCache(userId);
  clearUserMoodsCache(userId);
  clearMoodsCache();
  // A mood entry moves both the mood count and the derived streak.
  await onUserActivity(userId, "mood_logged");
  return created;
}

export async function getMoodsByUserId(userId: string) {
  const cached = userMoodsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_MOODS_CACHE_TTL) {
    return cached.data;
  }

  const inFlight = userMoodsInFlight.get(userId);
  if (inFlight) return await inFlight;

  // IMPORTANT: don't block the moods list on reminder logic (it does extra DB work and may create rows).
  // Best-effort only; keep GET /moods fast and side-effect free.
  void notificationsService.ensureStreakRiskReminder(userId, "mood").catch(() => {});

  const run = (async () => {
  const data = await prisma.mood_entries.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
  userMoodsCache.set(userId, { data, timestamp: Date.now() });
  return data;
  })().finally(() => {
    userMoodsInFlight.delete(userId);
  });

  userMoodsInFlight.set(userId, run);
  return await run;
}

export async function getAllMoods() {
  const now = Date.now();
  if (allMoodsCache && (now - allMoodsCache.timestamp < ALL_MOODS_CACHE_TTL)) {
    return allMoodsCache.data;
  }

  const result = await prisma.mood_entries.findMany({
    orderBy: { created_at: "desc" },
    include: {
      profiles: {
        select: {
          email: true,
          full_name: true,
        },
      },
    },
  });

  allMoodsCache = { data: result, timestamp: Date.now() };
  return result;
}
