/**
 * Runtime render — HTML output, metadata, structured data, terminology and disclosure.
 *
 * These assert on the FINAL HTML STRING, not on component props. The whole point of Phase 5A is
 * what a crawler receives before executing JavaScript, so the tests read the same bytes it does.
 */

import {
  renderResourceDetail,
} from '../renderResourceDetail';
import { renderNotFound, renderResourcesIndex, libraryHref } from '../renderResourcesIndex';
import { canonicalFor, libraryMetadata, pageTitle, resourceMetadata } from '../metadata';
import { articleTypeFor, faqSchema, serialiseJsonLd } from '../structuredData';
import { buildRobots, buildSitemap, escapeXml, isIndexable } from '../sitemap';
import { parseAssets } from '../assetManifest';
import {
  ALL_SENTINELS,
  FORBIDDEN_TERMS,
  SENTINELS,
  answerDetail,
  articleDetail,
  card,
  insightDetail,
} from './fixtures';

const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

/** Every JSON-LD document embedded in a rendered page. */
function jsonLdFrom(html: string): Array<Record<string, any>> {
  const matches = html.matchAll(
    /<script type="application\/ld\+json">(.*?)<\/script>/gs
  );
  return [...matches].map((match) => JSON.parse(match[1].replace(/\\u003c/g, '<')));
}

function metaContent(html: string, attr: 'name' | 'property', key: string): string | null {
  const pattern = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`, 'i');
  return html.match(pattern)?.[1] ?? null;
}

// ─── Document shell ──────────────────────────────────────────────────────────

describe('the rendered document', () => {
  const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });

  it('is a complete HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charSet="utf-8"/>');
  });

  it('has exactly one H1, carrying the resource title', () => {
    const h1s = html.match(/<h1[^>]*>/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(html).toContain('What should I do when I cannot sleep?</h1>');
  });

  it('contains the body text without any JavaScript having run', () => {
    expect(html).toContain('Get out of bed, keep the lights low, and do something dull.');
    expect(html).toContain('Why lying there makes it worse');
  });

  it('contains crawlable links, including internal resource links', () => {
    expect(html).toContain('href="/resources/sleep-and-anxiety"');
    expect(html).toContain('href="/resources"');
    expect(html).toContain('href="/how-it-works"');
  });

  it('inlines the stylesheet so the page needs no second request to be correct', () => {
    expect(html).toContain('<style>');
    // The shell rules now precede the page rules, so assert presence rather than position.
    expect(html).toContain('.sol-page{');
  });

  it('renders no raw HTML from content — every value is escaped', () => {
    const hostile = answerDetail({
      title: '<script>alert(1)</script> Sleep',
      description: 'Ends with </style> and <b>markup</b>',
    });
    const output = renderResourceDetail({ origin: ORIGIN, detail: hostile, assets: NO_ASSETS });

    expect(output).not.toContain('<script>alert(1)</script>');
    expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes `<` inside JSON-LD so a title cannot close the script tag', () => {
    const hostile = answerDetail({ title: 'Sleep </script><script>alert(1)</script>' });
    const output = renderResourceDetail({ origin: ORIGIN, detail: hostile, assets: NO_ASSETS });

    const scripts = output.match(/<script type="application\/ld\+json">/g) ?? [];
    // Three documents: Article, BreadcrumbList, FAQPage — and no injected fourth.
    expect(scripts).toHaveLength(3);
    expect(serialiseJsonLd({ t: '</script>' })).not.toContain('</script>');
  });

  it('emits the SPA bundle when a manifest resolved, and stays valid when it did not', () => {
    const withAssets = renderResourceDetail({
      origin: ORIGIN,
      detail: answerDetail(),
      assets: { scripts: ['/assets/index-abc.js'], styles: ['/assets/index-abc.css'] },
    });
    expect(withAssets).toContain('src="/assets/index-abc.js"');
    expect(withAssets).toContain('href="/assets/index-abc.css"');

    // Without a manifest the page still has everything that matters.
    expect(html).not.toContain('<script type="module"');
    expect(html).toContain('<h1');
  });
});

// ─── Metadata ────────────────────────────────────────────────────────────────

describe('metadata', () => {
  const detail = answerDetail();
  const html = renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });

  it('uses the stored title with the Solace suffix', () => {
    expect(html).toContain('<title>What should I do when I cannot sleep? | Solace</title>');
    expect(pageTitle('Something | Solace')).toBe('Something | Solace');
  });

  it('uses the stored meta description verbatim', () => {
    expect(metaContent(html, 'name', 'description')).toBe(detail.description);
  });

  it('omits the description rather than inventing one when it is missing', () => {
    const bare = renderResourceDetail({
      origin: ORIGIN,
      detail: answerDetail({ description: null }),
      assets: NO_ASSETS,
    });
    expect(metaContent(bare, 'name', 'description')).toBeNull();
    expect(metaContent(bare, 'property', 'og:description')).toBeNull();
  });

  it('emits an absolute canonical', () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://meetezri.com/resources/what-to-do-when-you-cannot-sleep"/>'
    );
  });

  it('honours a valid https canonical override', () => {
    const overridden = answerDetail({ canonicalUrlOverride: 'https://partner.example/piece' });
    expect(canonicalFor(ORIGIN, overridden)).toBe('https://partner.example/piece');
  });

  it('ignores a relative or http canonical override', () => {
    expect(canonicalFor(ORIGIN, answerDetail({ canonicalUrlOverride: '/somewhere' }))).toBe(
      'https://meetezri.com/resources/what-to-do-when-you-cannot-sleep'
    );
    expect(canonicalFor(ORIGIN, answerDetail({ canonicalUrlOverride: 'http://x.example' }))).toBe(
      'https://meetezri.com/resources/what-to-do-when-you-cannot-sleep'
    );
  });

  it('uses the STORED robots directive', () => {
    expect(metaContent(html, 'name', 'robots')).toBe('index,follow');

    const hidden = renderResourceDetail({
      origin: ORIGIN,
      detail: answerDetail({ robots: 'noindex,follow' }),
      assets: NO_ASSETS,
    });
    expect(metaContent(hidden, 'name', 'robots')).toBe('noindex,follow');
  });

  it('emits Open Graph and article dates', () => {
    expect(metaContent(html, 'property', 'og:type')).toBe('article');
    expect(metaContent(html, 'property', 'og:title')).toBe(detail.title);
    expect(metaContent(html, 'property', 'og:url')).toBe(
      'https://meetezri.com/resources/what-to-do-when-you-cannot-sleep'
    );
    expect(metaContent(html, 'property', 'og:image')).toBe('https://cdn.example.com/sleep.png');
    expect(metaContent(html, 'property', 'article:published_time')).toBe(detail.publishedAt);
    expect(metaContent(html, 'property', 'article:modified_time')).toBe(detail.updatedAt);
  });

  it('emits the same Twitter tags the rest of the site uses, and no invented ones', () => {
    expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(metaContent(html, 'name', 'twitter:title')).toBe(detail.title);
    expect(metaContent(html, 'name', 'twitter:image')).toBe('https://cdn.example.com/sleep.png');
    expect(html).not.toContain('twitter:label');
    expect(html).not.toContain('twitter:data');
  });

  it('falls back to a summary card when there is no image', () => {
    const noImage = resourceMetadata(ORIGIN, answerDetail({ featuredImageUrl: null }));
    const twitterCard = noImage.tags.find((tag) => tag.key === 'twitter:card');
    expect(twitterCard?.value).toBe('summary');
  });
});

describe('index metadata', () => {
  it('indexes the root library and canonicalises to itself', () => {
    const meta = libraryMetadata(ORIGIN, { page: 1, label: null, path: '/resources' });
    expect(meta.title).toBe('Resources | Solace');
    expect(meta.robots).toBe('index,follow');
    expect(meta.canonical).toBe('https://meetezri.com/resources');
  });

  it('marks filtered and paginated views noindex,follow', () => {
    const filtered = libraryMetadata(ORIGIN, {
      page: 1,
      label: 'Answer',
      path: '/resources?type=Answer',
    });
    expect(filtered.robots).toBe('noindex,follow');
    expect(filtered.canonical).toBe('https://meetezri.com/resources?type=Answer');
  });

  it('builds hrefs the SPA can reproduce exactly', () => {
    expect(libraryHref({})).toBe('/resources');
    expect(libraryHref({ page: 1 })).toBe('/resources');
    expect(libraryHref({ label: 'Insight' })).toBe('/resources?type=Insight');
    expect(libraryHref({ label: 'Insight', page: 3 })).toBe('/resources?type=Insight&page=3');
  });
});

// ─── Structured data ─────────────────────────────────────────────────────────

describe('structured data', () => {
  it('uses Article for an Answer, Article for an Insight and BlogPosting for an Article', () => {
    expect(articleTypeFor('Answer')).toBe('Article');
    expect(articleTypeFor('Insight')).toBe('Article');
    expect(articleTypeFor('Article')).toBe('BlogPosting');
  });

  it('never invents an AEO or GEO schema type', () => {
    for (const detail of [answerDetail(), insightDetail(), articleDetail()]) {
      const html = renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });
      for (const document of jsonLdFrom(html)) {
        expect(JSON.stringify(document)).not.toMatch(/"@type":\s*"(AEO|GEO)/i);
      }
    }
  });

  it('emits the Article properties Google actually consumes', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    const article = jsonLdFrom(html).find((document) => document['@type'] === 'Article')!;

    expect(article.headline).toBe('What should I do when I cannot sleep?');
    expect(article.datePublished).toBe('2026-03-12T09:00:00.000Z');
    expect(article.dateModified).toBe('2026-03-14T09:00:00.000Z');
    expect(article.author).toEqual({
      '@type': 'Person',
      name: 'Dr Amara Reid',
      jobTitle: 'Clinical psychologist',
    });
    expect(article.publisher).toEqual({
      '@type': 'Organization',
      name: 'Solace',
      url: 'https://meetezri.com/',
    });
    expect(article.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://meetezri.com/resources/what-to-do-when-you-cannot-sleep',
    });
    expect(article.image).toBe('https://cdn.example.com/sleep.png');
  });

  it('prefers the snippet answer as the Article description for an Answer', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    const article = jsonLdFrom(html).find((document) => document['@type'] === 'Article')!;
    expect(article.description).toContain('Get out of bed');
  });

  it('omits reviewedBy when there is no review date', () => {
    const html = renderResourceDetail({
      origin: ORIGIN,
      detail: answerDetail({ reviewedAt: null }),
      assets: NO_ASSETS,
    });
    const article = jsonLdFrom(html).find((document) => document['@type'] === 'Article')!;
    expect(article.reviewedBy).toBeUndefined();
  });

  it('never manufactures a job title for a person without one', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    const article = jsonLdFrom(html).find((document) => document['@type'] === 'Article')!;
    expect(article.reviewedBy).toEqual({ '@type': 'Person', name: 'Sam Okafor' });
  });

  it('emits FAQPage from a FAQ block', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    const faq = jsonLdFrom(html).find((document) => document['@type'] === 'FAQPage')!;

    expect(faq.mainEntity).toHaveLength(1);
    expect(faq.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Should I check the time?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No — clock-watching raises the pressure to fall asleep.',
      },
    });
  });

  it('omits FAQPage entirely when there is no FAQ block', () => {
    expect(faqSchema(articleDetail())).toBeNull();
  });

  it('omits FAQPage when every item is empty rather than emitting a hollow one', () => {
    const empty = answerDetail({
      body: {
        version: 1,
        blocks: [{ id: 'f', type: 'faq', items: [{ id: 'i', question: '  ', answer: [] }] }],
      },
    });
    expect(faqSchema(empty)).toBeNull();
  });

  it('emits a BreadcrumbList matching the visible breadcrumbs', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    const crumbs = jsonLdFrom(html).find((document) => document['@type'] === 'BreadcrumbList')!;

    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://meetezri.com/' },
      { '@type': 'ListItem', position: 2, name: 'Resources', item: 'https://meetezri.com/resources' },
      { '@type': 'ListItem', position: 3, name: 'What should I do when I cannot sleep?' },
    ]);

    expect(html).toContain('aria-label="Breadcrumb"');
  });

  it('gives the index a CollectionPage and a breadcrumb, but never an Article', () => {
    const html = renderResourcesIndex({
      origin: ORIGIN,
      items: [card()],
      total: 1,
      page: 1,
      pageSize: 12,
      label: null,
      assets: NO_ASSETS,
    });
    const types = jsonLdFrom(html).map((document) => document['@type']);

    expect(types).toEqual(['CollectionPage', 'BreadcrumbList']);
    expect(types).not.toContain('Article');
    expect(types).not.toContain('BlogPosting');
  });
});

// ─── Type-specific presentation ──────────────────────────────────────────────

describe('type-specific public presentation', () => {
  it('leads an Answer with its direct answer and shows the primary question', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    expect(html).toContain('aria-label="Direct answer"');
    expect(html).toContain('What should I do when I cannot sleep?</p>');
  });

  it('shows an Insight citation summary and key statements, never internal GEO fields', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: insightDetail(), assets: NO_ASSETS });

    expect(html).toContain('Talking aloud reorganises a worry into a sequence, which makes it smaller.');
    expect(html).toContain('Naming a feeling reduces its intensity.');
    expect(html).toContain('This is not a substitute for therapy.');
    expect(html).not.toContain('coreMessage');
    expect(html).not.toContain('citationGoal');
  });

  it('gives an Article a table of contents when it has enough headings', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: articleDetail(), assets: NO_ASSETS });
    expect(html).toContain('On this page');
    expect(html).toContain('href="#prepare"');
  });

  it('omits the contents list when there is nothing to navigate', () => {
    const short = articleDetail({
      body: { version: 1, blocks: [{ id: 'p', type: 'paragraph', content: [{ text: 'Short.' }] }] },
    });
    const html = renderResourceDetail({ origin: ORIGIN, detail: short, assets: NO_ASSETS });
    expect(html).not.toContain('On this page');
  });

  it('renders an accessible table with scoped headers', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: articleDetail(), assets: NO_ASSETS });
    expect(html).toContain('<th scope="col">Instead of</th>');
    expect(html).toContain('<caption>What to say</caption>');
    expect(html).toContain('class="sol-table-scroll"');
  });

  it('renders FAQ answers in the DOM rather than behind a collapsed control', () => {
    const html = renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS });
    expect(html).toContain('No — clock-watching raises the pressure to fall asleep.');
    // Scoped to the FAQ block: the site header's mobile menu is a <details> disclosure, which is
    // unrelated to whether FAQ answers are collapsed.
    const faqSection = html.slice(html.indexOf('class=\"sol-faq\"'));
    expect(faqSection.slice(0, faqSection.indexOf('</section>'))).not.toContain('<details');
  });
});

// ─── Terminology guard ───────────────────────────────────────────────────────

describe('public terminology', () => {
  const pages: Array<[string, string]> = [
    ['Answer detail', renderResourceDetail({ origin: ORIGIN, detail: answerDetail(), assets: NO_ASSETS })],
    ['Insight detail', renderResourceDetail({ origin: ORIGIN, detail: insightDetail(), assets: NO_ASSETS })],
    ['Article detail', renderResourceDetail({ origin: ORIGIN, detail: articleDetail(), assets: NO_ASSETS })],
    [
      'Library',
      renderResourcesIndex({
        origin: ORIGIN,
        items: [card(), card({ slug: 'b', label: 'Insight' }), card({ slug: 'c', label: 'Article' })],
        total: 3,
        page: 1,
        pageSize: 12,
        label: null,
        assets: NO_ASSETS,
      }),
    ],
    ['404', renderNotFound({ origin: ORIGIN, path: '/resources/nope', assets: NO_ASSETS })],
  ];

  it.each(pages)('%s exposes no internal type or strategy name', (_name, html) => {
    for (const term of FORBIDDEN_TERMS) {
      expect(html).not.toContain(term);
    }
  });

  it('uses only the three public labels', () => {
    const html = renderResourcesIndex({
      origin: ORIGIN,
      items: [card({ label: 'Answer' }), card({ slug: 'b', label: 'Insight' }), card({ slug: 'c', label: 'Article' })],
      total: 3,
      page: 1,
      pageSize: 12,
      label: null,
      assets: NO_ASSETS,
    });

    expect(html).toContain('>Answer</p>');
    expect(html).toContain('>Insight</p>');
    expect(html).toContain('>Article</p>');
  });

  it('splits the library by public label only, never into strategy sections', () => {
    const html = renderResourcesIndex({
      origin: ORIGIN,
      items: [card()],
      total: 1,
      page: 1,
      pageSize: 12,
      label: null,
      assets: NO_ASSETS,
    });
    expect(html).toContain('>All<');
    expect(html).toContain('>Answers<');
    expect(html).toContain('>Insights<');
    expect(html).toContain('>Articles<');
  });

  it('keeps internal names out of the sitemap and robots.txt', () => {
    const sitemap = buildSitemap({ origin: ORIGIN, resources: [{ ...card(), robots: 'index,follow' }] });
    const robots = buildRobots(ORIGIN);
    for (const term of FORBIDDEN_TERMS) {
      expect(sitemap).not.toContain(term);
      expect(robots).not.toContain(term);
    }
  });
});

// ─── Disclosure ──────────────────────────────────────────────────────────────

describe('disclosure protection', () => {
  /**
   * The serializer's output is the only thing the renderer sees, so internal fields are absent by
   * construction. This test proves it anyway, by attaching sentinels to a fixture as if a
   * serializer regression had let them through, and asserting the renderer has no code path that
   * would print them.
   */
  const contaminated = {
    ...answerDetail(),
    editorial: { note: SENTINELS.editorialNote, kpi: SENTINELS.kpi },
    editorialRef: SENTINELS.editorialRef,
    tags: [SENTINELS.tag],
    status: 'published',
    approvals: { founder: SENTINELS.approvalGate },
    scheduledFor: SENTINELS.scheduledFor,
    createdBy: SENTINELS.profileId,
    updatedBy: SENTINELS.profileId,
  } as any;

  const html = renderResourceDetail({ origin: ORIGIN, detail: contaminated, assets: NO_ASSETS });

  it.each(ALL_SENTINELS)('never emits the sentinel %s', (sentinel) => {
    expect(html).not.toContain(sentinel);
  });

  it('exposes no internal field name in the HTML', () => {
    for (const field of [
      'editorialRef',
      'editorial_ref',
      'scheduledFor',
      'scheduled_for',
      'approvals',
      'createdBy',
      'updatedBy',
      'currentRevisionNumber',
      'deletedAt',
    ]) {
      expect({ field, present: html.includes(field) }).toEqual({ field, present: false });
    }
  });

  it('exposes no author email or profile id', () => {
    expect(html).not.toContain('@internal.example');
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('keeps sentinels out of the JSON-LD too', () => {
    const serialised = JSON.stringify(jsonLdFrom(html));
    for (const sentinel of ALL_SENTINELS) {
      expect(serialised).not.toContain(sentinel);
    }
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

describe('the 404 page', () => {
  const html = renderNotFound({ origin: ORIGIN, path: '/resources/does-not-exist', assets: NO_ASSETS });

  it('is a real Solace page with a way back', () => {
    expect(html).toContain('<h1>We could not find that page</h1>');
    expect(html).toContain('href="/resources"');
  });

  it('is noindex,nofollow', () => {
    expect(metaContent(html, 'name', 'robots')).toBe('noindex,nofollow');
  });

  it('reveals nothing about why the resource is unavailable', () => {
    for (const word of ['draft', 'unpublished', 'archived', 'approved', 'review', 'deleted']) {
      expect({ word, present: html.toLowerCase().includes(word) }).toEqual({ word, present: false });
    }
  });
});

// ─── Sitemap and robots ──────────────────────────────────────────────────────

describe('sitemap', () => {
  const xml = buildSitemap({
    origin: ORIGIN,
    resources: [
      { ...card(), robots: 'index,follow' },
      { ...card({ slug: 'second', updatedAt: null, publishedAt: '2026-01-02T00:00:00.000Z' }), robots: 'index,follow' },
    ],
  });

  it('is well-formed and declares the sitemap namespace', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
  });

  it('includes the static public routes and /resources', () => {
    expect(xml).toContain('<loc>https://meetezri.com/</loc>');
    expect(xml).toContain('<loc>https://meetezri.com/resources</loc>');
    expect(xml).toContain('<loc>https://meetezri.com/privacy</loc>');
  });

  it('includes every supplied published resource with a lastmod', () => {
    expect(xml).toContain('<loc>https://meetezri.com/resources/what-to-do-when-you-cannot-sleep</loc>');
    expect(xml).toContain('<lastmod>2026-03-14</lastmod>');
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>');
  });

  it('never lists admin, member, preview or auth routes', () => {
    for (const path of ['/admin', '/app', '/onboarding', '/preview', '/login']) {
      expect({ path, present: xml.includes(`<loc>https://meetezri.com${path}`) }).toEqual({
        path,
        present: false,
      });
    }
  });

  it('excludes noindex resources', () => {
    expect(isIndexable('index,follow')).toBe(true);
    expect(isIndexable('noindex,follow')).toBe(false);
    expect(isIndexable('noindex,nofollow')).toBe(false);
    expect(isIndexable(null)).toBe(true);
  });

  it('escapes XML in slugs', () => {
    expect(escapeXml(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
    const hostile = buildSitemap({
      origin: ORIGIN,
      resources: [{ ...card({ slug: 'a&b' }), robots: 'index,follow' }],
    });
    expect(hostile).toContain('/resources/a&amp;b');
    expect(hostile).not.toContain('/resources/a&b<');
  });
});

describe('robots.txt', () => {
  const robots = buildRobots(ORIGIN);

  it('allows crawling and points at the sitemap', () => {
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /resources');
    expect(robots).toContain('Sitemap: https://meetezri.com/sitemap.xml');
  });

  it('does NOT block the AI crawlers this content is written for', () => {
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect({ bot, blocked: robots.includes(bot) }).toEqual({ bot, blocked: false });
    }
  });

  it('keeps admin and member areas out of the crawl', () => {
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /app');
    expect(robots).toContain('Disallow: /onboarding');
  });
});

// ─── Asset manifest ──────────────────────────────────────────────────────────

describe('asset manifest', () => {
  it('extracts same-origin module scripts and stylesheets', () => {
    const html = `<html><head>
      <script type="module" crossorigin src="/assets/index-abc.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-abc.css">
    </head></html>`;
    expect(parseAssets(html)).toEqual({
      scripts: ['/assets/index-abc.js'],
      styles: ['/assets/index-abc.css'],
    });
  });

  it('ignores cross-origin and protocol-relative sources', () => {
    const html = `<script type="module" src="https://evil.example/x.js"></script>
      <script type="module" src="//evil.example/y.js"></script>
      <link rel="stylesheet" href="https://evil.example/x.css">`;
    expect(parseAssets(html)).toEqual({ scripts: [], styles: [] });
  });
});
