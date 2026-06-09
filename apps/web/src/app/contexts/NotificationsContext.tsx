import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queries';
import { isPublicAuthPath } from '@/lib/publicAuthRoutes';

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

export function normalizeNotifications(payload: unknown): Notification[] {
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
  const onPublicAuthPage =
    typeof window !== 'undefined' && isPublicAuthPath(window.location.pathname);

  // Recent notifications for header / emergency history (first page only).
  const { data: notificationsRaw, isPending, isFetching } = useQuery({
    queryKey: queryKeys.notifications.byUser(user?.id),
    queryFn: () => api.notifications.getAll({ page: 1, limit: 100 }),
    enabled: !!user && !onPublicAuthPage,
    staleTime: 30_000,
    retry: 1,
  });

  const isLoading = isPending && isFetching;

  const { data: unreadCountRaw } = useQuery({
    queryKey: [...queryKeys.notifications.byUser(user?.id), 'unread-count'] as const,
    queryFn: () => api.notifications.getUnreadCount(),
    enabled: !!user && !onPublicAuthPage,
    staleTime: 10_000,
  });

  const notifications = notificationsRaw ? normalizeNotifications(notificationsRaw) : [];
  const unreadCount =
    typeof unreadCountRaw?.count === 'number'
      ? unreadCountRaw.count
      : computeUnreadCount(notifications);

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
                return old;
              }
              const next = [newNotification, ...existing];
              if (old && typeof old === 'object' && !Array.isArray(old)) {
                const meta = old as { total?: number; page?: number; pageSize?: number };
                return {
                  ...meta,
                  notifications: next,
                  total: typeof meta.total === 'number' ? meta.total + 1 : next.length,
                };
              }
              return next;
            }
          );

          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
          queryClient.invalidateQueries({
            queryKey: [...queryKeys.notifications.byUser(user.id), 'unread-count'],
          });

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

  const updateNotificationsReadState = (
    old: unknown,
    updater: (items: Notification[]) => Notification[]
  ) => {
    const items = normalizeNotifications(old);
    const next = updater(items);
    if (old && typeof old === 'object' && !Array.isArray(old)) {
      return { ...(old as object), notifications: next };
    }
    return next;
  };

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      queryClient.setQueryData(queryKeys.notifications.byUser(user?.id), (old: unknown) =>
        updateNotificationsReadState(old, (items) =>
          items.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.notifications.byUser(user?.id), 'unread-count'],
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      queryClient.setQueryData(queryKeys.notifications.byUser(user?.id), (old: unknown) =>
        updateNotificationsReadState(old, (items) => items.map((n) => ({ ...n, is_read: true })))
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.notifications.byUser(user?.id), 'unread-count'],
      });
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
