import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canInitializeAnalytics } from "./config";

const PRODUCTION_HOSTNAME = "www.talktosolace2.ai";

describe("analytics runtime guards", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123");
    vi.stubEnv("VITE_META_PIXEL_ID", "123456789");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not initialize in development or the test environment", () => {
    expect(
      canInitializeAnalytics({ hostname: PRODUCTION_HOSTNAME, isProd: false }),
    ).toBe(false);
    expect(canInitializeAnalytics({ hostname: PRODUCTION_HOSTNAME })).toBe(false);
  });

  it("does not initialize in production without an approved browser hostname", () => {
    expect(canInitializeAnalytics({ hostname: "", isProd: true })).toBe(false);
    expect(
      canInitializeAnalytics({ hostname: "preview.talktosolace2.ai", isProd: true }),
    ).toBe(false);
  });

  it("allows configured production analytics only on the approved hostname", () => {
    expect(
      canInitializeAnalytics({ hostname: PRODUCTION_HOSTNAME, isProd: true }),
    ).toBe(true);
  });
});
