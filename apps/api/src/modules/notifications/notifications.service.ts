import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { CreateNotificationInput } from './notifications.schema';

type StreakReminderType = 'mood' | 'journal';

const STREAK_REMINDER_TITLES: Record<StreakReminderType, string[]> = {
  mood: [
    'Your streak is on the line. don’t miss today’s check-in.',
    'Don’t break the chain. complete today’s activity!',
    'You’ve been doing great. want to keep the streak alive today?',
    'A quick check-in keeps your progress going.',
    'You’re one step away from another strong day!',
    'Keep the momentum, take a minute for yourself today.',
    'Take a moment for yourself. your streak will thank you.',
    'How are you feeling today? A quick check-in keeps your journey going.',
    'Pause, reflect, and keep your streak flowing.',
    'You’re on a roll. don’t let it slip now!',
    'Level up your streak. just one more check-in!',
    'Your future self says: ‘Don’t skip today!’',
    'Show up for yourself. today counts too.',
    'Progress isn’t perfect. just keep going.',
    'Still time to check in today.',
  ],
  journal: [
    'Last chance to keep your streak going. log today’s entry now!',
    'Almost there. just one quick entry to stay consistent.',
    'Don’t break the chain. complete today’s activity!',
    'You’ve been doing great. want to keep the streak alive today?',
    'You’re one step away from another strong day!',
    'Keep the momentum, take a minute for yourself today.',
    'Take a moment for yourself. your streak will thank you.',
    'Consistency builds clarity. log today’s thoughts.',
    'Pause, reflect, and keep your streak flowing.',
    'Streak in danger! Save it with today’s entry.',
    'You’re on a roll. don’t let it slip now!',
    'Your future self says: ‘Don’t skip today!’',
    'Even a few words today can make a difference.',
    'Show up for yourself. today counts too.',
    'Progress isn’t perfect. just keep going.',
    'What’s one thing on your mind today?',
    'Whenever you’re ready, your journal is here.',
    'A gentle reminder to log today’s moment.',
    'Your streak is waiting for today’s entry.',
  ],
};

const STREAK_REMINDER_CONFIG: Record<
  StreakReminderType,
  { preferenceKey: string; message: string }
> = {
  mood: {
    preferenceKey: 'moodCheckIns',
    message: 'Check in with your mood today so you do not lose your streak.',
  },
  journal: {
    preferenceKey: 'journalPrompts',
    message: 'Write in your journal today so you do not lose your streak.',
  },
};

function pickRandomStreakReminderTitle(type: StreakReminderType) {
  const titles = STREAK_REMINDER_TITLES[type];
  return titles[Math.floor(Math.random() * titles.length)];
}

function getStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDayDifference(laterDate: Date, earlierDate: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (getStartOfDay(laterDate).getTime() - getStartOfDay(earlierDate).getTime()) /
      millisecondsPerDay
  );
}

export const notificationsService = {
  async filterRecentDuplicates(
    userIds: string[],
    input: Pick<CreateNotificationInput, 'type' | 'title' | 'message'>
  ) {
    if (userIds.length === 0) return [];
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existing = await prisma.notifications.findMany({
      where: {
        user_id: { in: userIds },
        type: input.type,
        title: input.title ?? null,
        message: input.message ?? null,
        created_at: { gte: tenMinutesAgo },
      },
      select: { user_id: true },
    });
    const existingUserIds = new Set(existing.map((item) => item.user_id));
    return userIds.filter((id) => !existingUserIds.has(id));
  },

  async create(input: CreateNotificationInput) {
    const profile = await prisma.profiles.findUnique({
      where: { id: input.user_id },
      select: { notification_preferences: true }
    });

    const prefs = profile?.notification_preferences as any;
    if (prefs && prefs.pushEnabled === false) {
       throw new Error("User has disabled notifications");
    }

    return prisma.notifications.create({
      data: input as Prisma.notificationsUncheckedCreateInput,
    });
  },

  async ensureStreakRiskReminder(userId: string, type: StreakReminderType) {
    const config = STREAK_REMINDER_CONFIG[type];
    const today = new Date();
    const startOfToday = getStartOfDay(today);

    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { notification_preferences: true },
    });

    const preferences = profile?.notification_preferences as Record<string, any> | null;
    if (preferences?.pushEnabled === false) {
      return null;
    }

    if (preferences?.[config.preferenceKey] === false) {
      return null;
    }

    const latestEntry =
      type === 'mood'
        ? await prisma.mood_entries.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            select: { created_at: true },
          })
        : await prisma.journal_entries.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            select: { created_at: true },
          });

    if (!latestEntry) {
      return null;
    }

    const daysSinceLatestEntry = getDayDifference(today, latestEntry.created_at);
    if (daysSinceLatestEntry !== 1) {
      return null;
    }

    const existingReminders = await prisma.notifications.findMany({
      where: {
        user_id: userId,
        type: 'reminder',
        created_at: { gte: startOfToday },
      },
      select: { id: true, metadata: true },
    });

    const alreadySentToday = existingReminders.some((notification) => {
      const metadata = notification.metadata as Record<string, any> | null;
      return (
        metadata?.reminderKind === 'streak-risk' &&
        metadata?.streakType === type
      );
    });

    if (alreadySentToday) {
      return null;
    }

    const title = pickRandomStreakReminderTitle(type);

    return this.create({
      user_id: userId,
      type: 'reminder',
      title,
      message: config.message,
      metadata: {
        streakType: type,
        reminderKind: 'streak-risk',
        lastActivityAt: latestEntry.created_at.toISOString(),
      },
    });
  },

  async broadcast(input: Omit<CreateNotificationInput, 'user_id'>) {
    const profiles = await prisma.profiles.findMany({ 
      select: { 
        id: true, 
        notification_preferences: true 
      } 
    });
    
    const dedupedUserIds = Array.from(
      new Set(
        profiles
      .filter(p => {
        const prefs = p.notification_preferences as any;
        return !prefs || prefs.pushEnabled !== false;
      })
          .map((p) => p.id)
      )
    );

    const targetUserIds = await this.filterRecentDuplicates(dedupedUserIds, input);

    const data = targetUserIds.map((userId) => ({
        user_id: userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
        is_read: false
      }));

    if (data.length === 0) return { count: 0 };

    return prisma.notifications.createMany({
      data,
    });
  },

  async createManyForUsers(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'user_id'>
  ) {
    const dedupedUserIds = Array.from(new Set(userIds));
    const targetUserIds = await this.filterRecentDuplicates(dedupedUserIds, input);
    if (targetUserIds.length === 0) return { count: 0 };

    return prisma.notifications.createMany({
      data: targetUserIds.map((id) => ({
        user_id: id,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
        is_read: false
      })),
    });
  },

  async findAll(userId: string) {
    return prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  },

  async markAsRead(id: string, userId: string) {
    return prisma.notifications.update({
      where: { id, user_id: userId },
      data: { is_read: true },
    });
  },

  async markAllAsRead(userId: string) {
     return prisma.notifications.updateMany({
       where: { user_id: userId, is_read: false },
       data: { is_read: true },
     });
  },

  async getUnreadCount(userId: string) {
    return prisma.notifications.count({
      where: { user_id: userId, is_read: false },
    });
  }
};
