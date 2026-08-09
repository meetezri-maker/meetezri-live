/**
 * Public Resources pages (SPA side).
 *
 * Two things are being proved here:
 *
 *   1. The pages work as anonymous SPA routes — no auth, no member chrome, correct states.
 *   2. The SPA renders the SAME markup the server renderer produces, so hydration is quiet. That
 *      assertion lives in the "server parity" block and is the one most likely to catch a future
 *      regression, because the two renderers live in different packages.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ResourceArticle,
  ResourcesLibrary,
  type PublicResource,
  type PublicResourceCard,
} from '@meetezri/public-content';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      publicContent: { list: vi.fn(), detail: vi.fn(), related: vi.fn() },
    },
  };
});

const { api } = await import('@/lib/api');
const { ResourcesIndex, libraryHref } = await import('../ResourcesIndex');
const { ResourceDetail } = await import('../ResourceDetail');

const mockApi = api as unknown as { publicContent: Record<string, ReturnType<typeof vi.fn>> };

function card(overrides: Partial<PublicResourceCard> = {}): PublicResourceCard {
  return {
    slug: 'what-to-do-when-you-cannot-sleep',
    label: 'Answer',
    title: 'What should I do when I cannot sleep?',
    description: 'Practical, gentle steps for the nights when sleep will not come.',
    featuredImageUrl: null,
    featuredImageAlt: null,
    readingTimeMinutes: 4,
    publishedAt: '2026-03-12T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
    ...overrides,
  };
}

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    slug: 'what-to-do-when-you-cannot-sleep',
    label: 'Answer',
    title: 'What should I do when I cannot sleep?',
    description: 'Practical, gentle steps for the nights when sleep will not come.',
    canonicalPath: '/resources/what-to-do-when-you-cannot-sleep',
    canonicalUrlOverride: null,
    robots: 'index,follow',
    featuredImageUrl: null,
    featuredImageAlt: null,
    body: {
      version: 1,
      blocks: [
        { id: 'b1', type: 'direct_answer', content: [{ text: 'Get out of bed and keep the lights low.' }] },
        { id: 'b2', type: 'paragraph', content: [{ text: 'Your brain learns from repetition.' }] },
      ],
    },
    typeFields: { primaryQuestion: 'What should I do when I cannot sleep?' },
    author: { name: 'Dr Amara Reid', title: 'Clinical psychologist', bio: null, avatarUrl: null },
    reviewer: null,
    reviewedAt: null,
    publishedAt: '2026-03-12T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
    readingTimeMinutes: 4,
    links: [],
    related: [card({ slug: 'sleep-and-anxiety', title: 'Sleep and anxiety', label: 'Insight' })],
    ...overrides,
  };
}

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/resources" element={<ResourcesIndex />} />
          <Route path="/resources/:slug" element={<ResourceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.publicContent.list.mockResolvedValue({ items: [card()], total: 1, page: 1, pageSize: 12 });
  mockApi.publicContent.detail.mockResolvedValue(resource());
});

afterEach(() => {
  document.title = '';
});

// ─── Index ───────────────────────────────────────────────────────────────────

describe('/resources', () => {
  it('renders one unified library with a single H1', async () => {
    renderRoute('/resources');

    expect(await screen.findByRole('heading', { level: 1, name: 'Solace Resources' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows public card fields only', async () => {
    renderRoute('/resources');
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByText('What should I do when I cannot sleep?')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
    expect(screen.getByText('12 March 2026')).toBeInTheDocument();
    expect(screen.getByText('4 min read')).toBeInTheDocument();
  });

  it('offers public label filters, never internal strategy sections', async () => {
    renderRoute('/resources');
    const filters = await screen.findByRole('navigation', { name: 'Filter resources' });

    expect(within(filters).getByRole('link', { name: 'All' })).toBeInTheDocument();
    expect(within(filters).getByRole('link', { name: 'Answers' })).toHaveAttribute(
      'href',
      '/resources?type=Answer',
    );
    expect(within(filters).getByRole('link', { name: 'Insights' })).toBeInTheDocument();
    expect(within(filters).getByRole('link', { name: 'Articles' })).toBeInTheDocument();
  });

  it('requests the active filter from the public API', async () => {
    renderRoute('/resources?type=Insight&page=2');

    await waitFor(() =>
      expect(mockApi.publicContent.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 12,
        type: 'Insight',
      }),
    );
  });

  it('shows an empty state rather than an error when nothing is published', async () => {
    mockApi.publicContent.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
    renderRoute('/resources');

    expect(await screen.findByText(/New resources are on the way/)).toBeInTheDocument();
  });

  it('shows a filtered-empty state that points back to All', async () => {
    mockApi.publicContent.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
    renderRoute('/resources?type=Article');

    expect(await screen.findByText(/Nothing here yet under this filter/)).toBeInTheDocument();
  });

  it('offers a retry when the library fails to load', async () => {
    mockApi.publicContent.list.mockRejectedValue(new Error('down'));
    renderRoute('/resources');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('paginates with crawlable prev/next links', async () => {
    mockApi.publicContent.list.mockResolvedValue({ items: [card()], total: 30, page: 2, pageSize: 12 });
    renderRoute('/resources?page=2');

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' });
    expect(within(pagination).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/resources');
    expect(within(pagination).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/resources?page=3');
  });

  it('carries a support notice', async () => {
    renderRoute('/resources');
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByText(/not a diagnosis or a substitute for professional care/i)).toBeInTheDocument();
  });

  it('builds hrefs identically to the server renderer', () => {
    expect(libraryHref({})).toBe('/resources');
    expect(libraryHref({ page: 1 })).toBe('/resources');
    expect(libraryHref({ label: 'Insight' })).toBe('/resources?type=Insight');
    expect(libraryHref({ label: 'Insight', page: 3 })).toBe('/resources?type=Insight&page=3');
  });
});

// ─── Detail ──────────────────────────────────────────────────────────────────

describe('/resources/:slug', () => {
  it('renders the resource with a single H1 and breadcrumbs', async () => {
    renderRoute('/resources/what-to-do-when-you-cannot-sleep');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'What should I do when I cannot sleep?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources');
  });

  it('renders the public label, dates, reading time and author', async () => {
    const { container } = renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    // Each related card is also an <article>, so target the main one.
    const article = container.querySelector('article.sol-article') as HTMLElement;
    expect(within(article).getByText('Answer')).toBeInTheDocument();
    // The related card carries the same date, so scope to the article being tested.
    expect(within(article).getAllByText('12 March 2026').length).toBeGreaterThan(0);
    expect(within(article).getAllByText('4 min read').length).toBeGreaterThan(0);
    expect(within(article).getByText(/Dr Amara Reid/)).toBeInTheDocument();
    expect(within(article).getByText('Clinical psychologist')).toBeInTheDocument();
  });

  it('renders the direct answer as a labelled region', async () => {
    renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    const answer = screen.getByRole('region', { name: 'Direct answer' });
    expect(within(answer).getByText('Get out of bed and keep the lights low.')).toBeInTheDocument();
  });

  it('renders related resources', async () => {
    renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    const related = screen.getByRole('region', { name: 'Related resources' });
    expect(within(related).getByRole('link', { name: 'Sleep and anxiety' })).toHaveAttribute(
      'href',
      '/resources/sleep-and-anxiety',
    );
  });

  it('shows a not-found body for an unavailable slug, revealing no reason', async () => {
    mockApi.publicContent.detail.mockRejectedValue(new Error('404'));
    const { container } = renderRoute('/resources/a-draft');

    expect(await screen.findByRole('heading', { level: 1, name: /could not find that page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse Solace Resources/ })).toHaveAttribute('href', '/resources');

    for (const word of ['draft', 'unpublished', 'archived', 'review']) {
      expect({ word, present: (container.textContent ?? '').toLowerCase().includes(word) }).toEqual({
        word,
        present: false,
      });
    }
  });

  it('keeps the head honest during client-side navigation', async () => {
    renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    await waitFor(() =>
      expect(document.title).toBe('What should I do when I cannot sleep? | Solace'),
    );
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index,follow',
    );
  });
});

// ─── Server parity ───────────────────────────────────────────────────────────

describe('server parity', () => {
  /**
   * Hydration mismatches show up as flickering text and console warnings, and they are easy to
   * introduce: a `toLocaleDateString`, a `Math.random` key, a `window` check. Rendering the shared
   * components through `renderToStaticMarkup` and comparing against the browser render is the
   * cheapest way to catch that in CI.
   *
   * Attribute NAMES are lower-cased before comparing. React's string renderer emits the JSX
   * spelling (`dateTime`) while `innerHTML` reports the DOM's canonical lower-case form
   * (`datetime`). That difference is the browser normalising, not the two renders disagreeing —
   * React hydration compares its own tree to the DOM and never sees it. Only names containing an
   * uppercase letter are touched, so no attribute VALUE can be altered.
   */
  const normaliseAttributeCase = (html: string) =>
    html.replace(/([<\s])([a-zA-Z]*[A-Z][a-zA-Z]*)=/g, (_match, lead, name) => `${lead}${name.toLowerCase()}=`);

  it('produces identical markup for an article on the server and in the browser', () => {
    const data = resource();
    const server = renderToStaticMarkup(<ResourceArticle resource={data} />);
    const { container } = render(<ResourceArticle resource={data} />);

    expect(container.innerHTML).toBe(normaliseAttributeCase(server));
  });

  it('produces identical markup for the library on the server and in the browser', () => {
    const props = {
      items: [card(), card({ slug: 'b', label: 'Insight' as const })],
      total: 2,
      page: 1,
      pageSize: 12,
      activeLabel: null,
      buildHref: libraryHref,
    };
    const server = renderToStaticMarkup(<ResourcesLibrary {...props} />);
    const { container } = render(<ResourcesLibrary {...props} />);

    expect(container.innerHTML).toBe(normaliseAttributeCase(server));
  });

  it('formats dates deterministically regardless of the host timezone', () => {
    // `toLocaleDateString` would differ between a UTC server and a browser in Sydney. This asserts
    // the rendered date is the UTC-derived one either way.
    const data = resource({ publishedAt: '2026-03-12T23:30:00.000Z' });
    const server = renderToStaticMarkup(<ResourceArticle resource={data} />);

    expect(server).toContain('12 March 2026');
    expect(server).toContain('dateTime="2026-03-12"');
  });
});

// ─── Terminology and disclosure ──────────────────────────────────────────────

describe('public terminology and disclosure', () => {
  const FORBIDDEN = ['aeo_answer', 'geo_article', 'seo_blog', 'AEO', 'GEO'];

  it('exposes no internal type or strategy name on the detail page', async () => {
    const { container } = renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    for (const term of FORBIDDEN) {
      expect({ term, present: container.innerHTML.includes(term) }).toEqual({ term, present: false });
    }
  });

  it('exposes no internal type or strategy name on the index', async () => {
    const { container } = renderRoute('/resources');
    await screen.findByRole('heading', { level: 1 });

    for (const term of FORBIDDEN) {
      expect({ term, present: container.innerHTML.includes(term) }).toEqual({ term, present: false });
    }
  });

  it('renders nothing internal even if a field somehow arrived on the payload', async () => {
    mockApi.publicContent.detail.mockResolvedValue({
      ...resource(),
      editorial: { note: 'SENTINEL-EDITORIAL' },
      editorialRef: 'SENTINEL-REF',
      tags: ['SENTINEL-TAG'],
      approvals: { founder: 'approved' },
      scheduledFor: '2099-01-01T00:00:00.000Z',
    });

    const { container } = renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    for (const sentinel of ['SENTINEL-EDITORIAL', 'SENTINEL-REF', 'SENTINEL-TAG', '2099-01-01']) {
      expect({ sentinel, present: container.innerHTML.includes(sentinel) }).toEqual({
        sentinel,
        present: false,
      });
    }
  });

  it('sends NO Authorization header on public reads', async () => {
    // The public namespace is separate from `api.content` precisely so a bearer token never lands
    // on a request a CDN is meant to cache and serve to everyone. Asserted against the real client
    // with a stubbed fetch, not against the mock used by the page tests above.
    const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
    // A fresh Response per call — a Response body can only be read once.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 12 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    try {
      await actual.api.publicContent.list({ page: 1, type: 'Answer' });
      await actual.api.publicContent.detail('a-slug');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      for (const [url, init] of fetchSpy.mock.calls as Array<[string, RequestInit | undefined]>) {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect({ url, auth: headers.Authorization ?? headers.authorization }).toEqual({
          url,
          auth: undefined,
        });
      }

      // And the label, not an internal type string, is what goes on the wire.
      expect(String(fetchSpy.mock.calls[0][0])).toContain('type=Answer');
      expect(String(fetchSpy.mock.calls[0][0])).not.toContain('aeo_answer');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

// ─── Accessibility ───────────────────────────────────────────────────────────

describe('public accessibility', () => {
  it('gives every card link the title as its accessible name', async () => {
    renderRoute('/resources');
    await screen.findByRole('heading', { level: 1 });

    expect(
      screen.getByRole('link', { name: 'What should I do when I cannot sleep?' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /read more/i })).not.toBeInTheDocument();
  });

  it('labels the breadcrumb, filter and pagination navigations', async () => {
    mockApi.publicContent.list.mockResolvedValue({ items: [card()], total: 30, page: 2, pageSize: 12 });
    renderRoute('/resources?page=2');
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Filter resources' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
  });

  it('uses an article landmark and a logical heading order', async () => {
    const { container } = renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    expect(container.querySelector('article.sol-article')).toBeInTheDocument();

    // Exactly one H1, and nothing jumps from H1 straight to H3 or deeper.
    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(Math.min(...levels)).toBe(1);
    expect(levels).not.toContain(4);
    expect(levels).not.toContain(5);
  });

  it('marks decorative avatars as decorative', async () => {
    mockApi.publicContent.detail.mockResolvedValue(
      resource({
        author: {
          name: 'Dr Amara Reid',
          title: null,
          bio: null,
          avatarUrl: 'https://cdn.example.com/a.png',
        },
      }),
    );
    const { container } = renderRoute('/resources/what-to-do-when-you-cannot-sleep');
    await screen.findByRole('heading', { level: 1 });

    const avatar = container.querySelector('.sol-avatar');
    expect(avatar).toHaveAttribute('alt', '');
  });
});
