import prisma from '../../lib/prisma';
import { CreateJournalInput, UpdateJournalInput } from './journal.schema';
import { notificationsService } from '../notifications/notifications.service';
import { invalidateRecentActivityCache } from '../users/user.service';

const journalListCache = new Map<string, { data: any[]; timestamp: number }>();
const journalByIdCache = new Map<string, { data: any; timestamp: number }>();
const JOURNAL_CACHE_TTL = 5 * 1000; // 5 seconds

function invalidateJournalCache(userId: string) {
  journalListCache.delete(userId);
  const prefix = `${userId}|`;
  for (const key of journalByIdCache.keys()) {
    if (key.startsWith(prefix)) journalByIdCache.delete(key);
  }
  clearAllJournalsCache();
}

export async function createJournalEntry(userId: string, data: CreateJournalInput) {
  const created = await prisma.journal_entries.create({
    data: {
      user_id: userId,
      ...data,
    },
  });
  invalidateJournalCache(userId);
  invalidateRecentActivityCache(userId);
  return created;
}

export async function getJournalEntries(userId: string) {
  const cached = journalListCache.get(userId);
  if (cached && Date.now() - cached.timestamp < JOURNAL_CACHE_TTL) {
    return cached.data;
  }
  await notificationsService.ensureStreakRiskReminder(userId, 'journal');
  const data = await prisma.journal_entries.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
  journalListCache.set(userId, { data, timestamp: Date.now() });
  return data;
}

const ALL_JOURNALS_CACHE_TTL = 120 * 1000; // 120 seconds
let allJournalsCache: { data: any[]; timestamp: number } | null = null;

function clearAllJournalsCache() {
  allJournalsCache = null;
}

export async function getAllJournalsAdmin(startDate?: Date, endDate?: Date) {
  const isFiltered = startDate != null || endDate != null;

  if (!isFiltered) {
    const now = Date.now();
    if (allJournalsCache && now - allJournalsCache.timestamp < ALL_JOURNALS_CACHE_TTL) {
      return allJournalsCache.data;
    }
  }

  const where: any = {};
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = startDate;
    if (endDate) where.created_at.lt = endDate;
  }

  const result = await prisma.journal_entries.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      profiles: {
        select: {
          email: true,
          full_name: true,
        },
      },
    },
  });

  if (!isFiltered) {
    allJournalsCache = { data: result, timestamp: Date.now() };
  }
  return result;
}

export async function getJournalEntryById(userId: string, id: string) {
  const key = `${userId}|${id}`;
  const cached = journalByIdCache.get(key);
  if (cached && Date.now() - cached.timestamp < JOURNAL_CACHE_TTL) {
    return cached.data;
  }
  const data = await prisma.journal_entries.findFirst({
    where: {
      id,
      user_id: userId,
    },
  });
  journalByIdCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function updateJournalEntry(userId: string, id: string, data: UpdateJournalInput) {
  const existing = await prisma.journal_entries.findFirst({
    where: { id, user_id: userId },
  });

  if (!existing) {
    throw new Error('Journal entry not found');
  }

  const updated = await prisma.journal_entries.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
  invalidateJournalCache(userId);
  return updated;
}

export async function deleteJournalEntry(userId: string, id: string) {
  const existing = await prisma.journal_entries.findFirst({
    where: { id, user_id: userId },
  });

  if (!existing) {
    throw new Error('Journal entry not found');
  }

  const deleted = await prisma.journal_entries.delete({
    where: { id },
  });
  invalidateJournalCache(userId);
  return deleted;
}

export async function toggleJournalFavorite(userId: string, id: string) {
  const existing = await prisma.journal_entries.findFirst({
    where: { id, user_id: userId },
  });

  if (!existing) {
    throw new Error('Journal entry not found');
  }

  const updated = await prisma.journal_entries.update({
    where: { id },
    data: {
      is_favorite: !existing.is_favorite,
    },
  });
  invalidateJournalCache(userId);
  return updated;
}
