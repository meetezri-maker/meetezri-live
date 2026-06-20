import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const refreshProfile = vi.fn();
let authState: Record<string, unknown>;

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

function completedProfile() {
  return {
    onboarding_completed: true,
    signup_type: 'plan',
    subscription_plan: 'core',
    email_verified: true,
    role: 'user',
  };
}

function DashboardActions() {
  return (
    <div>
      <div>Dashboard</div>
      <Link to="/app/journal">Open journal</Link>
    </div>
  );
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <Routes>
        <Route
          path="/app/dashboard"
          element={<ProtectedRoute><DashboardActions /></ProtectedRoute>}
        />
        <Route
          path="/app/journal"
          element={<ProtectedRoute><div>Journal page</div></ProtectedRoute>}
        />
        <Route
          path="/onboarding/*"
          element={<ProtectedRoute><div>Onboarding flow</div></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('dashboard onboarding restore race', () => {
  beforeEach(() => {
    refreshProfile.mockReset();
    authState = {
      user: { id: 'completed-user', email_confirmed_at: '2026-06-20T00:00:00Z' },
      profile: completedProfile(),
      profileStatus: 'ready',
      isLoading: false,
      hasRole: () => true,
      signOut: vi.fn(),
      refreshProfile,
    };
  });

  it.each(['idle', 'loading'])(
    'does not expose dashboard actions while profile status is %s',
    (profileStatus) => {
      authState = { ...authState, profileStatus, isLoading: profileStatus === 'loading' };
      renderApp();

      expect(screen.getByLabelText('Restoring profile')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open journal' })).not.toBeInTheDocument();
      expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
    },
  );

  it('routes an immediate action to the intended page once profile is confirmed', () => {
    authState = { ...authState, profileStatus: 'loading', isLoading: true };
    const view = renderApp();
    expect(screen.queryByRole('link', { name: 'Open journal' })).not.toBeInTheDocument();

    authState = { ...authState, profileStatus: 'ready', isLoading: false };
    view.rerender(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Routes>
          <Route
            path="/app/dashboard"
            element={<ProtectedRoute><DashboardActions /></ProtectedRoute>}
          />
          <Route
            path="/app/journal"
            element={<ProtectedRoute><div>Journal page</div></ProtectedRoute>}
          />
          <Route
            path="/onboarding/*"
            element={<ProtectedRoute><div>Onboarding flow</div></ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Open journal' }));
    expect(screen.getByText('Journal page')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
  });

  it('redirects a confirmed incomplete user to onboarding', () => {
    authState = {
      ...authState,
      profile: { ...completedProfile(), onboarding_completed: false },
    };
    renderApp();

    expect(screen.getByText('Onboarding flow')).toBeInTheDocument();
  });

  it('shows a safe retry state after profile restore fails', () => {
    authState = { ...authState, profile: null, profileStatus: 'error' };
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refreshProfile).toHaveBeenCalledOnce();
    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
  });
});
