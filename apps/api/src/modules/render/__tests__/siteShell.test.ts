/**
 * The shared public-site shell on the server-rendered Resources pages.
 *
 * `/resources` used to render as a bare document with no site header or footer, so it felt
 * disconnected from the rest of the Solace website and offered no navigation. The shell now wraps
 * every server-rendered public page, sourced from `@meetezri/public-content` so its labels, link
 * order and footer columns cannot drift from the marketing site.
 *
 * These assert on the raw HTML — what a visitor with JavaScript disabled, and every crawler,
 * actually receives.
 */

import {
  SITE_FOOTER_COLUMNS,
  SITE_NAV_LINKS,
  SITE_FOOTER_DISCLAIMER,
} from '@meetezri/public-content';
import { renderResourceDetail } from '../renderResourceDetail';
import { renderNotFound, renderResourcesIndex } from '../renderResourcesIndex';
import { answerDetail, card, FORBIDDEN_TERMS } from './fixtures';

const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

const detailHtml = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
const indexHtml = renderResourcesIndex({
  origin: ORIGIN,
  items: [card()],
  total: 1,
  page: 1,
  pageSize: 12,
  label: null,
  assets: NO_ASSETS,
});
const notFoundHtml = renderNotFound({ origin: ORIGIN, path: '/resources/nope', assets: NO_ASSETS });

const PAGES: Array<[string, string]> = [
  ['/resources', indexHtml],
  ['/resources/:slug', detailHtml],
  ['404', notFoundHtml],
];

describe('every server-rendered public page carries the site shell', () => {
  it.each(PAGES)('%s has a header and a footer', (_name, html) => {
    expect(html).toContain('<header class="sol-site-header">');
    expect(html).toContain('<footer class="sol-site-footer">');
  });

  it.each(PAGES)('%s exposes the primary navigation as real links', (_name, html) => {
    for (const link of SITE_NAV_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(link.label.replace('&', '&amp;'));
    }
    expect(html).toContain('aria-label="Primary"');
  });

  it.each(PAGES)('%s carries every footer column and its links', (_name, html) => {
    for (const column of SITE_FOOTER_COLUMNS) {
      expect(html).toContain(column.heading);
      for (const link of column.links) {
        expect(html).toContain(`href="${link.href}"`);
      }
    }
    expect(html).toContain(SITE_FOOTER_DISCLAIMER);
  });

  it('keeps the Resources content between the header and the footer', () => {
    // Scoped to the body: the class names also appear in the inlined stylesheet.
    const body = detailHtml.slice(detailHtml.indexOf('<body>'));
    const header = body.indexOf('<header class="sol-site-header">');
    const content = body.indexOf('<h1>');
    const footer = body.indexOf('<footer class="sol-site-footer">');

    expect(header).toBeLessThan(content);
    expect(content).toBeLessThan(footer);
  });

  it('still contains the article content itself', () => {
    expect(detailHtml).toContain('Get out of bed, keep the lights low, and do something dull.');
    expect(indexHtml).toContain('What should I do when I cannot sleep?');
  });
});

describe('the shell is usable without JavaScript', () => {
  it('uses plain anchors, never router links', () => {
    // Nothing in the server output may depend on a router being mounted.
    expect(detailHtml).not.toContain('data-discover');
    expect(detailHtml).toMatch(/<a href="\/how-it-works"/);
  });

  it('offers a zero-JavaScript mobile disclosure', () => {
    // `<details>`/`<summary>` opens, is keyboard operable and announces its state with no script.
    expect(detailHtml).toContain('<details class="sol-site-disclosure">');
    expect(detailHtml).toContain('<summary');
  });

  it('renders the static logo, not the browser-driven BrandLogo', () => {
    // `BrandLogo` reads `document` and admin branding, so it can neither run here nor produce
    // deterministic output.
    expect(detailHtml).toContain('alt="Solace"');
    expect(detailHtml).not.toContain('ezri-branding-updated');
  });

  it('styles the shell from the inlined stylesheet, not the asset manifest', () => {
    // These pages were rendered with NO assets, so a manifest failure must still leave the shell
    // presentable rather than unstyled.
    expect(detailHtml).not.toContain('rel="stylesheet"');
    expect(detailHtml).toContain('.sol-site-header{');
    expect(detailHtml).toContain('.sol-btn{');
  });
});

describe('the shell lives inside the mount root, matching the SPA', () => {
  it('renders the shell INSIDE #root so the SPA cannot duplicate it', () => {
    // main.tsx mounts with createRoot().render(), not hydrateRoot, so React discards this markup
    // rather than reconciling it. A shell rendered OUTSIDE #root would survive that takeover
    // while the SPA rendered its own inside — two headers on every server-rendered page.
    const body = detailHtml.slice(detailHtml.indexOf('<body>'));
    const root = body.indexOf('<div id="root">');
    const header = body.indexOf('<header class="sol-site-header">');
    const footer = body.indexOf('<footer class="sol-site-footer">');

    expect(root).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(root);
    expect(footer).toBeGreaterThan(header);
    // Exactly one of each — never a server shell plus a client shell.
    expect((detailHtml.match(/<header class="sol-site-header">/g) ?? [])).toHaveLength(1);
    expect((detailHtml.match(/<footer class="sol-site-footer">/g) ?? [])).toHaveLength(1);
  });
});

describe('the shell does not weaken Phase 5A guarantees', () => {
  it('leaves metadata, canonical and JSON-LD intact', () => {
    expect(detailHtml).toContain('<link rel="canonical"');
    expect(detailHtml).toContain('application/ld+json');
    expect(detailHtml).toContain('<title>');
  });

  it('keeps the 404 page noindex and free of resource content', () => {
    expect(notFoundHtml).toContain('content="noindex,nofollow"');
    expect(notFoundHtml).toContain('We could not find that page');
  });

  it('exposes no internal terminology through the shell', () => {
    for (const [, html] of PAGES) {
      for (const term of FORBIDDEN_TERMS) {
        expect(html).not.toContain(term);
      }
    }
  });

  it('has exactly one H1 per page — the shell adds none', () => {
    for (const [name, html] of PAGES) {
      expect({ name, count: (html.match(/<h1[^>]*>/g) ?? []).length }).toEqual({ name, count: 1 });
    }
  });
});

describe('the Resources buttons use the shared public button language', () => {
  it('styles the filter chips as site buttons', () => {
    expect(indexHtml).toContain('class="sol-btn sol-btn-primary"');
    expect(indexHtml).toContain('class="sol-btn sol-btn-secondary"');
    // The Resources-only chip styling is gone.
    expect(indexHtml).not.toContain('sol-filter-active');
  });

  it('styles the library CTA as a site button', () => {
    expect(indexHtml).toContain('<a class="sol-btn sol-btn-primary" href="/how-it-works">');
  });

  it('styles an in-article CTA as a site button', () => {
    expect(detailHtml).toContain('sol-btn sol-btn-primary');
    expect(detailHtml).not.toContain('sol-cta-link');
  });
});
