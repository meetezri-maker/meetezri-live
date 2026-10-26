import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Paid onboarding ProfileSetup with a date of birth saved at signup (`profiles.age` =
 * "YYYY-MM-DD"). The DOB must be prefilled in the DOB picker, never read as a numeric age, never
 * replaced by a stale numeric age from local onboarding data, and carried through both the step
 * save and onboarding completion. Numeric / empty accounts keep the old number field.
 */

// Full-page renders with userEvent typing run a few seconds each.
vi.setConfig({ testTimeout: 20_000 });

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

let authState: Record<string, unknown>;
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => authState }));

const updateProfile = vi.fn();
const completeOnboardingApi = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    updateProfile: (...a: unknown[]) => updateProfile(...a),
    completeOnboarding: (...a: unknown[]) => completeOnboardingApi(...a),
  },
}));

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OnboardingProvider, useOnboarding } from '@/app/contexts/OnboardingContext';
import { OnboardingProfileSetup } from './ProfileSetup';

const STORAGE_KEY = 'ezri_onboarding_data';

function paidProfile(age: string | null) {
  return { signup_type: 'plan', subscription_plan: 'core', onboarding_completed: false, age };
}

function seedOnboardingData(data: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: 'u1', role: 'user', ...data }));
}

function CompleteHarness() {
  const { completeOnboarding } = useOnboarding();
  return <button onClick={() => void completeOnboarding('/app/dashboard')}>Finish onboarding</button>;
}

function renderProfileSetup(path = '/onboarding/profile-setup') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <OnboardingProvider>
        <Routes>
          <Route path="/onboarding/profile-setup" element={<OnboardingProfileSetup />} />
          <Route path="/onboarding/wellness-baseline" element={<CompleteHarness />} />
          <Route path="/onboarding/subscription" element={<CompleteHarness />} />
          <Route path="/app/user-profile" element={<div>Profile page</div>} />
          <Route path="/app/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </OnboardingProvider>
    </MemoryRouter>,
  );
}

async function fillNamesAndContinue(user: ReturnType<typeof userEvent.setup>) {
  const first = screen.getByPlaceholderText('John');
  const last = screen.getByPlaceholderText('Doe');
  await user.clear(first);
  await user.type(first, 'Jane');
  await user.clear(last);
  await user.type(last, 'Roe');
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('selectedPlan', 'core');
  localStorage.setItem('planPurchased', '1');
  updateProfile.mockResolvedValue({});
  completeOnboardingApi.mockResolvedValue({ onboarding_completed: true });
  authState = {
    user: { id: 'u1', user_metadata: {} },
    profile: paidProfile('1990-04-02'),
    updateProfileState: vi.fn(),
  };
});

describe('ProfileSetup with a saved DOB', () => {
  it('prefills the DOB picker and shows the calculated age', () => {
    renderProfileSetup();
    expect(screen.getByLabelText('Date of birth *')).toHaveValue('04/02/1990');
    expect(screen.queryByPlaceholderText('18')).not.toBeInTheDocument();
    expect(screen.getByText(/years old$/)).toBeInTheDocument();
  });

  it('saves the exact ISO DOB and keeps the next step unchanged', async () => {
    const user = userEvent.setup();
    renderProfileSetup();
    await fillNamesAndContinue(user);

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0][0].age).toBe('1990-04-02');
    await waitFor(() => expect(screen.getByText('Finish onboarding')).toBeInTheDocument());
  });

  it('carries the DOB through onboarding completion', async () => {
    const user = userEvent.setup();
    renderProfileSetup();
    await fillNamesAndContinue(user);
    await user.click(await screen.findByText('Finish onboarding'));

    await waitFor(() => expect(completeOnboardingApi).toHaveBeenCalled());
    expect(completeOnboardingApi.mock.calls[0][0].age).toBe('1990-04-02');
  });

  it('never lets a stale numeric onboarding age replace the saved DOB', async () => {
    seedOnboardingData({ age: '30' });
    const user = userEvent.setup();
    renderProfileSetup();

    expect(screen.getByLabelText('Date of birth *')).toHaveValue('04/02/1990');
    await fillNamesAndContinue(user);
    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0][0].age).toBe('1990-04-02');
  });

  it('saves an edited DOB', async () => {
    const user = userEvent.setup();
    renderProfileSetup();
    const dob = screen.getByLabelText('Date of birth *');
    await user.clear(dob);
    await user.type(dob, '12/31/1985');
    await fillNamesAndContinue(user);

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0][0].age).toBe('1985-12-31');
  });

  it('rejects an under-18 DOB instead of saving it', async () => {
    const user = userEvent.setup();
    renderProfileSetup();
    const dob = screen.getByLabelText('Date of birth *');
    await user.clear(dob);
    await user.type(dob, '01/01/2015');
    await fillNamesAndContinue(user);

    await new Promise((r) => setTimeout(r, 50));
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('fills the DOB when the profile loads after mount', async () => {
    authState = { ...authState, profile: null };
    const view = renderProfileSetup();
    expect(screen.queryByLabelText('Date of birth *')).not.toBeInTheDocument();

    authState = { ...authState, profile: paidProfile('1990-04-02') };
    view.rerender(
      <MemoryRouter initialEntries={['/onboarding/profile-setup']}>
        <OnboardingProvider>
          <Routes>
            <Route path="/onboarding/profile-setup" element={<OnboardingProfileSetup />} />
          </Routes>
        </OnboardingProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText('Date of birth *')).toHaveValue('04/02/1990'));
  });

  it('does not reset an in-progress edit when the profile loads late', async () => {
    authState = { ...authState, profile: null };
    const user = userEvent.setup();
    const view = renderProfileSetup();
    await user.type(screen.getByPlaceholderText('18'), '30');

    authState = { ...authState, profile: paidProfile('1990-04-02') };
    view.rerender(
      <MemoryRouter initialEntries={['/onboarding/profile-setup']}>
        <OnboardingProvider>
          <Routes>
            <Route path="/onboarding/profile-setup" element={<OnboardingProfileSetup />} />
          </Routes>
        </OnboardingProvider>
      </MemoryRouter>,
    );

    // The user's own entry is neither replaced nor hidden behind an empty picker.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByPlaceholderText('18')).toHaveValue(30);
    expect(screen.queryByLabelText('Date of birth *')).not.toBeInTheDocument();
  });

  it('prefills the DOB in resume mode', () => {
    renderProfileSetup('/onboarding/profile-setup?resume=1');
    expect(screen.getByLabelText('Date of birth *')).toHaveValue('04/02/1990');
  });
});

describe('ProfileSetup without a saved DOB keeps the numeric age field', () => {
  it.each([
    ['a legacy numeric age', '30'],
    ['no age (Google / older accounts)', null],
  ])('with %s', async (_label, age) => {
    authState = { ...authState, profile: paidProfile(age) };
    const user = userEvent.setup();
    renderProfileSetup();

    expect(screen.queryByLabelText('Date of birth *')).not.toBeInTheDocument();
    const ageInput = screen.getByPlaceholderText('18');
    await user.type(ageInput, '30');
    await fillNamesAndContinue(user);

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0][0].age).toBe('30');
  });

  it('still rejects an under-18 numeric age', async () => {
    authState = { ...authState, profile: paidProfile(null) };
    const user = userEvent.setup();
    renderProfileSetup();
    await user.type(screen.getByPlaceholderText('18'), '17');
    await fillNamesAndContinue(user);

    await new Promise((r) => setTimeout(r, 50));
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('onboarding completion', () => {
  function renderCompletion() {
    return render(
      <MemoryRouter initialEntries={['/onboarding/complete']}>
        <OnboardingProvider>
          <Routes>
            <Route path="/onboarding/complete" element={<CompleteHarness />} />
            <Route path="/app/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </OnboardingProvider>
      </MemoryRouter>,
    );
  }

  it('sends the saved DOB, not a stale numeric age from local data', async () => {
    seedOnboardingData({ age: '30' });
    const user = userEvent.setup();
    renderCompletion();
    await user.click(screen.getByText('Finish onboarding'));

    await waitFor(() => expect(completeOnboardingApi).toHaveBeenCalled());
    expect(completeOnboardingApi.mock.calls[0][0].age).toBe('1990-04-02');
  });

  it('keeps a numeric age for a numeric account', async () => {
    authState = { ...authState, profile: paidProfile('30') };
    seedOnboardingData({ age: '30' });
    const user = userEvent.setup();
    renderCompletion();
    await user.click(screen.getByText('Finish onboarding'));

    await waitFor(() => expect(completeOnboardingApi).toHaveBeenCalled());
    expect(completeOnboardingApi.mock.calls[0][0].age).toBe('30');
  });
});
