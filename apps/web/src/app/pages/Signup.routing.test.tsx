import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers the /signup destination decisions only: the already-authenticated redirect and
 * the end of the trial wizard. Account creation, Stripe, and verification are mocked at
 * their boundaries; the regression block below asserts they still route as they did.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// PublicNav reads useLocation from "react-router" while this file drives the router via
// "react-router-dom"; under vitest those are separate module instances/contexts.
vi.mock('../components/PublicNav', () => ({ PublicNav: () => null }));

let authState: Record<string, unknown>;
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }));

const checkUserExists = vi.fn();
const apiSignup = vi.fn();
const initProfile = vi.fn();
const updateProfile = vi.fn();
const createSubscription = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    checkUserExists: (...a: unknown[]) => checkUserExists(...a),
    signup: (...a: unknown[]) => apiSignup(...a),
    initProfile: (...a: unknown[]) => initProfile(...a),
    updateProfile: (...a: unknown[]) => updateProfile(...a),
    billing: { createSubscription: (...a: unknown[]) => createSubscription(...a) },
  },
}));

const signUp = vi.fn();
const getSession = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...a: unknown[]) => signUp(...a),
      getSession: (...a: unknown[]) => getSession(...a),
      signInWithPassword: vi.fn(),
      signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a),
      signOut: vi.fn().mockResolvedValue({}),
      resend: vi.fn(),
    },
  },
}));

const storePendingVerification = vi.fn();
vi.mock('@/lib/pendingVerification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pendingVerification')>(
    '@/lib/pendingVerification',
  );
  return { ...actual, storePendingVerification: (...a: unknown[]) => storePendingVerification(...a) };
});

import { Signup } from './Signup';

const TRIAL = { signup_type: 'trial', subscription_plan: 'trial', onboarding_completed: false };
const LEGACY_TRIAL = { signup_type: null, subscription_plan: 'trial', onboarding_completed: false };
const PAID_INCOMPLETE = { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: false };
const PAID_COMPLETE = { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: true };

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <LocationProbe />
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const currentPath = () => screen.getByTestId('location').textContent;

async function fillAndSubmitSignupForm() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('John'), 'Jane');
  await user.type(screen.getByPlaceholderText('Doe'), 'Roe');
  await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
  await user.type(screen.getByPlaceholderText('18'), '30');
  await user.type(screen.getByPlaceholderText('At least 8 characters'), 'supersecret1');
  await user.type(screen.getByPlaceholderText('Re-enter your password'), 'supersecret1');
  await user.click(screen.getByRole('button', { name: /create account/i }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  authState = { user: null, profile: null, isLoading: false };
  checkUserExists.mockResolvedValue({ exists: false });
  signUp.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
  getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
  initProfile.mockResolvedValue({});
  updateProfile.mockResolvedValue({});
  createSubscription.mockResolvedValue({});
  apiSignup.mockResolvedValue({ action: 'verification_sent' });
});

describe('Signup redirect for an already-authenticated visitor', () => {
  it('sends a trial user to the dashboard', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: TRIAL };
    renderSignup();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a legacy trial user (null signup_type) to the dashboard', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: LEGACY_TRIAL };
    renderSignup();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a paid user with incomplete onboarding to onboarding', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: PAID_INCOMPLETE };
    renderSignup();

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('sends a paid user with completed onboarding to the dashboard', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: PAID_COMPLETE };
    renderSignup();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('does not default an unresolved profile to onboarding', async () => {
    authState = { ...authState, user: { id: 'u1' }, profile: { onboarding_completed: false } };
    renderSignup();

    await new Promise((r) => setTimeout(r, 50));
    expect(currentPath()).toBe('/signup');
  });

  it('does not redirect an unauthenticated visitor', async () => {
    renderSignup();

    await new Promise((r) => setTimeout(r, 50));
    expect(currentPath()).toBe('/signup');
  });
});

describe('Signup trial flow', () => {
  it('does not redirect away while the trial details step is still open', async () => {
    renderSignup();
    await fillAndSubmitSignupForm();

    // Account now exists, so AuthContext reports an authenticated trial user while the
    // user is still mid-wizard. The effect must not pull them out of it.
    await waitFor(() => expect(screen.getByPlaceholderText('e.g., Jane Doe')).toBeInTheDocument());
    authState = { ...authState, user: { id: 'new-user' }, profile: TRIAL };

    await new Promise((r) => setTimeout(r, 50));
    expect(currentPath()).toBe('/signup');
    expect(screen.getByPlaceholderText('e.g., Jane Doe')).toBeInTheDocument();
  });

  it('sends a completed trial signup to the dashboard', async () => {
    renderSignup();
    const user = await fillAndSubmitSignupForm();

    await waitFor(() => expect(screen.getByPlaceholderText('e.g., Jane Doe')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('e.g., Jane Doe'), 'Jane Roe');
    await user.type(screen.getByPlaceholderText('Phone number'), '+14155552671');
    await user.type(screen.getByPlaceholderText('e.g., Sister'), 'Sister');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /start your first talk/i }));

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
    expect(currentPath()).not.toBe('/onboarding/welcome');
  });

  it('still requests email verification during trial signup', async () => {
    renderSignup();
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const options = signUp.mock.calls[0][0].options;
    expect(options.data.signup_type).toBe('trial');
    expect(options.data.email_verification_required).toBe(true);
    expect(options.emailRedirectTo).toContain('/app/user-profile');
  });

  it('still creates the trial subscription', async () => {
    renderSignup();
    const user = await fillAndSubmitSignupForm();

    await waitFor(() => expect(screen.getByPlaceholderText('e.g., Jane Doe')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('e.g., Jane Doe'), 'Jane Roe');
    await user.type(screen.getByPlaceholderText('Phone number'), '+14155552671');
    await user.type(screen.getByPlaceholderText('e.g., Sister'), 'Sister');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /start your first talk/i }));

    await waitFor(() =>
      expect(createSubscription).toHaveBeenCalledWith({
        plan_type: 'trial',
        billing_cycle: 'monthly',
      }),
    );
    expect(initProfile).toHaveBeenCalled();
  });
});

describe('Signup paid flow is unchanged', () => {
  beforeEach(() => {
    window.localStorage.setItem('selectedPlan', 'core');
    window.localStorage.setItem('planPurchased', '1');
  });

  it('sends a new paid signup to email verification', async () => {
    renderSignup();
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(currentPath()).toBe('/verify-email'));
    expect(apiSignup).toHaveBeenCalled();
    expect(storePendingVerification).toHaveBeenCalledWith('jane@example.com', 'plan');
    // The trial path must not have been taken.
    expect(signUp).not.toHaveBeenCalled();
  });

  it('forwards a Stripe session id to the paid signup call', async () => {
    window.localStorage.setItem('stripeSessionId', 'cs_test_123');
    renderSignup();
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(apiSignup).toHaveBeenCalled());
    expect(apiSignup.mock.calls[0][0].stripe_session_id).toBe('cs_test_123');
  });

  it('sends a paid user with an incomplete account back to login', async () => {
    apiSignup.mockResolvedValue({ action: 'continue_onboarding' });
    renderSignup();
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(currentPath()).toBe('/login'));
  });
});

describe('Signup regression guards', () => {
  it('sends an existing fully-onboarded account to login', async () => {
    checkUserExists.mockResolvedValue({ exists: true, state: 'FULLY_ONBOARDED' });
    renderSignup();
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends an existing unverified trial account to verification', async () => {
    checkUserExists.mockResolvedValue({ exists: true, state: 'EMAIL_UNVERIFIED' });
    renderSignup();
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(currentPath()).toBe('/verify-email'));
    expect(storePendingVerification).toHaveBeenCalledWith('jane@example.com', 'trial');
  });

  it('does not submit an invalid form', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await new Promise((r) => setTimeout(r, 50));
    expect(checkUserExists).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/signup');
  });

  it('keeps the Google OAuth initiation intact', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(signInWithOAuth.mock.calls[0][0].provider).toBe('google');
  });
});
