import prisma from '../../lib/prisma';
import { CreateJournalInput, UpdateJournalInput } from './journal.schema';

export async function createJournalEntry(userId: string, data: CreateJournalInput) {
  return prisma.journal_entries.create({
    data: {
      user_id: userId,
      ...data,
    },
  });
}

export async function getJournalEntries(userId: string) {
  return prisma.journal_entries.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
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
