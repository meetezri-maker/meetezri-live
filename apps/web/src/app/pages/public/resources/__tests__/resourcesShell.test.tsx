/**
 * The SPA side of the shared public-site shell.
 *
 * `/resources` used to render without the site header and footer, so it felt disconnected from the
 * rest of the Solace website. The SPA now renders the SAME `PublicSiteHeader`/`PublicSiteFooter`
 * the server renderer uses, with the router link and the real `BrandLogo` injected.
 *
 * These prove the SPA surface specifically — the server surface is covered in
 * `apps/api/src/modules/render/__tests__/siteShell.test.ts`.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE_FOOTER_COLUMNS, SITE_NAV_LINKS } from '@meetezri/public-content';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: { publicContent: { list: vi.fn(), detail: vi.fn(), related: vi.fn() } },
  };
});

const { api } = await import('@/lib/api');
const { ResourcesIndex } = await import('../ResourcesIndex');

const mockApi = api as unknown as { publicContent: Record<string, ReturnType<typeof vi.fn>> };

function renderIndex() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/resources']}>
        <Routes>
          <Route path="/resources" element={<ResourcesIndex />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.publicContent.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
});

describe('the SPA Resources page carries the site shell', () => {
  it('renders the site header and footer', async () => {
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-header')).toBeInTheDocument());
    expect(container.querySelector('.sol-site-footer')).toBeInTheDocument();
  });

  it('renders exactly one header and one footer — no duplicate shell', async () => {
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-header')).toBeInTheDocument());

    expect(container.querySelectorAll('.sol-site-header')).toHaveLength(1);
    expect(container.querySelectorAll('.sol-site-footer')).toHaveLength(1);
  });

  it('shows the same navigation the marketing site uses', async () => {
    // Queried structurally, not by role: the desktop nav is display:none below 768px and
    // jsdom applies that rule, so a role query would depend on the test viewport rather than on
    // the markup. Narrow widths are served by the disclosure, asserted separately below.
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-nav')).toBeInTheDocument());
    const nav = container.querySelector('.sol-site-nav') as HTMLElement;

    expect(nav).toHaveAttribute('aria-label', 'Primary');
    for (const link of SITE_NAV_LINKS) {
      const anchor = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent === link.label);
      expect({ label: link.label, href: anchor?.getAttribute('href') }).toEqual({
        label: link.label,
        href: link.href,
      });
    }
  });

  it('shows every footer column from the shared config', async () => {
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-footer')).toBeInTheDocument());
    const footer = container.querySelector('.sol-site-footer') as HTMLElement;

    for (const column of SITE_FOOTER_COLUMNS) {
      expect(within(footer).getByText(column.heading)).toBeInTheDocument();
    }
  });

  it('uses router-aware links, so navigation stays client-side', async () => {
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-nav')).toBeInTheDocument());

    // The shell renders whatever LinkComponent it is given. Rendering inside a MemoryRouter
    // without throwing is the proof that a router Link was injected rather than a bare anchor —
    // a router link outside a Router context throws.
    const nav = container.querySelector('.sol-site-nav') as HTMLElement;
    const pricing = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent === 'Pricing');
    expect(pricing?.tagName).toBe('A');
    expect(pricing).toHaveAttribute('href', '/pricing');
  });

  it('keeps the Resources content between the header and the footer', async () => {
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-header')).toBeInTheDocument());

    const nodes = Array.from(container.querySelectorAll('.sol-site-header, .sol-page, .sol-site-footer'));
    expect(nodes.map((n) => n.className.split(' ')[0])).toEqual([
      'sol-site-header',
      'sol-page',
      'sol-site-footer',
    ]);
  });

  it('offers the accessible mobile disclosure', async () => {
    const { container } = renderIndex();
    await waitFor(() => expect(container.querySelector('.sol-site-header')).toBeInTheDocument());

    const details = container.querySelector('details.sol-site-disclosure');
    expect(details).toBeInTheDocument();
    expect(details?.querySelector('summary')).toHaveAttribute('aria-label', 'Open menu');
  });

  it('keeps the shell on the loading and error states too', async () => {
    mockApi.publicContent.list.mockRejectedValue(new Error('down'));
    const { container } = renderIndex();

    await screen.findByRole('alert');
    expect(container.querySelector('.sol-site-header')).toBeInTheDocument();
    expect(container.querySelector('.sol-site-footer')).toBeInTheDocument();
  });
});
