import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider, useNotifications } from './NotificationsContext';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  removeChannel: vi.fn(),
  realtimeInsert: null as null | ((payload: { new: unknown }) => void),
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    notifications: {
      getAll: mocks.getAll,
      getUnreadCount: mocks.getUnreadCount,
      markAsRead: mocks.markAsRead,
      markAllAsRead: mocks.markAllAsRead,
    },
  },
}));

vi.mock('@/lib/supabase', () => {
  const channel = {
    on: vi.fn(
      (
        _event: string,
        _filter: unknown,
        handler: (payload: { new: unknown }) => void,
      ) => {
        mocks.realtimeInsert = handler;
        return channel;
      },
    ),
    subscribe: vi.fn(() => channel),
  };

  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: mocks.removeChannel,
    },
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

function Consumer() {
  const {
    notifications,
    unreadCount,
    isLoading,
    ensureNotificationsLoaded,
  } = useNotifications();

  return (
    <div>
      <span>badge:{unreadCount}</span>
      <span>items:{notifications.length}</span>
      <span>loading:{String(isLoading)}</span>
      <button type="button" onClick={ensureNotificationsLoaded}>
        Open notifications
      </button>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider>
        <Consumer />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

describe('NotificationsProvider request lifecycle', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/app/dashboard');
    mocks.getAll.mockReset();
    mocks.getUnreadCount.mockReset();
    mocks.markAsRead.mockReset();
    mocks.markAllAsRead.mockReset();
    mocks.removeChannel.mockReset();
    mocks.realtimeInsert = null;

    mocks.getUnreadCount.mockResolvedValue({ count: 3 });
    mocks.getAll.mockResolvedValue({
      notifications: [
        {
          id: 'n1',
          type: 'system',
          title: 'Welcome',
          message: 'Hello',
          is_read: false,
          created_at: '2026-09-10T00:00:00.000Z',
          metadata: null,
        },
      ],
    });
  });

  it('loads only the badge until a notification list is opened', async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByText('badge:3')).toBeInTheDocument());
    expect(screen.getByText('items:0')).toBeInTheDocument();
    expect(screen.getByText('loading:false')).toBeInTheDocument();
    expect(mocks.getUnreadCount).toHaveBeenCalledOnce();
    expect(mocks.getAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));

    await waitFor(() => expect(screen.getByText('items:1')).toBeInTheDocument());
    expect(mocks.getAll).toHaveBeenCalledOnce();
    expect(mocks.getAll).toHaveBeenCalledWith({ page: 1, limit: 100 });
  });

  it('does not turn a realtime insert into an incomplete list cache', async () => {
    renderProvider();
    await waitFor(() => expect(mocks.realtimeInsert).not.toBeNull());

    mocks.getUnreadCount.mockResolvedValue({ count: 4 });
    mocks.realtimeInsert?.({
      new: {
        id: 'n2',
        type: 'system',
        title: 'New',
        message: 'New notification',
        is_read: false,
        created_at: '2026-09-10T00:01:00.000Z',
        metadata: null,
      },
    });

    await waitFor(() => expect(screen.getByText('badge:4')).toBeInTheDocument());
    expect(screen.getByText('items:0')).toBeInTheDocument();
    expect(mocks.getAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    await waitFor(() => expect(screen.getByText('items:1')).toBeInTheDocument());
    expect(mocks.getAll).toHaveBeenCalledOnce();
  });
});
