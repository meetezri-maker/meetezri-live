/**
 * Cross-account isolation regression tests (Account A -> logout -> Account B, no page reload).
 *
 * Reproduces the confirmed bug's mechanics — a page-lifetime service that kept Account A's list,
 * messages and streams — and proves each guard: owner-scoped services, disposal on identity change,
 * late responses ignored, streams aborted (including Quick Chat sends, which have no page signal),
 * and requests refused when the session no longer belongs to the service's owner.
 * Synthetic ids only; fetch and Supabase are mocked.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: null as null | { id: string },
  /** What supabase.auth.getSession() returns right now (may differ from `user` across tabs). */
  session: null as null | { userId: string; token: string },
}));

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: auth.session ? { access_token: auth.session.token, user: { id: auth.session.userId } } : null,
        },
      }),
    },
  },
}));

import { emitAuthIdentityReset } from "@/lib/authIdentityEvents";
import { createApiConversationService } from "./apiConversationService";
import { ConversationsPage } from "./ConversationsPage";
import { getConversationServiceForUser, resetConversationServices } from "./ConversationsServiceContext";
import { CONVERSATIONS_ROUTE_PATTERN } from "./conversationsFlag";
import { stubMatchMedia } from "./testUtils";

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const T0 = "2026-11-24T10:00:00.000Z";

const summary = (id: string, title: string) => ({
  id,
  companion_key: "Sara Mitchell",
  title,
  preview: "synthetic preview",
  created_at: T0,
  updated_at: T0,
  last_message_at: T0,
});
const A_CONVERSATIONS = [
  summary("11111111-0000-4000-8000-000000000001", "Account A chat one"),
  summary("11111111-0000-4000-8000-000000000002", "Account A chat two"),
  summary("11111111-0000-4000-8000-000000000003", "Account A chat three"),
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** fetch double that answers per bearer token, honours AbortSignal, and can hold responses. */
function installFetch(opts: { holdListFor?: string } = {}) {
  const held = deferred<void>();
  const calls: Array<{ url: string; token: string | undefined; aborted: () => boolean }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const token = (init.headers as Record<string, string>)?.Authorization?.replace("Bearer ", "");
    const signal = init.signal;
    calls.push({ url, token, aborted: () => Boolean(signal?.aborted) });
    const abortable = <T,>(p: Promise<T>) =>
      new Promise<T>((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        p.then(resolve, reject);
      });
    if (url.includes("/conversations?limit=")) {
      const body = token === "token-a" ? { items: A_CONVERSATIONS } : { items: [] };
      if (opts.holdListFor && token === opts.holdListFor) {
        return abortable(held.promise.then(() => json(body)));
      }
      return json(body);
    }
    return json({ code: "CONVERSATION_NOT_FOUND" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, release: () => held.resolve(), fetchMock };
}

function signIn(userId: string, token: string) {
  auth.user = { id: userId };
  auth.session = { userId, token };
}
function signOut() {
  auth.user = null;
  auth.session = null;
  emitAuthIdentityReset(); // what AuthContext does on SIGNED_OUT / user change
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/conversations"]}>
      <Routes>
        <Route path={CONVERSATIONS_ROUTE_PATTERN} element={<ConversationsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_CONVERSATIONS_SOURCE", "api");
  stubMatchMedia({ "(min-width: 1024px)": true, "(min-width: 1280px)": true });
  resetConversationServices();
  auth.user = null;
  auth.session = null;
});

afterEach(() => {
  resetConversationServices();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("owner-scoped service registry", () => {
  it("gives each user their own service and disposes the previous one on switch", () => {
    installFetch();
    const forA = getConversationServiceForUser(A);
    expect(forA.ownerId).toBe(A);
    expect(getConversationServiceForUser(A)).toBe(forA); // same user -> same service

    const forB = getConversationServiceForUser(B);
    expect(forB).not.toBe(forA);
    expect(forB.ownerId).toBe(B);
    expect(forA.disposed).toBe(true);
  });

  it("returns an inert, data-less, 'loading' service when nobody is signed in", async () => {
    installFetch();
    const forA = getConversationServiceForUser(A);
    const none = getConversationServiceForUser(null);
    expect(forA.disposed).toBe(true);
    expect(none.ownerId).toBeNull();
    expect(none.getSnapshot()).toMatchObject({ conversations: [], listStatus: "loading" });
    await expect(none.createConversation({ companionKey: "Alex" })).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("disposes the owner's service on the auth identity-reset signal (sign-out anywhere)", () => {
    installFetch();
    const forA = getConversationServiceForUser(A);
    emitAuthIdentityReset();
    expect(forA.disposed).toBe(true);
    expect(getConversationServiceForUser(A)).not.toBe(forA); // fresh, empty service afterwards
  });
});

describe("disposed services can never update the next account", () => {
  it("a late list response arriving after dispose publishes nothing", async () => {
    signIn(A, "token-a");
    const { release } = installFetch({ holdListFor: "token-a" });
    const service = createApiConversationService({ ownerId: A, apiBase: "/api" });
    const listener = vi.fn();
    service.subscribe(listener);

    const pending = service.listConversations();
    listener.mockClear();
    service.dispose!();
    release();

    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    expect(listener).not.toHaveBeenCalled();
    expect(service.getSnapshot().conversations).toHaveLength(0);
  });

  it("aborts an active stream on dispose — including a Quick Chat send with no page signal", async () => {
    signIn(A, "token-a");
    let streamSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = String(input);
        if (url.endsWith("/conversations") && init.method === "POST") return json(summary("c1", "t"), 201);
        streamSignal = init.signal ?? undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"partial"}\n\n'));
              init.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } }
        );
      })
    );
    const service = createApiConversationService({ ownerId: A, apiBase: "/api" });
    await service.createConversation({ companionKey: "Sara Mitchell" });

    const sending = service.sendMessage({ conversationId: "c1", content: "hello" }); // no signal (Quick Chat)
    await waitFor(() => expect(streamSignal).toBeDefined());
    const listener = vi.fn();
    service.subscribe(listener);
    service.dispose!();

    await expect(sending).rejects.toMatchObject({ code: "ABORTED" });
    expect(streamSignal!.aborted).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("refuses to send a request when the session now belongs to another account (multi-tab)", async () => {
    const { fetchMock } = installFetch();
    signIn(A, "token-a");
    const service = createApiConversationService({ ownerId: A, apiBase: "/api" });
    auth.session = { userId: B, token: "token-b" }; // B signed in from another tab

    await expect(service.listConversations()).rejects.toMatchObject({ code: "ABORTED" });
    expect(fetchMock).not.toHaveBeenCalled(); // neither A's service with B's token, nor vice versa
  });
});

describe("Conversations page: Account A -> logout -> Account B without reload", () => {
  it("never shows Account A's conversations to Account B, and B's list is fetched with B's token", async () => {
    const { calls } = installFetch();
    signIn(A, "token-a");
    const view = renderPage();
    expect(await screen.findByText("Account A chat one")).toBeInTheDocument();

    await act(async () => signOut());
    view.rerender(
      <MemoryRouter initialEntries={["/app/conversations"]}>
        <Routes>
          <Route path={CONVERSATIONS_ROUTE_PATTERN} element={<ConversationsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText("Account A chat one")).not.toBeInTheDocument();

    await act(async () => signIn(B, "token-b"));
    view.unmount();
    renderPage();
    // Synchronously after B's render, before any response: none of A's data.
    expect(screen.queryByText(/Account A chat/)).not.toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.url.includes("/conversations?limit=") && c.token === "token-b")).toBe(true));
    await waitFor(() => expect(screen.getByText("No conversations yet")).toBeInTheDocument());
    expect(screen.queryByText(/Account A chat/)).not.toBeInTheDocument();
  });

  it("a delayed Account A list response cannot populate Account B's view", async () => {
    const { calls, release } = installFetch({ holdListFor: "token-a" });
    signIn(A, "token-a");
    const first = renderPage();
    await waitFor(() => expect(calls.some((c) => c.token === "token-a")).toBe(true)); // A's request in flight

    await act(async () => signOut());
    first.unmount();
    await act(async () => signIn(B, "token-b"));
    renderPage();
    await waitFor(() => expect(screen.getByText("No conversations yet")).toBeInTheDocument());

    await act(async () => release()); // A's response finally arrives
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Account A chat/)).not.toBeInTheDocument();
    expect(calls.find((c) => c.token === "token-a")!.aborted()).toBe(true); // and it was aborted
  });

  it("switching back to Account A loads A's data fresh (normal behaviour preserved)", async () => {
    const { calls } = installFetch();
    signIn(B, "token-b");
    const v1 = renderPage();
    await waitFor(() => expect(screen.getByText("No conversations yet")).toBeInTheDocument());
    await act(async () => signOut());
    v1.unmount();
    await act(async () => signIn(A, "token-a"));
    renderPage();
    expect(await screen.findByText("Account A chat one")).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes("/conversations?limit=")).map((c) => c.token)).toEqual(["token-b", "token-a"]);
  });
});
