import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behaviour of the single Founding Circle signup form: validation, loading,
 * success, the reassuring duplicate response, API failure, double-submit
 * protection, and UTM pass-through.
 */

const joinFoundingCircle = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    joinFoundingCircle: (...args: unknown[]) => joinFoundingCircle(...args),
  },
}));

import { FoundingMemberForm } from "./FoundingMemberForm";
import { FOUNDING_FORM } from "./prelaunch.content";

function renderForm() {
  return render(
    <MemoryRouter>
      <FoundingMemberForm origin="test" />
    </MemoryRouter>,
  );
}

describe("FoundingMemberForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/early-access");
    joinFoundingCircle.mockResolvedValue({
      success: true,
      status: "created",
      message: "Welcome to the Founding Circle.",
    });
  });

  it("renders the email field and the approved submit label", () => {
    renderForm();

    const email = screen.getByLabelText(FOUNDING_FORM.emailLabel);
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("inputmode", "email");

    expect(
      screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }),
    ).toBeInTheDocument();
  });

  it("labels the optional name field as Full name with the name autocomplete", () => {
    renderForm();
    // Driven by the content module so the label and the test cannot drift apart.
    const fullName = screen.getByLabelText(new RegExp(FOUNDING_FORM.firstNameLabel, "i"));
    expect(FOUNDING_FORM.firstNameLabel).toBe("Full Name");
    expect(fullName).toHaveAttribute("autocomplete", "name");
  });

  it("shows a validation message for an invalid email and does not call the API", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "not-an-email");
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email address/i);
    expect(joinFoundingCircle).not.toHaveBeenCalled();
  });

  it("shows a validation message when the email is empty", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your email address/i);
    expect(joinFoundingCircle).not.toHaveBeenCalled();
  });

  it("submits a valid email and shows the success state", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");
    await user.type(
      screen.getByLabelText(new RegExp(FOUNDING_FORM.firstNameLabel, "i")),
      "Alex",
    );
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    expect(await screen.findByText(FOUNDING_FORM.successHeading)).toBeInTheDocument();
    expect(joinFoundingCircle).toHaveBeenCalledTimes(1);
    expect(joinFoundingCircle.mock.calls[0][0]).toMatchObject({
      email: "person@example.com",
      firstName: "Alex",
    });
  });

  it("disables the submit control and shows a loading state while in flight", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: unknown) => void = () => {};
    joinFoundingCircle.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderForm();
    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    const pending = await screen.findByRole("button", {
      name: new RegExp(FOUNDING_FORM.submittingLabel, "i"),
    });
    expect(pending).toBeDisabled();

    resolveRequest({ success: true, status: "created", message: "ok" });
    await screen.findByText(FOUNDING_FORM.successHeading);
  });

  it("blocks a duplicate submission from rapid double clicks", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: unknown) => void = () => {};
    joinFoundingCircle.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderForm();
    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");

    const submit = screen.getByRole("button", { name: FOUNDING_FORM.submitLabel });
    await user.click(submit);
    await user.click(submit);

    expect(joinFoundingCircle).toHaveBeenCalledTimes(1);

    resolveRequest({ success: true, status: "created", message: "ok" });
    await screen.findByText(FOUNDING_FORM.successHeading);
  });

  it("shows the reassuring confirmation when the email is already on the list", async () => {
    const user = userEvent.setup();
    joinFoundingCircle.mockResolvedValue({
      success: true,
      status: "existing",
      message: "You are already part of the Founding Circle.",
    });

    renderForm();
    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    expect(await screen.findByText(FOUNDING_FORM.existingHeading)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces an API failure without losing what was typed", async () => {
    const user = userEvent.setup();
    joinFoundingCircle.mockRejectedValue(new Error("Service unavailable"));

    renderForm();
    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByLabelText(FOUNDING_FORM.emailLabel)).toHaveValue("person@example.com");
  });

  it("includes UTM attribution captured from the landing URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      {},
      "",
      "/early-access?utm_source=instagram&utm_medium=paid_social&utm_campaign=solace_prelaunch&utm_content=founder_video",
    );

    renderForm();
    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));

    await waitFor(() => expect(joinFoundingCircle).toHaveBeenCalled());
    expect(joinFoundingCircle.mock.calls[0][0]).toMatchObject({
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "solace_prelaunch",
      utmContent: "founder_video",
      landingPage: "/early-access",
      source: "prelaunch_landing_page",
      consentSource: "prelaunch_founding_member_form",
    });
  });

  it("sends no email address to analytics", async () => {
    const user = userEvent.setup();
    const dataLayer: Array<Record<string, unknown>> = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dataLayer;

    renderForm();
    await user.type(screen.getByLabelText(FOUNDING_FORM.emailLabel), "person@example.com");
    await user.click(screen.getByRole("button", { name: FOUNDING_FORM.submitLabel }));
    await screen.findByText(FOUNDING_FORM.successHeading);

    const serialized = JSON.stringify(dataLayer);
    expect(serialized).not.toContain("person@example.com");
    expect(dataLayer.some((entry) => entry.event === "founding_member_form_submitted")).toBe(true);
  });
});
