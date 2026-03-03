import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { CreateNotificationInput } from './notifications.schema';

export const notificationsService = {
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

  async broadcast(input: Omit<CreateNotificationInput, 'user_id'>) {
    const profiles = await prisma.profiles.findMany({ 
      select: { 
        id: true, 
        notification_preferences: true 
      } 
    });
    
    const data = profiles
      .filter(p => {
        const prefs = p.notification_preferences as any;
        return !prefs || prefs.pushEnabled !== false;
      })
      .map(p => ({
        user_id: p.id,
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
