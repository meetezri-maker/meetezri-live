import { afterEach, describe, expect, it, vi } from "vitest";
import {
  conversationsSource,
  isConversationsEnabled,
  parseConversationsFlag,
  parseConversationsSource,
} from "./conversationsFlag";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseConversationsFlag", () => {
  it.each(["true", "TRUE", " true ", "1"])("enables on %j", (raw) => {
    expect(parseConversationsFlag(raw)).toBe(true);
  });

  it.each([undefined, null, "", "false", "0", "yes", "on", "enabled", 1, true])(
    "stays off on %j",
    (raw) => {
      expect(parseConversationsFlag(raw)).toBe(false);
    }
  );
});

describe("isConversationsEnabled", () => {
  it("defaults to off when the variable is unset", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "");
    expect(isConversationsEnabled()).toBe(false);
  });

  it("is on only when explicitly enabled", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "true");
    expect(isConversationsEnabled()).toBe(true);
  });
});

describe("conversations data source", () => {
  it.each([undefined, "", "preview", "true", "API-ish", 1])("keeps the in-memory preview for %p", (raw) => {
    expect(parseConversationsSource(raw)).toBe("preview");
  });

  it.each(["api", " API "])("selects the real API only for %p", (raw) => {
    expect(parseConversationsSource(raw)).toBe("api");
  });

  it("defaults to the preview when VITE_CONVERSATIONS_SOURCE is unset", () => {
    vi.stubEnv("VITE_CONVERSATIONS_SOURCE", "");
    expect(conversationsSource()).toBe("preview");
    vi.stubEnv("VITE_CONVERSATIONS_SOURCE", "api");
    expect(conversationsSource()).toBe("api");
  });
});
