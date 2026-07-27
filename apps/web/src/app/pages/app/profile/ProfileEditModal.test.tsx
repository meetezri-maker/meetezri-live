import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateProfile = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    updateProfile: (...args: unknown[]) => updateProfile(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** The Solace primitives pull in heavy visual deps; stub them down to plain controls. */
vi.mock("@/app/solace", () => ({
  SolaceSelect: ({ value, onValueChange, options, ariaLabel, disabled }: any) => (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  SolaceDateOfBirthPicker: ({ value, onChange, disabled }: any) => (
    <input
      aria-label="Date of birth"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/app/components/ui/phone-input", () => ({
  PhoneInput: ({ value, onChange, placeholder, disabled }: any) => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/FluentEmoji", () => ({
  FluentEmoji: () => <span />,
}));

import { ProfileEditModal } from "./ProfileEditModal";

// Radix dialog + RHF render work is slow enough to exceed the 5s default when the whole
// web suite runs in parallel. The assertions are unchanged; only the budget is.
vi.setConfig({ testTimeout: 30000 });

const profile = {
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
};

function renderModal(overrides: Partial<React.ComponentProps<typeof ProfileEditModal>> = {}) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <ProfileEditModal
      open
      profile={profile}
      authEmail="auth@example.com"
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      {...overrides}
    />
  );
  return { onOpenChange, onSaved, ...utils };
}

const saveButton = () => screen.getByRole("button", { name: /save changes/i });

describe("ProfileEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfile.mockResolvedValue({ ...profile, full_name: "Grace Hopper" });
  });

  it("loads existing values into all three sections", () => {
    renderModal();

    expect(screen.getByPlaceholderText("First name")).toHaveValue("Ada");
    expect(screen.getByPlaceholderText("Last name")).toHaveValue("Lovelace");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1990-04-02");
    expect(screen.getByPlaceholderText("Contact name")).toHaveValue("Jamie Morgan");
    expect(screen.getByPlaceholderText("e.g. Parent")).toHaveValue("Sister");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("renders email read-only, disabled, and sourced from auth", () => {
    renderModal();

    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("auth@example.com");
    expect(email).toBeDisabled();
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByText(/cannot be changed here/i)).toBeInTheDocument();
  });

  it("omits email from the payload and includes emergency_consent", async () => {
    const user = userEvent.setup({ delay: null });
    renderModal();

    await user.clear(screen.getByPlaceholderText("Contact name"));
    await user.type(screen.getByPlaceholderText("Contact name"), "Robin Fields");
    await user.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const payload = updateProfile.mock.calls[0][0];
    expect(payload).not.toHaveProperty("email");
    expect(payload.emergency_consent).toBe(true);
    expect(payload.emergency_contact_name).toBe("Robin Fields");
  });

  it("refreshes the parent and closes only after a successful save", async () => {
    const user = userEvent.setup({ delay: null });
    const { onOpenChange, onSaved } = renderModal();

    await user.type(screen.getByPlaceholderText("First name"), "x");
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // The parent refresh runs before the modal is told to close.
    expect(onSaved.mock.invocationCallOrder[0]).toBeLessThan(
      onOpenChange.mock.invocationCallOrder[onOpenChange.mock.calls.length - 1]
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the modal open and preserves input when the save fails", async () => {
    const user = userEvent.setup({ delay: null });
    updateProfile.mockRejectedValue(new Error("Server exploded"));
    const { onOpenChange, onSaved } = renderModal();

    await user.clear(screen.getByPlaceholderText("First name"));
    await user.type(screen.getByPlaceholderText("First name"), "Grace");
    await user.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByPlaceholderText("First name")).toHaveValue("Grace");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("prevents duplicate submissions while a save is in flight", async () => {
    const user = userEvent.setup({ delay: null });
    let resolveSave: (v: unknown) => void = () => {};
    updateProfile.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; })
    );
    renderModal();

    await user.type(screen.getByPlaceholderText("First name"), "x");
    const button = saveButton();
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    await user.click(button);

    expect(updateProfile).toHaveBeenCalledTimes(1);
    resolveSave(profile);
  });

  it("closes without confirmation when nothing is dirty", async () => {
    const user = userEvent.setup({ delay: null });
    const { onOpenChange } = renderModal();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText(/discard changes\?/i)).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks for confirmation when closing a dirty form", async () => {
    const user = userEvent.setup({ delay: null });
    const { onOpenChange } = renderModal();

    await user.type(screen.getByPlaceholderText("First name"), "x");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(await screen.findByText(/discard changes\?/i)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("discards changes and closes when discard is confirmed", async () => {
    const user = userEvent.setup({ delay: null });
    const { onOpenChange } = renderModal();

    await user.type(screen.getByPlaceholderText("First name"), "xyz");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    const discardDialog = await screen.findByRole("alertdialog");
    await user.click(within(discardDialog).getByRole("button", { name: /discard/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("returns to editing when the discard prompt is dismissed", async () => {
    const user = userEvent.setup({ delay: null });
    const { onOpenChange } = renderModal();

    await user.type(screen.getByPlaceholderText("First name"), "xyz");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    const discardDialog = await screen.findByRole("alertdialog");
    await user.click(within(discardDialog).getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByPlaceholderText("First name")).toHaveValue("Adaxyz");
  });

  it("renders a validation error instead of calling the API", async () => {
    const user = userEvent.setup({ delay: null });
    renderModal();

    await user.clear(screen.getByPlaceholderText("First name"));
    await user.clear(screen.getByPlaceholderText("Last name"));
    await user.click(saveButton());

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("blocks saving emergency data when consent is unchecked", async () => {
    const user = userEvent.setup({ delay: null });
    renderModal();

    await user.click(screen.getByRole("checkbox"));
    await user.click(saveButton());

    expect(await screen.findByText(/confirm emergency contact consent/i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("keeps the body scrollable with the actions outside the scroll area", () => {
    const { container } = renderModal();
    const scrollArea = container.ownerDocument.querySelector(".overflow-y-auto");
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.contains(saveButton())).toBe(false);
  });
});
