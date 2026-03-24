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

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const computeUnreadCount = (items: Notification[]) =>
    items.reduce((count, item) => count + (item.is_read ? 0 : 1), 0);

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
      setNotifications(data);
      setUnreadCount(computeUnreadCount(data));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            setNotifications((prev) => {
              // Realtime can replay inserts on reconnect; dedupe by id.
              if (prev.some((item) => item.id === newNotification.id)) {
                return prev;
              }
              const next = [newNotification, ...prev];
              setUnreadCount(computeUnreadCount(next));
              return next;
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
        setUnreadCount(0);
    }
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(computeUnreadCount(next));
        return next;
      });
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
      setUnreadCount(0);
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
