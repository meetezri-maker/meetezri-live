/**
 * Shared API client caches must never carry one account's data to the next (no page reload).
 * Synthetic data; fetch and Supabase are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ token: "token-a" }));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: session.token } } }) },
  },
}));

import { api, clearApiClientCaches } from "./api";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("lib/api per-user caches", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearApiClientCaches();
    session.token = "token-a";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a /users/me response cached for A is not served to B after clearing", async () => {
    fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const token = (init.headers as Record<string, string>).Authorization;
      return json({ id: token === "Bearer token-a" ? "user-a" : "user-b" });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await api.getMe()).toMatchObject({ id: "user-a" });
    expect(await api.getMe()).toMatchObject({ id: "user-a" }); // served from the short cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearApiClientCaches(); // sign-out / account change
    session.token = "token-b";
    expect(await api.getMe()).toMatchObject({ id: "user-b" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("an A request still in flight at clear time can neither be joined by B nor refill the cache", async () => {
    let releaseA!: () => void;
    fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const token = (init.headers as Record<string, string>).Authorization;
      if (token === "Bearer token-a") {
        return new Promise<Response>((resolve) => {
          releaseA = () => resolve(json({ id: "user-a" }));
        });
      }
      return Promise.resolve(json({ id: "user-b" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const aPending = api.getMe(); // A's request in flight
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    clearApiClientCaches();
    session.token = "token-b";
    expect(await api.getMe()).toMatchObject({ id: "user-b" }); // B did NOT join A's in-flight request

    releaseA();
    await aPending; // A's late response completes...
    expect(await api.getMe()).toMatchObject({ id: "user-b" }); // ...but did not overwrite B's cache
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
