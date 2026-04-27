import prisma from '../../lib/prisma';
import { CreateSleepEntryInput, UpdateSleepEntryInput } from './sleep.schema';

const sleepListCache = new Map<string, { data: any[]; timestamp: number }>();
const sleepByIdCache = new Map<string, { data: any; timestamp: number }>();
const SLEEP_CACHE_TTL = 5 * 1000; // 5 seconds

function clearSleepCacheForUser(userId: string) {
  sleepListCache.delete(userId);
  const prefix = `${userId}|`;
  for (const key of sleepByIdCache.keys()) {
    if (key.startsWith(prefix)) sleepByIdCache.delete(key);
  }
  allSleepCache = null;
}

export async function createSleepEntry(userId: string, data: CreateSleepEntryInput) {
  const created = await prisma.sleep_entries.create({
    data: {
      bed_time: data.bed_time,
      wake_time: data.wake_time,
      quality_rating: data.quality_rating,
      factors: data.factors,
      notes: data.notes,
      profiles: {
        connect: { id: userId },
      },
    },
  });
  clearSleepCacheForUser(userId);
  return created;
}

export async function getSleepEntries(userId: string) {
  const cached = sleepListCache.get(userId);
  if (cached && Date.now() - cached.timestamp < SLEEP_CACHE_TTL) {
    return cached.data;
  }
  const data = await prisma.sleep_entries.findMany({
    where: { user_id: userId },
    orderBy: { bed_time: 'desc' },
  });
  sleepListCache.set(userId, { data, timestamp: Date.now() });
  return data;
}

const ALL_SLEEP_CACHE_TTL = 120 * 1000; // 120 seconds
let allSleepCache: { data: any[]; timestamp: number } | null = null;

export async function getAllSleepEntriesAdmin() {
  const now = Date.now();
  if (allSleepCache && now - allSleepCache.timestamp < ALL_SLEEP_CACHE_TTL) {
    return allSleepCache.data;
  }

  const result = await prisma.sleep_entries.findMany({
    orderBy: { bed_time: 'desc' },
    include: {
      profiles: {
        select: {
          email: true,
          full_name: true,
        },
      },
    },
  });

  allSleepCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getSleepEntryById(userId: string, id: string) {
  const key = `${userId}|${id}`;
  const cached = sleepByIdCache.get(key);
  if (cached && Date.now() - cached.timestamp < SLEEP_CACHE_TTL) {
    return cached.data;
  }
  const data = await prisma.sleep_entries.findFirst({
    where: { id, user_id: userId },
  });
  sleepByIdCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function updateSleepEntry(userId: string, id: string, data: UpdateSleepEntryInput) {
  const entry = await prisma.sleep_entries.findFirst({ where: { id, user_id: userId } });
  if (!entry) {
    throw new Error('Sleep entry not found or unauthorized');
  }

  const updated = await prisma.sleep_entries.update({
    where: { id },
    data,
  });
  clearSleepCacheForUser(userId);
  return updated;
}

export async function deleteSleepEntry(userId: string, id: string) {
  const entry = await prisma.sleep_entries.findFirst({ where: { id, user_id: userId } });
  if (!entry) {
    throw new Error('Sleep entry not found or unauthorized');
  }

  const deleted = await prisma.sleep_entries.delete({
    where: { id },
  });
  clearSleepCacheForUser(userId);
  return deleted;
}
