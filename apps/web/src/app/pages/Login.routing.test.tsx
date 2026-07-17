import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers only the post-login destination. Credential/MFA/2FA mechanics are mocked at
 * their boundaries so a routing regression cannot hide behind them. Uses a real router
 * and asserts the resulting location rather than spying on useNavigate.
 */

// The MFA step renders an OTP input that observes its own size; jsdom has no
// ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// PublicNav pulls useLocation from "react-router" while this file drives the router
// through "react-router-dom"; under vitest those resolve to separate module instances
// (and separate contexts). The nav is irrelevant to routing, so stub it out.
vi.mock('../components/PublicNav', () => ({ PublicNav: () => null }));

let authState: Record<string, unknown>;
const refreshProfile = vi.fn();
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }));

const getMe = vi.fn();
const getKnowledgeTwoFactorStatus = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    getMe: (...args: unknown[]) => getMe(...args),
    getKnowledgeTwoFactorStatus: (...args: unknown[]) => getKnowledgeTwoFactorStatus(...args),
    requestKnowledgeTwoFactorLoginCode: vi.fn(),
    clearMeCache: vi.fn(),
  },
}));

const signInWithPassword = vi.fn();
const listFactors = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
      resend: vi.fn(),
      mfa: {
        listFactors: (...a: unknown[]) => listFactors(...a),
        getAuthenticatorAssuranceLevel: (...a: unknown[]) => getAuthenticatorAssuranceLevel(...a),
        challenge: vi.fn(),
        verify: vi.fn(),
      },
    },
  },
}));

import { Login } from './Login';

const TRIAL = { signup_type: 'trial', subscription_plan: 'trial', onboarding_completed: false };
const LEGACY_TRIAL = { signup_type: null, subscription_plan: 'trial', onboarding_completed: false };
const PAID_INCOMPLETE = { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: false };
const PAID_COMPLETE = { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: true };

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('you@example.com'), 'someone@example.com');
  await user.type(screen.getByPlaceholderText('Enter your password'), 'correct-horse');
  await user.click(screen.getByRole('button', { name: /log in/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  authState = {
    user: null,
    profile: null,
    isLoading: false,
    refreshProfile,
  };
  signInWithPassword.mockResolvedValue({ error: null });
  listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  getKnowledgeTwoFactorStatus.mockResolvedValue({ enabled: false });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1', nextLevel: 'aal1' },
    error: null,
  });
});

describe('Login post-login destination', () => {
  it('sends a trial user to the dashboard', async () => {
    getMe.mockResolvedValue(TRIAL);
    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a legacy trial user (null signup_type) to the dashboard', async () => {
    getMe.mockResolvedValue(LEGACY_TRIAL);
    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a paid user with incomplete onboarding to onboarding', async () => {
    getMe.mockResolvedValue(PAID_INCOMPLETE);
    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('sends a paid user with completed onboarding to the dashboard', async () => {
    getMe.mockResolvedValue(PAID_COMPLETE);
    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('does not route to onboarding when the profile is temporarily unavailable', async () => {
    // getMe 404s, then /users/init (via refreshProfile) produces the real trial profile.
    getMe.mockRejectedValue(new Error('Profile not found'));
    refreshProfile.mockResolvedValue(TRIAL);
    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('does not strand the user when the profile never resolves', async () => {
    getMe.mockRejectedValue(new Error('Profile not found'));
    refreshProfile.mockResolvedValue(null);
    renderLogin();
    await submitCredentials();

    // Hands off to ProtectedRoute instead of guessing "paid" and forcing onboarding.
    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('waits for MFA instead of routing when a second factor is still required', async () => {
    listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null });
    getMe.mockResolvedValue(TRIAL);
    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(listFactors).toHaveBeenCalled());
    expect(currentPath()).toBe('/login');
    expect(getMe).not.toHaveBeenCalled();
  });
});

describe('Login does not carry a signup intent', () => {
  it('clears a stale OAuth signup intent when starting Google login', async () => {
    // An abandoned signup in this tab must not classify the account being logged into.
    sessionStorage.setItem('ezri_oauth_signup_intent', 'plan');
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => expect(sessionStorage.getItem('ezri_oauth_signup_intent')).toBeNull());
  });
});

describe('Login redirect for an already-authenticated visitor', () => {
  it('routes a trial user to the dashboard', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: TRIAL };
    renderLogin();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('routes a legacy trial user to the dashboard', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: LEGACY_TRIAL };
    renderLogin();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('routes an incomplete paid user to onboarding', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: PAID_INCOMPLETE };
    renderLogin();

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('does not navigate while the profile is still loading', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: null, isLoading: true };
    renderLogin();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(currentPath()).toBe('/login');
  });
});
