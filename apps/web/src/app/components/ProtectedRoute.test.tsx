import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const refreshProfile = vi.fn();
let authState: Record<string, unknown>;

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

function renderProtectedRoute(initialPath = '/app/settings') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <div>Member app</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/*"
          element={
            <ProtectedRoute>
              <div>Onboarding flow</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function completedProfile() {
  return {
    onboarding_completed: true,
    signup_type: 'plan',
    subscription_plan: 'core',
    email_verified: true,
    role: 'user',
  };
}

describe('ProtectedRoute onboarding restore', () => {
  beforeEach(() => {
    refreshProfile.mockReset();
    authState = {
      user: { id: 'mobile-user', email_confirmed_at: '2026-06-20T00:00:00Z' },
      profile: completedProfile(),
      profileStatus: 'ready',
      isLoading: false,
      hasRole: () => true,
      signOut: vi.fn(),
      refreshProfile,
    };
  });

  it('keeps a completed user in the app on mobile/PWA reload', () => {
    renderProtectedRoute();

    expect(screen.getByText('Member app')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
  });

  it('shows a safe restore state while the profile request is slow', () => {
    authState = { ...authState, profile: null, profileStatus: 'loading', isLoading: true };
    renderProtectedRoute();

    expect(screen.getByLabelText('Restoring profile')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
  });

  it('does not infer incomplete onboarding from a failed profile request', () => {
    authState = { ...authState, profile: null, profileStatus: 'error' };
    renderProtectedRoute();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refreshProfile).toHaveBeenCalledOnce();
    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
  });

  it('reaches the app after a profile retry succeeds', () => {
    authState = { ...authState, profile: null, profileStatus: 'loading' };
    const view = renderProtectedRoute();
    expect(screen.getByLabelText('Restoring profile')).toBeInTheDocument();

    authState = { ...authState, profile: completedProfile(), profileStatus: 'ready' };
    view.rerender(
      <MemoryRouter initialEntries={['/app/settings']}>
        <Routes>
          <Route
            path="/app/*"
            element={<ProtectedRoute><div>Member app</div></ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Member app')).toBeInTheDocument();
  });

  it('redirects only a confirmed incomplete paid user to onboarding', () => {
    authState = {
      ...authState,
      profile: { ...completedProfile(), onboarding_completed: false },
    };
    renderProtectedRoute();

    expect(screen.getByText('Onboarding flow')).toBeInTheDocument();
    expect(screen.queryByText('Member app')).not.toBeInTheDocument();
  });

  it('preserves the completed desktop route behavior', () => {
    renderProtectedRoute('/app/dashboard');
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });
});

describe('ProtectedRoute trial onboarding guard', () => {
  function trialProfile(overrides: Record<string, unknown> = {}) {
    return {
      onboarding_completed: false,
      signup_type: 'trial',
      subscription_plan: 'trial',
      email_verified: false,
      role: 'user',
      ...overrides,
    };
  }

  beforeEach(() => {
    authState = {
      user: { id: 'trial-user', email_confirmed_at: null },
      profile: trialProfile(),
      profileStatus: 'ready',
      isLoading: false,
      hasRole: () => true,
      signOut: vi.fn(),
      refreshProfile,
    };
  });

  it('keeps a trial user out of /onboarding/welcome', () => {
    renderProtectedRoute('/onboarding/welcome');

    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });

  it('keeps a trial user out of /onboarding/profile-setup', () => {
    renderProtectedRoute('/onboarding/profile-setup');

    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });

  it('keeps a legacy trial user (null signup_type) out of onboarding', () => {
    authState = {
      ...authState,
      profile: trialProfile({ signup_type: null }),
    };
    renderProtectedRoute('/onboarding/welcome');

    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });

  it('renders the dashboard normally for a trial user', () => {
    renderProtectedRoute('/app/dashboard');
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });

  it('renders other app routes normally for a trial user', () => {
    renderProtectedRoute('/app/session-lobby');
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });
});

describe('ProtectedRoute paid onboarding behavior is unchanged', () => {
  function paidProfile(overrides: Record<string, unknown> = {}) {
    return {
      onboarding_completed: false,
      signup_type: 'plan',
      subscription_plan: 'core',
      email_verified: true,
      role: 'user',
      ...overrides,
    };
  }

  beforeEach(() => {
    authState = {
      user: { id: 'paid-user', email_confirmed_at: '2026-06-20T00:00:00Z' },
      profile: paidProfile(),
      profileStatus: 'ready',
      isLoading: false,
      hasRole: () => true,
      signOut: vi.fn(),
      refreshProfile,
    };
  });

  it('still redirects an incomplete paid user from the app into onboarding', () => {
    renderProtectedRoute('/app/dashboard');

    expect(screen.getByText('Onboarding flow')).toBeInTheDocument();
    expect(screen.queryByText('Member app')).not.toBeInTheDocument();
  });

  it('lets an incomplete paid user render onboarding', () => {
    renderProtectedRoute('/onboarding/welcome');
    expect(screen.getByText('Onboarding flow')).toBeInTheDocument();
  });

  it('still sends a completed paid user out of onboarding to the dashboard', () => {
    authState = {
      ...authState,
      profile: paidProfile({ onboarding_completed: true }),
    };
    renderProtectedRoute('/onboarding/welcome');

    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
    expect(screen.getByText('Member app')).toBeInTheDocument();
  });

  it('still blocks unverified paid onboarding behind email verification', () => {
    authState = {
      ...authState,
      user: { id: 'paid-user', email_confirmed_at: null },
      profile: paidProfile({ email_verified: false }),
    };
    renderProtectedRoute('/onboarding/welcome');

    expect(screen.queryByText('Onboarding flow')).not.toBeInTheDocument();
  });
});
