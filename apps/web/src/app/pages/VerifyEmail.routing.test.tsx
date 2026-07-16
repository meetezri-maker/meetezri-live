import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers only the post-verification destination. Verification state, resend, and
 * token handling are untouched by Phase 2 and are exercised only far enough to reach
 * the routing decision.
 */

let authState: Record<string, unknown>;
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }));

vi.mock('@/lib/api', () => ({
  api: {
    resendVerificationEmail: vi.fn(),
    resendVerificationEmailPublic: vi.fn(),
  },
}));

vi.mock('@/lib/pendingVerification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pendingVerification')>(
    '@/lib/pendingVerification',
  );
  return { ...actual, getPendingVerificationEmail: () => 'someone@example.com' };
});

import { VerifyEmail } from './VerifyEmail';

const VERIFIED_USER = { id: 'u1', email: 'someone@example.com', email_confirmed_at: '2026-07-01T00:00:00Z' };

const VERIFIED_TRIAL = {
  signup_type: 'trial',
  subscription_plan: 'trial',
  onboarding_completed: false,
  email_verified: true,
  needs_email_verification: false,
};
const VERIFIED_LEGACY_TRIAL = { ...VERIFIED_TRIAL, signup_type: null };
const VERIFIED_PAID_INCOMPLETE = {
  signup_type: 'plan',
  subscription_plan: 'core',
  onboarding_completed: false,
  email_verified: true,
};
const VERIFIED_PAID_COMPLETE = { ...VERIFIED_PAID_INCOMPLETE, onboarding_completed: true };

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderVerifyEmail() {
  return render(
    <MemoryRouter initialEntries={['/verify-email']}>
      <LocationProbe />
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: VERIFIED_USER, profile: null };
});

describe('VerifyEmail post-verification destination', () => {
  it('sends a verified trial user to the dashboard', async () => {
    authState = { ...authState, profile: VERIFIED_TRIAL };
    renderVerifyEmail();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a verified legacy trial user (null signup_type) to the dashboard', async () => {
    authState = { ...authState, profile: VERIFIED_LEGACY_TRIAL };
    renderVerifyEmail();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('sends a verified paid user with incomplete onboarding to onboarding', async () => {
    authState = { ...authState, profile: VERIFIED_PAID_INCOMPLETE };
    renderVerifyEmail();

    await waitFor(() => expect(currentPath()).toBe('/onboarding/welcome'));
  });

  it('sends a verified paid user with completed onboarding to the dashboard', async () => {
    authState = { ...authState, profile: VERIFIED_PAID_COMPLETE };
    renderVerifyEmail();

    await waitFor(() => expect(currentPath()).toBe('/app/dashboard'));
  });

  it('does not default an unresolved profile to onboarding', async () => {
    // Session says verified, but the profile carries no account-type evidence.
    authState = { ...authState, profile: { email_verified: true } };
    renderVerifyEmail();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(currentPath()).toBe('/verify-email');
  });

  it('does not route while the profile has not loaded', async () => {
    authState = { ...authState, profile: null };
    renderVerifyEmail();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(currentPath()).toBe('/verify-email');
  });

  it('keeps an unverified user on the verification screen', async () => {
    authState = {
      user: { id: 'u1', email: 'someone@example.com', email_confirmed_at: null },
      profile: { ...VERIFIED_TRIAL, email_verified: false, needs_email_verification: true },
    };
    renderVerifyEmail();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(currentPath()).toBe('/verify-email');
  });
});
