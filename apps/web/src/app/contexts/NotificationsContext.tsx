import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queries';

export interface Notification {
  id: string;
  type: string;
  title: string | null;
  message: string | null;
  is_read: boolean | null;
  created_at: string;
  metadata: any | null;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

function computeUnreadCount(items: Notification[]) {
  return items.reduce((count, item) => {
    if (!item || typeof item !== 'object') return count;
    return count + (item.is_read === true ? 0 : 1);
  }, 0);
}

function normalizeNotifications(payload: unknown): Notification[] {
  if (Array.isArray(payload)) return payload as Notification[];

  if (payload && typeof payload === 'object') {
    const maybeItems = (payload as { notifications?: unknown }).notifications;
    if (Array.isArray(maybeItems)) return maybeItems as Notification[];
  }

  return [];
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Replace fetchNotifications useState+useEffect with useQuery.
  // staleTime: 30_000 per .cursorrules (Notifications list).
  const { data: notificationsRaw, isLoading } = useQuery({
    queryKey: queryKeys.notifications.byUser(user?.id),
    queryFn: () => api.notifications.getAll(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const notifications = notificationsRaw ? normalizeNotifications(notificationsRaw) : [];
  const unreadCount = computeUnreadCount(notifications);

  // Realtime subscription — NOT migrated to useQuery per .cursorrules.
  // Channel name, cleanup, and CHANNEL_ERROR handling are per .cursorrules spec.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          if (!newNotification || !newNotification.id) return;

          // Prepend into the query cache so all consumers update immediately.
          queryClient.setQueryData(
            queryKeys.notifications.byUser(user.id),
            (old: unknown) => {
              const existing = normalizeNotifications(old);
              // Dedupe by id — realtime can replay inserts on reconnect.
              if (existing.some((item) => item.id === newNotification.id)) {
                return existing;
              }
              return [newNotification, ...existing];
            }
          );

          toast(newNotification.title || 'New Notification', {
            description: newNotification.message,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[NotificationsContext] Realtime channel error for user', user.id);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      queryClient.setQueryData(
        queryKeys.notifications.byUser(user?.id),
        (old: unknown) => normalizeNotifications(old).map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      queryClient.setQueryData(
        queryKeys.notifications.byUser(user?.id),
        (old: unknown) => normalizeNotifications(old).map((n) => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const refreshNotifications = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.byUser(user?.id),
    });

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
