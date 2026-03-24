import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OnboardingProvider } from '@/app/contexts/OnboardingContext';
import { OnboardingEmergencyContact } from '@/app/pages/onboarding/EmergencyContact';

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', user_metadata: {} } as any,
    session: null,
    profile: null,
    isLoading: false,
    signOut: vi.fn(),
    hasRole: vi.fn(() => false),
    refreshProfile: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderEmergencyStep() {
  return render(
    <MemoryRouter initialEntries={['/onboarding/emergency-contact']}>
      <OnboardingProvider>
        <Routes>
          <Route path="/onboarding/emergency-contact" element={<OnboardingEmergencyContact />} />
          <Route path="/onboarding/permissions" element={<div>Permissions step</div>} />
        </Routes>
      </OnboardingProvider>
    </MemoryRouter>
  );
}

describe('OnboardingEmergencyContact', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks submit when only the contact name is filled', async () => {
    const user = userEvent.setup();
    renderEmergencyStep();

    await user.type(
      screen.getByPlaceholderText(/Mom, Best Friend, Partner/i),
      'Jane Doe'
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(
      await screen.findByText(/Phone is required when adding an emergency contact/i)
    ).toBeInTheDocument();
  });

  it('continues to the permissions step when optional fields are left empty', async () => {
    const user = userEvent.setup();
    renderEmergencyStep();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Permissions step')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
