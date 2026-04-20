import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

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

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeNotifications = (payload: unknown): Notification[] => {
    if (Array.isArray(payload)) return payload as Notification[];

    if (payload && typeof payload === 'object') {
      const maybeItems = (payload as { notifications?: unknown }).notifications;
      if (Array.isArray(maybeItems)) return maybeItems as Notification[];
    }

    return [];
  };

  const syncUnreadCount = async () => {
    try {
      const result = await api.notifications.getUnreadCount();
      const count = Number(result?.count ?? 0);
      if (!Number.isNaN(count)) {
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Failed to sync unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.notifications.getAll();
      const normalized = normalizeNotifications(data);
      setNotifications(normalized);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep unread count in sync with list state. Never call setUnreadCount inside setNotifications
  // updaters (that pattern can break batching and has caused post-hydration crashes).
  useEffect(() => {
    setUnreadCount(computeUnreadCount(notifications));
  }, [notifications]);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Subscribe to realtime changes
      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const newNotification = payload.new as Notification;
            if (!newNotification || !newNotification.id) return;
            setNotifications((prev) => {
              // Realtime can replay inserts on reconnect; dedupe by id.
              if (prev.some((item) => item.id === newNotification.id)) {
                return prev;
              }
              return [newNotification, ...prev];
            });
            
            // Show toast
            toast(newNotification.title || 'New Notification', {
                description: newNotification.message,
            });
            await syncUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setNotifications([]);
    }
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      await syncUnreadCount();
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await syncUnreadCount();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications,
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
