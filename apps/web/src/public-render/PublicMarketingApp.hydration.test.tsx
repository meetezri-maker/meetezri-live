import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EarlyAccess } from '@/app/pages/EarlyAccess';
import { Terms } from '@/app/pages/Terms';
import { PublicMarketingApp } from './PublicMarketingApp';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

globalThis.IntersectionObserver ??= class {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia;

Element.prototype.scrollIntoView ??= vi.fn();

interface HydrationCase {
  pathname: '/' | '/terms' | '/early-access';
  Page: typeof Terms;
  expectedH1: string;
}

const cases: HydrationCase[] = [
  {
    pathname: '/terms',
    Page: Terms,
    expectedH1: 'Terms & Conditions',
  },
  {
    pathname: '/early-access',
    Page: EarlyAccess,
    expectedH1: 'Some conversations change everything.',
  },
];

let hydratedRoot: Root | undefined;

describe('public document hydration', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  });

  afterEach(async () => {
    if (hydratedRoot) {
      await act(async () => hydratedRoot?.unmount());
      hydratedRoot = undefined;
    }
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it.each(cases)(
    'hydrates $pathname without mismatch recovery or replacing the prerendered root',
    async ({ pathname, Page, expectedH1 }) => {
      window.history.replaceState(null, '', pathname);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const markup = renderToString(
        <PublicMarketingApp Page={Page} pathname={pathname} mode="server" />,
      );
      document.body.innerHTML = `<div id="root">${markup}</div>`;
      const container = document.getElementById('root')!;
      const firstRenderedNode = container.firstElementChild;
      const recoverableErrors: unknown[] = [];

      await act(async () => {
        hydratedRoot = hydrateRoot(
          container,
          <PublicMarketingApp Page={Page} pathname={pathname} mode="client" />,
          { onRecoverableError: (error) => recoverableErrors.push(error) },
        );
      });

      expect(recoverableErrors).toEqual([]);
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('Hydration failed'),
      );
      expect(container.firstElementChild).toBe(firstRenderedNode);
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      expect(container.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        expectedH1,
      );
    },
  );
});
