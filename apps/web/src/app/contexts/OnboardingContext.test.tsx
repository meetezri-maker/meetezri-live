import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';

const completeOnboardingApi = vi.fn();
const updateProfileState = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    completeOnboarding: (...args: unknown[]) => completeOnboardingApi(...args),
  },
}));

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { signup_type: 'plan', subscription_plan: 'core' },
    updateProfileState,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function CompletionHarness() {
  const { completeOnboarding } = useOnboarding();
  return <button onClick={() => void completeOnboarding()}>Complete</button>;
}

function DashboardHarness() {
  return <div>{updateProfileState.mock.calls.length ? 'Dashboard ready' : 'Profile missing'}</div>;
}

describe('OnboardingProvider completion', () => {
  beforeEach(() => {
    localStorage.clear();
    completeOnboardingApi.mockReset();
    updateProfileState.mockReset();
  });

  it('updates auth profile state before routing to the app', async () => {
    const updatedProfile = { onboarding_completed: true, signup_type: 'plan' };
    completeOnboardingApi.mockResolvedValue(updatedProfile);

    render(
      <MemoryRouter initialEntries={['/onboarding/complete']}>
        <OnboardingProvider>
          <Routes>
            <Route path="/onboarding/complete" element={<CompletionHarness />} />
            <Route
              path="/app/dashboard"
              element={<DashboardHarness />}
            />
          </Routes>
        </OnboardingProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

    await waitFor(() => expect(screen.getByText('Dashboard ready')).toBeInTheDocument());
    expect(updateProfileState).toHaveBeenCalledWith(updatedProfile);
  });
});
