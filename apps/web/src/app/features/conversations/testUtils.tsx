import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { ConversationServiceProvider } from "./ConversationsServiceContext";
import { ConversationsPage } from "./ConversationsPage";
import { CONVERSATIONS_ROUTE_PATTERN } from "./conversationsFlag";
import type { ConversationService } from "./conversationService";
import { createMockConversationService, type MockConversationServiceOptions } from "./mockConversationService";
import { buildPreviewSeed } from "./mocks/previewConversations";

/** Test-only helpers for the Conversations feature. */
export function testService(options: MockConversationServiceOptions & { seeded?: boolean } = {}) {
  const { seeded = true, ...rest } = options;
  return createMockConversationService({
    createDelayMs: 0,
    replyDelayMs: 0,
    seed: seeded ? buildPreviewSeed() : undefined,
    ...rest,
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

export function renderConversations(path = "/app/conversations", service: ConversationService = testService()) {
  const result = render(
    <ConversationServiceProvider service={service}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={CONVERSATIONS_ROUTE_PATTERN} element={<ConversationsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ConversationServiceProvider>
  );
  return { ...result, service };
}

/**
 * jsdom has no layout, so media queries never match on their own. Answers each query from
 * `answers` (unlisted queries are false).
 */
export function stubMatchMedia(answers: Record<string, boolean>) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: answers[query] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }))
  );
}
