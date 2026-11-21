import { describe, expect, it } from "vitest";
import { INITIAL_QUICK_CHAT_STATE, quickChatReducer, type QuickChatAction, type QuickChatState } from "./quickChatState";
import { isQuickChatAllowed, QUICK_CHAT_HIDDEN_PATHS } from "./quickChatVisibility";

describe("isQuickChatAllowed", () => {
  it.each([
    "/app/dashboard",
    "/app/journal",
    "/app/mood-checkin",
    "/app/progress",
    "/app/billing",
    "/app/user-profile",
    "/app/settings",
    "/app/settings/safety-insights",
    "/app/settings/accessibility",
  ])("shows on the ordinary member page %s", (path) => {
    expect(isQuickChatAllowed(path, "NORMAL", true)).toBe(true);
  });

  it.each([
    "/app/conversations",
    "/app/conversations/abc",
    "/app/active-session",
    "/app/session-lobby",
    "/app/emergency-resources",
    "/app/crisis-resources",
    "/app/settings/cooldown-screen",
    "/app/settings/wellness-plan",
    "/app/settings/safety-plan",
    "/app/settings/emergency-contacts",
    "/app/settings/emergency-notifications",
    "/app/settings/notification-history",
    "/app/settings/appearance",
    "/app/settings/appearance/",
  ])("hides on %s", (path) => {
    expect(isQuickChatAllowed(path, "NORMAL", true)).toBe(false);
  });

  it.each(["/login", "/signup", "/onboarding/welcome", "/", "/profile/123", "/app"])(
    "hides outside ordinary member pages: %s",
    (path) => {
      expect(isQuickChatAllowed(path, "NORMAL", true)).toBe(false);
    }
  );

  it("does not treat a path prefix as a match without a segment boundary", () => {
    expect(isQuickChatAllowed("/app/session-lobby-tips", "NORMAL", true)).toBe(true);
  });

  it("hides for HIGH_RISK, SAFETY_MODE and COOLDOWN; stays for NORMAL and ELEVATED_CONCERN", () => {
    expect(isQuickChatAllowed("/app/journal", "HIGH_RISK", true)).toBe(false);
    expect(isQuickChatAllowed("/app/journal", "SAFETY_MODE", true)).toBe(false);
    expect(isQuickChatAllowed("/app/journal", "COOLDOWN", true)).toBe(false);
    expect(isQuickChatAllowed("/app/journal", "ELEVATED_CONCERN", true)).toBe(true);
  });

  it("is always off when the feature flag is off", () => {
    expect(isQuickChatAllowed("/app/journal", "NORMAL", false)).toBe(false);
  });

  it("covers every approved hidden page", () => {
    expect(QUICK_CHAT_HIDDEN_PATHS).toEqual(
      expect.arrayContaining([
        "/app/settings/appearance",
        "/app/settings/wellness-plan",
        "/app/settings/emergency-contacts",
        "/app/settings/emergency-notifications",
      ])
    );
    expect(QUICK_CHAT_HIDDEN_PATHS).not.toContain("/app/settings/safety-insights");
  });
});

describe("quickChatReducer", () => {
  const run = (...actions: QuickChatAction[]) =>
    actions.reduce<QuickChatState>(quickChatReducer, INITIAL_QUICK_CHAT_STATE);

  it("goes idle → selecting → preparing → open", () => {
    expect(run({ type: "OPEN_SELECTOR" }).mode).toBe("selecting");
    expect(run({ type: "OPEN_SELECTOR" }, { type: "START_PREPARING" }).mode).toBe("preparing");
    expect(
      run({ type: "OPEN_SELECTOR" }, { type: "START_PREPARING" }, { type: "CREATED", conversationId: "c1" })
    ).toEqual({ mode: "open", conversationId: "c1" });
  });

  it("minimizes, resumes and expands while keeping the same thread", () => {
    const open = run({ type: "CREATED", conversationId: "c1" });
    const minimized = quickChatReducer(open, { type: "MINIMIZE" });
    expect(minimized).toEqual({ mode: "minimized", conversationId: "c1" });
    expect(quickChatReducer(minimized, { type: "RESUME" })).toEqual({ mode: "open", conversationId: "c1" });
    expect(quickChatReducer(open, { type: "EXPANDED" })).toEqual({ mode: "minimized", conversationId: "c1" });
  });

  it("returns to the minimized thread when a new-chat selection is cancelled or fails", () => {
    const minimized = run({ type: "CREATED", conversationId: "c1" }, { type: "MINIMIZE" });
    const selecting = quickChatReducer(minimized, { type: "OPEN_SELECTOR" });
    expect(quickChatReducer(selecting, { type: "CANCEL_SELECTOR" })).toEqual(minimized);
    const preparing = quickChatReducer(selecting, { type: "START_PREPARING" });
    expect(quickChatReducer(preparing, { type: "CREATE_FAILED" })).toEqual(minimized);
  });

  it("replaces the quick-chat thread when a separate new conversation starts", () => {
    const state = run({ type: "CREATED", conversationId: "c1" }, { type: "MINIMIZE" }, { type: "OPEN_SELECTOR" }, { type: "START_PREPARING" }, { type: "CREATED", conversationId: "c2" });
    expect(state).toEqual({ mode: "open", conversationId: "c2" });
  });

  it("suspends to minimized (thread kept) and closes to idle", () => {
    const open = run({ type: "CREATED", conversationId: "c1" });
    expect(quickChatReducer(open, { type: "SUSPEND" })).toEqual({ mode: "minimized", conversationId: "c1" });
    expect(quickChatReducer(open, { type: "CLOSE" })).toEqual(INITIAL_QUICK_CHAT_STATE);
    expect(quickChatReducer(run({ type: "OPEN_SELECTOR" }), { type: "SUSPEND" }).mode).toBe("idle");
    expect(quickChatReducer(INITIAL_QUICK_CHAT_STATE, { type: "RESUME" })).toEqual(INITIAL_QUICK_CHAT_STATE);
  });
});
