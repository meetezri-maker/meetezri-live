import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { AuthProvider } from './AuthContext';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMe: vi.fn(),
  initProfile: vi.fn(),
  clearMeCache: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        authMocks.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      updateUser: vi.fn().mockResolvedValue({}),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    getMe: authMocks.getMe,
    initProfile: authMocks.initProfile,
    clearMeCache: authMocks.clearMeCache,
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const user = {
  id: 'completed-user',
  email_confirmed_at: '2026-06-20T00:00:00Z',
  user_metadata: {},
};

const session = {
  user,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

const completedProfile = {
  id: user.id,
  onboarding_completed: true,
  signup_type: 'plan',
  subscription_plan: 'core',
  email_verified: true,
  role: 'user',
};

function renderProtectedDashboard() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <AuthProvider>
        <ProtectedRoute>
          <div>Dashboard ready</div>
        </ProtectedRoute>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthContext profile hydration recovery', () => {
  beforeEach(() => {
    authMocks.getSession.mockReset();
    authMocks.getMe.mockReset();
    authMocks.initProfile.mockReset();
    authMocks.clearMeCache.mockReset();
    authMocks.listener = null;
    authMocks.getMe.mockResolvedValue(completedProfile);
    authMocks.getSession.mockResolvedValue({ data: { session } });
  });

  it.each(['/login', '/auth/callback'])(
    'hydrates after navigation even when auth began on %s',
    async (publicPath) => {
      window.history.replaceState({}, '', publicPath);
      renderProtectedDashboard();

      await waitFor(() => expect(screen.getByText('Dashboard ready')).toBeInTheDocument());
      expect(authMocks.getMe).toHaveBeenCalledOnce();
    },
  );

  it('hydrates a mobile/PWA reload on an app route', async () => {
    window.history.replaceState({}, '', '/app/dashboard');
    renderProtectedDashboard();

    await waitFor(() => expect(screen.getByText('Dashboard ready')).toBeInTheDocument());
    expect(authMocks.getMe).toHaveBeenCalledOnce();
  });

  it('recovers a missing profile on token refresh', async () => {
    window.history.replaceState({}, '', '/app/dashboard');
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    renderProtectedDashboard();

    await waitFor(() => expect(authMocks.listener).not.toBeNull());
    await act(async () => {
      authMocks.listener?.('TOKEN_REFRESHED', session);
    });

    await waitFor(() => expect(screen.getByText('Dashboard ready')).toBeInTheDocument());
    expect(authMocks.getMe).toHaveBeenCalledOnce();
  });

  it('deduplicates session, recovery-effect, and auth-event profile requests', async () => {
    window.history.replaceState({}, '', '/app/dashboard');
    let resolveProfile: (profile: typeof completedProfile) => void = () => undefined;
    authMocks.getMe.mockReturnValue(
      new Promise<typeof completedProfile>((resolve) => {
        resolveProfile = resolve;
      }),
    );

    renderProtectedDashboard();
    await waitFor(() => expect(authMocks.getMe).toHaveBeenCalledOnce());

    await act(async () => {
      authMocks.listener?.('SIGNED_IN', session);
      await Promise.resolve();
    });
    expect(authMocks.getMe).toHaveBeenCalledOnce();

    await act(async () => {
      resolveProfile(completedProfile);
    });
    await waitFor(() => expect(screen.getByText('Dashboard ready')).toBeInTheDocument());
    expect(authMocks.getMe).toHaveBeenCalledOnce();
  });
});
