import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extensionMinuteChoices,
  extensionRejectionMessage,
  isSessionExtensionEnabled,
  isVoicedPcm,
} from "./sessionExtension";

describe("isSessionExtensionEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off when unset or set to anything but true/1", () => {
    vi.stubEnv("VITE_SESSION_EXTENSIONS_ENABLED", "");
    expect(isSessionExtensionEnabled()).toBe(false);
    vi.stubEnv("VITE_SESSION_EXTENSIONS_ENABLED", "yes");
    expect(isSessionExtensionEnabled()).toBe(false);
  });

  it.each(["true", "TRUE", "1"])("is on for %s", (value) => {
    vi.stubEnv("VITE_SESSION_EXTENSIONS_ENABLED", value);
    expect(isSessionExtensionEnabled()).toBe(true);
  });
});

describe("extensionMinuteChoices", () => {
  it("offers only what the balance covers", () => {
    expect(extensionMinuteChoices(200 * 60)).toEqual([5, 10, 20, 30]);
    expect(extensionMinuteChoices(12 * 60)).toEqual([5, 10]);
  });

  it("offers nothing below the smallest option", () => {
    expect(extensionMinuteChoices(5 * 60)).toEqual([5]);
    expect(extensionMinuteChoices(5 * 60 - 1)).toEqual([]);
    expect(extensionMinuteChoices(60)).toEqual([]);
    expect(extensionMinuteChoices(59)).toEqual([]);
    expect(extensionMinuteChoices(-5)).toEqual([]);
  });
});

describe("isVoicedPcm", () => {
  it("separates speech from silence", () => {
    expect(isVoicedPcm(new Int16Array(100))).toBe(false);
    expect(isVoicedPcm(new Int16Array(100).fill(50))).toBe(false);
    expect(isVoicedPcm(new Int16Array(100).fill(5000))).toBe(true);
    expect(isVoicedPcm(new Int16Array(0))).toBe(false);
  });
});

describe("extensionRejectionMessage", () => {
  it("never reads as an approval", () => {
    for (const code of ["INSUFFICIENT_BALANCE", "EXTENSION_STALE", "LIMIT_EXCEEDED", "OTHER"]) {
      expect(extensionRejectionMessage(code)).not.toMatch(/added\.$/i);
    }
  });
});
