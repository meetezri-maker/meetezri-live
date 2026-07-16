import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AuthCallback destination tests. These drive a real router and assert the resulting
 * location, so they verify navigation rather than that a helper was called.
 *
 * Note: AuthCallback keeps module-level PKCE/finalize dedupe sets that persist for the
 * lifetime of the module, so every test uses a unique code/user id.
 */

let authState: Record<string, unknown>;
const refreshProfile = vi.fn();
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }));

const getMe = vi.fn();
const confirmEmail = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    getMe: (...a: unknown[]) => getMe(...a),
    confirmEmail: (...a: unknown[]) => confirmEmail(...a),
  },
}));

const exchangeCodeForSession = vi.fn();
const setSession = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
      setSession: (...a: unknown[]) => setSession(...a),
      getSession: (...a: unknown[]) => getSession(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import { AuthCallback } from './AuthCallback';

const TRIAL = { signup_type: 'trial', subscription_plan: 'trial', onboarding_completed: false };
const LEGACY_TRIAL = { signup_type: null, subscription_plan: 'trial', onboarding_completed: false };
const PAID_INCOMPLETE = { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: false };
const PAID_COMPLETE = { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: true };

let codeCounter = 0;
const uniqueCode = () => `code-${Date.now()}-${codeCounter++}`;

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

/**
 * finalizeVerification reads via/flow from window.location while the router supplies
 * `code`, so both have to describe the same URL.
 */
function renderCallback(search: string) {
  window.history.replaceState({}, '', `/auth/callback${search}`);
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <LocationProbe />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const currentPath = () => screen.getByTestId('location').textContent;

function sessionFor(user: Record<string, unknown> = {}) {
  return { session: { user: { id: `u-${codeCounter}`, user_metadata: {}, ...user } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  authState = { user: null, profile: null, profileStatus: 'idle', isLoading: false, refreshProfile };
  exchangeCodeForSession.mockResolvedValue({ data: sessionFor(), error: null });
  getSession.mockResolvedValue({ data: sessionFor() });
  setSession.mockResolvedValue({ data: sessionFor(), error: null });
  updateUser.mockResolvedValue({ data: {}, error: null });
  confirmEmail.mockResolvedValue({});
  refreshProfile.mockResolvedValue(null);
});

describe('AuthCallback — Google OAuth callback', () => {
  it('sends a trial OAuth user to the dashboard', async () => {
    getMe.mockResolvedValue(TRIAL);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a legacy trial OAuth user (null signup_type) to the dashboard', async () => {
    getMe.mockResolvedValue(LEGACY_TRIAL);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a paid OAuth user with incomplete onboarding to onboarding', async () => {
    getMe.mockResolvedValue(PAID_INCOMPLETE);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('sends a paid OAuth user with completed onboarding to the dashboard', async () => {
    getMe.mockResolvedValue(PAID_COMPLETE);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('exchanges the authorization code exactly once', async () => {
    getMe.mockResolvedValue(TRIAL);
    const code = uniqueCode();
    renderCallback(`?code=${code}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith(code);
  });

  it('does not route a brand-new trial OAuth user to onboarding via the age heuristic', async () => {
    // Account created seconds ago: the old code sent this user to onboarding.
    exchangeCodeForSession.mockResolvedValue({
      data: sessionFor({ created_at: new Date().toISOString() }),
      error: null,
    });
    getMe.mockResolvedValue(TRIAL);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });
});

describe('AuthCallback — email verification callback', () => {
  it('sends a trial verification callback to the dashboard, not /app/user-profile', async () => {
    getMe.mockResolvedValue(TRIAL);
    renderCallback(`?code=${uniqueCode()}&via=verification&flow=trial`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a legacy trial verification callback to the dashboard', async () => {
    getMe.mockResolvedValue(LEGACY_TRIAL);
    renderCallback(`?code=${uniqueCode()}&via=verification`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a paid incomplete verification callback to onboarding', async () => {
    getMe.mockResolvedValue(PAID_INCOMPLETE);
    renderCallback(`?code=${uniqueCode()}&via=verification&flow=plan`);

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('sends a paid complete verification callback to the dashboard', async () => {
    getMe.mockResolvedValue(PAID_COMPLETE);
    renderCallback(`?code=${uniqueCode()}&via=verification&flow=plan`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('still confirms the email server-side and refreshes the profile', async () => {
    getMe.mockResolvedValue(TRIAL);
    renderCallback(`?code=${uniqueCode()}&via=verification&flow=trial`);

    await waitFor(() => expect(confirmEmail).toHaveBeenCalledTimes(1));
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('still clears the trial verification metadata flag', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: sessionFor({
        user_metadata: { email_verification_required: true, signup_type: 'trial' },
      }),
      error: null,
    });
    getMe.mockResolvedValue(TRIAL);
    renderCallback(`?code=${uniqueCode()}&via=verification&flow=trial`);

    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(updateUser).toHaveBeenCalledWith({ data: { email_verification_required: false } });
    expect(toastSuccess).toHaveBeenCalledWith('Email verified successfully!');
    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('still creates a session from implicit-flow tokens', async () => {
    getMe.mockResolvedValue(TRIAL);
    window.history.replaceState({}, '', '/auth/callback');
    render(
      <MemoryRouter
        initialEntries={[
          `/auth/callback#access_token=tok-${uniqueCode()}&refresh_token=ref-1`,
        ]}
      >
        <LocationProbe />
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(setSession).toHaveBeenCalled());
    expect(setSession.mock.calls[0][0].refresh_token).toBe('ref-1');
    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });
});

describe('AuthCallback — profile recovery', () => {
  it('recovers via refreshProfile when getMe fails, then routes on the recovered profile', async () => {
    getMe.mockRejectedValue(new Error('Network error'));
    refreshProfile.mockResolvedValue(TRIAL);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('routes a paid incomplete user correctly after profile init recovery', async () => {
    getMe.mockRejectedValue(new Error('Profile not found'));
    refreshProfile.mockResolvedValue(PAID_INCOMPLETE);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('does not default to onboarding when the profile never resolves', async () => {
    getMe.mockRejectedValue(new Error('Network error'));
    refreshProfile.mockResolvedValue(null);
    renderCallback(`?code=${uniqueCode()}`);

    // Degraded mode: ProtectedRoute becomes the authority.
    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('does not default to onboarding when the profile is unclassifiable', async () => {
    getMe.mockResolvedValue({ onboarding_completed: false });
    refreshProfile.mockResolvedValue({ onboarding_completed: false });
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('does not start an unbounded retry loop', async () => {
    getMe.mockRejectedValue(new Error('Network error'));
    refreshProfile.mockResolvedValue(null);
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });
});

describe('AuthCallback — already-authenticated visitor (no code or tokens)', () => {
  it('routes a trial user to the dashboard', async () => {
    authState = {
      ...authState,
      user: { id: 'u1', user_metadata: {} },
      profile: TRIAL,
      profileStatus: 'ready',
    };
    renderCallback('');

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('routes a paid incomplete user to onboarding', async () => {
    authState = {
      ...authState,
      user: { id: 'u1', user_metadata: {} },
      profile: PAID_INCOMPLETE,
      profileStatus: 'ready',
    };
    renderCallback('');

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('waits for the profile instead of guessing from session age', async () => {
    authState = {
      ...authState,
      user: { id: 'u1', created_at: new Date().toISOString(), user_metadata: {} },
      profile: null,
      profileStatus: 'loading',
    };
    renderCallback('');

    await new Promise((r) => setTimeout(r, 50));
    expect(currentPath()).toBe('/auth/callback');
  });

  it('falls back to the dashboard when the profile load has errored', async () => {
    authState = {
      ...authState,
      user: { id: 'u1', user_metadata: {} },
      profile: null,
      profileStatus: 'error',
    };
    renderCallback('');

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('honours an explicit safe redirect', async () => {
    authState = {
      ...authState,
      user: { id: 'u1', user_metadata: {} },
      profile: TRIAL,
      profileStatus: 'ready',
    };
    renderCallback('?redirect=%2Fapp%2Fbilling');

    await waitFor(() => expect(currentPath()).toBe('/app/billing'));
  });

  it('ignores an unsafe redirect that would loop back into auth', async () => {
    authState = {
      ...authState,
      user: { id: 'u1', user_metadata: {} },
      profile: TRIAL,
      profileStatus: 'ready',
    };
    renderCallback('?redirect=%2Flogin');

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });
});

describe('AuthCallback — error handling is unchanged', () => {
  it('shows the error UI for a provider error in the query string', async () => {
    renderCallback('?error=access_denied&error_description=User%20denied%20access');

    await waitFor(() => expect(screen.getByText('Verification Failed')).toBeInTheDocument());
    expect(screen.getByText('User denied access')).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith('User denied access');
    expect(currentPath()).toBe('/auth/callback');
  });

  it('shows the error UI when the code exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: new Error('Invalid or expired code'),
    });
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(screen.getByText('Verification Failed')).toBeInTheDocument());
    expect(screen.getByText('Invalid or expired code')).toBeInTheDocument();
    expect(currentPath()).toBe('/auth/callback');
  });

  it('offers the login recovery action on error', async () => {
    renderCallback('?error=access_denied&error_description=Denied');
    await waitFor(() => expect(screen.getByText('Verification Failed')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: /go to login/i }));
    await waitFor(() => expect(currentPath()).toBe('/login'));
  });

  it('never sends an errored callback to onboarding', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: null, error: new Error('boom') });
    renderCallback(`?code=${uniqueCode()}`);

    await waitFor(() => expect(screen.getByText('Verification Failed')).toBeInTheDocument());
    expect(currentPath()).not.toBe('/onboarding/welcome');
  });
});
