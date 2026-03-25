import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("verificationRedirect (trial) local vs prod base URL", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    // restore jsdom location
    // @ts-expect-error - jsdom allows override
    delete window.location;
    // @ts-expect-error - restore
    window.location = originalLocation;
  });

  it("in dev, trial redirect always uses localhost origin", async () => {
    // simulate local dev origin
    // @ts-expect-error override
    delete window.location;
    // @ts-expect-error override
    window.location = new URL("http://localhost:5173/signup") as any;

    const mod = await import("./verificationRedirect");
    const r = mod.resolveVerificationRedirectForFlow("trial");
    expect(r.emailRedirectTo).toBe("http://localhost:5173/app/user-profile");
  });

  it("in prod, base URL prefers VITE_WEB_BASE_URL when set", async () => {
    const mod = await import("./verificationRedirect");
    const resolved = mod.resolveWebBaseUrlFromInputs({
      dev: false,
      envBaseUrl: "https://meetezri-live-web.vercel.app",
      windowOrigin: "https://some-other-origin.example",
    });
    expect(resolved.baseUrl).toBe("https://meetezri-live-web.vercel.app");
    expect(resolved.isLocal).toBe(false);
    expect(resolved.source).toBe("VITE_WEB_BASE_URL");
  });

  it("in dev, base URL uses the current window origin even on LAN/custom hosts", async () => {
    const mod = await import("./verificationRedirect");
    const resolved = mod.resolveWebBaseUrlFromInputs({
      dev: true,
      envBaseUrl: "https://meetezri-live-web.vercel.app",
      windowOrigin: "http://192.168.1.50:5173",
    });
    expect(resolved.baseUrl).toBe("http://192.168.1.50:5173");
    expect(resolved.isLocal).toBe(true);
    expect(resolved.source).toBe("DEV_FORCE_LOCAL");
  });
});

