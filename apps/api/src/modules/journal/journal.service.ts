import prisma from '../../lib/prisma';
import { CreateJournalInput, UpdateJournalInput } from './journal.schema';
import { notificationsService } from '../notifications/notifications.service';

export async function createJournalEntry(userId: string, data: CreateJournalInput) {
  return prisma.journal_entries.create({
    data: {
      user_id: userId,
      ...data,
    },
  });
}

export async function getJournalEntries(userId: string) {
  await notificationsService.ensureStreakRiskReminder(userId, 'journal');
  return prisma.journal_entries.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

const ALL_JOURNALS_CACHE_TTL = 120 * 1000; // 120 seconds
let allJournalsCache: { data: any[]; timestamp: number } | null = null;

function clearAllJournalsCache() {
  allJournalsCache = null;
}

export async function getAllJournalsAdmin() {
  const now = Date.now();
  if (allJournalsCache && now - allJournalsCache.timestamp < ALL_JOURNALS_CACHE_TTL) {
    return allJournalsCache.data;
  }

  const result = await prisma.journal_entries.findMany({
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

  allJournalsCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getJournalEntryById(userId: string, id: string) {
  return prisma.journal_entries.findFirst({
    where: {
      id,
      user_id: userId,
    },
  });
}

export async function updateJournalEntry(userId: string, id: string, data: UpdateJournalInput) {
  const existing = await prisma.journal_entries.findFirst({
    where: { id, user_id: userId },
  });

  if (!existing) {
    throw new Error('Journal entry not found');
  }

  return prisma.journal_entries.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function deleteJournalEntry(userId: string, id: string) {
  const existing = await prisma.journal_entries.findFirst({
    where: { id, user_id: userId },
  });

  if (!existing) {
    throw new Error('Journal entry not found');
  }

  return prisma.journal_entries.delete({
    where: { id },
  });
}

export async function toggleJournalFavorite(userId: string, id: string) {
  const existing = await prisma.journal_entries.findFirst({
    where: { id, user_id: userId },
  });

  if (!existing) {
    throw new Error('Journal entry not found');
  }

  return prisma.journal_entries.update({
    where: { id },
    data: {
      is_favorite: !existing.is_favorite,
    },
  });
}
