import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const getMe = vi.fn();
const updateProfile = vi.fn();
const refreshProfile = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api", () => ({
  api: {
    getMe: (...a: unknown[]) => getMe(...a),
    updateProfile: (...a: unknown[]) => updateProfile(...a),
  },
}));

/**
 * Referentially stable: UserProfile reloads on `[user, ...]`, and the real AuthContext keeps
 * `user` in state. Returning a fresh object per render would re-fetch on every render forever.
 */
const authValue = {
  user: {
    id: "u1",
    email: "auth@example.com",
    email_confirmed_at: "2026-01-01",
    user_metadata: {},
  },
  session: null,
  profile: null,
  isLoading: false,
  signOut: vi.fn(),
  hasRole: vi.fn(() => false),
  refreshProfile,
};

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/contexts/SafetyContext", () => ({
  useSafetyConsent: () => ({ consent: { agreedToSafetyNotice: true } }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { resend: vi.fn() }, storage: { from: () => ({}) } },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/app/solace", () => ({
  SolaceHeroEnvironment: ({ children }: any) => <div>{children}</div>,
  SolaceSelect: ({ value, onValueChange, options, ariaLabel, disabled }: any) => (
    <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
  SolaceDateOfBirthPicker: ({ value, onChange, disabled }: any) => (
    <input aria-label="Date of birth" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("@/app/components/ui/phone-input", () => ({
  PhoneInput: ({ value, onChange, placeholder, disabled }: any) => (
    <input aria-label={placeholder} placeholder={placeholder} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("@/components/ui/FluentEmoji", () => ({ FluentEmoji: () => <span /> }));
vi.mock("react-easy-crop", () => ({ default: () => <div /> }));

import { UserProfile } from "../UserProfile";

// Full-page render plus a Radix dialog exceeds the 5s default under parallel suite load.
vi.setConfig({ testTimeout: 30000 });

const profile = {
  id: "u1",
  full_name: "Ada Lovelace",
  email: "profile-column@example.com",
  age: "1990-04-02",
  pronouns: "she/her",
  timezone: "Europe/London",
  phone: "+15551234567",
  in_therapy: "Yes",
  selected_goals: [],
  selected_triggers: [],
  emergency_contact_name: "Jamie Morgan",
  emergency_contact_relationship: "Sister",
  emergency_contact_phone: "+15559876543",
  emergency_consent: true,
  created_at: "2026-01-01T00:00:00Z",
  avatar_url: null,
  subscription_plan: "trial",
  signup_type: "trial",
  stats: { completed_sessions: 2, total_checkins: 3, streak_days: 4 },
};

async function renderProfile() {
  const utils = render(
    <MemoryRouter>
      <UserProfile />
    </MemoryRouter>
  );
  await screen.findByRole("button", { name: /edit profile/i });
  return utils;
}

describe("UserProfile — edit unification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMe.mockResolvedValue(profile);
    updateProfile.mockResolvedValue({ ...profile, full_name: "Grace Hopper" });
  });

  it("exposes exactly one Edit Profile button, in the hero", async () => {
    await renderProfile();

    const editButtons = screen.getAllByRole("button", { name: /edit profile/i });
    expect(editButtons).toHaveLength(1);
    expect(editButtons[0]).toHaveAttribute("id", "profile-edit-trigger");
  });

  it("removes the Update contact button", async () => {
    await renderProfile();
    expect(screen.queryByRole("button", { name: /update contact/i })).not.toBeInTheDocument();
  });

  it("renders a fully read-only sidebar", async () => {
    await renderProfile();

    // No editable control of any kind exists on the page until the modal opens.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
  });

  it("shows the stored values, including a read-only email", async () => {
    await renderProfile();

    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getByText("auth@example.com")).toBeInTheDocument();
    expect(screen.getByText("Jamie Morgan")).toBeInTheDocument();
    expect(screen.getByText("Sister")).toBeInTheDocument();
  });

  it("opens the modal from the hero button", async () => {
    const user = userEvent.setup({ delay: null });
    await renderProfile();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit profile/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByPlaceholderText("First name")).toHaveValue("Ada");
  });

  it("updates the read-only sidebar and refreshes AuthContext after a save", async () => {
    const user = userEvent.setup({ delay: null });
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    const dialog = await screen.findByRole("dialog");

    const firstName = within(dialog).getByPlaceholderText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Grace");
    const lastName = within(dialog).getByPlaceholderText("Last name");
    await user.clear(lastName);
    await user.type(lastName, "Hopper");

    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile.mock.calls[0][0]).toMatchObject({ full_name: "Grace Hopper" });
    expect(updateProfile.mock.calls[0][0]).not.toHaveProperty("email");

    // AuthContext is refreshed so nav/greeting stop showing the old name.
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
    // Modal closes and the sidebar behind it already shows the new value.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("Grace Hopper").length).toBeGreaterThan(0);
  });

  it("keeps the modal open and the sidebar untouched when the save fails", async () => {
    const user = userEvent.setup({ delay: null });
    updateProfile.mockRejectedValue(new Error("nope"));
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    const dialog = await screen.findByRole("dialog");
    const firstName = within(dialog).getByPlaceholderText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Grace");
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(refreshProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
  });

  it("still computes profile completion from stored data", async () => {
    await renderProfile();
    // Name, phone, birthday, timezone, pronouns, therapist, all three contact fields = 9/11.
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("opens the modal from the trial completion banner", async () => {
    const user = userEvent.setup({ delay: null });
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /complete now/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
