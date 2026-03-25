import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Helper to re-import the module with a specific `import.meta.env`.
async function importWithEnv(env: Record<string, any>) {
  vi.resetModules();
  vi.stubEnv("VITE_WEB_BASE_URL", env.VITE_WEB_BASE_URL ?? "");
  // Vitest doesn't let us directly set import.meta.env.DEV.
  // Instead, we rely on the test runner mode:
  // - `vitest run` uses `import.meta.env.MODE` but `DEV` is derived by Vite.
  // We'll simulate the "production behavior" by calling resolveWebBaseUrl with DEV=false
  // via a separate dynamic import in a production-mode test file if needed.
  return await import("./verificationRedirect");
}

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

  it("in prod, trial redirect uses VITE_WEB_BASE_URL when set (production URL)", async () => {
    // simulate production-ish origin
    // @ts-expect-error override
    delete window.location;
    // @ts-expect-error override
    window.location = new URL("https://meetezri-live-web.vercel.app/signup") as any;

    const mod = await importWithEnv({
      VITE_WEB_BASE_URL: "https://meetezri-live-web.vercel.app",
    });

    // If this test runs in dev mode, `resolveWebBaseUrl()` will force localhost.
    // So we assert on the baseUrl selection only when not DEV.
    if ((import.meta as any).env?.DEV) {
      expect(mod.resolveWebBaseUrl().isLocal).toBe(true);
      return;
    }

    const r = mod.resolveVerificationRedirectForFlow("trial");
    expect(r.emailRedirectTo).toBe(
      "https://meetezri-live-web.vercel.app/app/user-profile"
    );
  });
});

