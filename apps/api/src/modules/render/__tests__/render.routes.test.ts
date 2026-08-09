/**
 * Render ROUTES — status codes, headers, and human/bot parity.
 *
 * A bare Fastify instance with only the render plugin registered, so these test the route
 * contract rather than the whole app. The read seam is mocked; what it returns has already been
 * proved elsewhere. What matters here is what a client receives.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { renderRoutes } from '../render.routes';
import { resetAssetManifestCache } from '../assetManifest';
import { answerDetail, card } from './fixtures';

jest.mock('../../content-hub/content-hub.read.service', () => ({
  resolvePublishedContent: jest.fn(),
  resolvePublishedList: jest.fn(),
  resolveSitemapEntries: jest.fn(),
}));

const readSeam = jest.requireMock('../../content-hub/content-hub.read.service') as {
  resolvePublishedContent: jest.Mock;
  resolvePublishedList: jest.Mock;
  resolveSitemapEntries: jest.Mock;
};

/** A stand-in for every user agent under test. */
const AGENTS: Array<[string, string]> = [
  ['Chrome', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'],
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot'],
  ['ClaudeBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com'],
  ['PerplexityBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot'],
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
];

let app: FastifyInstance;

beforeAll(async () => {
  process.env.PUBLIC_SITE_ORIGIN = 'https://meetezri.com';
  app = Fastify();
  await app.register(renderRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  resetAssetManifestCache();
  // No web origin reachable in tests; the manifest fetch fails fast and the page is still valid,
  // which is exactly the production failure mode being relied on.
  readSeam.resolvePublishedContent.mockReset();
  readSeam.resolvePublishedList.mockReset();
  readSeam.resolveSitemapEntries.mockReset();
});

// ─── Status and headers ──────────────────────────────────────────────────────

describe('/resources/:slug', () => {
  it('returns 200 HTML for a published resource', async () => {
    readSeam.resolvePublishedContent.mockResolvedValue(answerDetail());

    const response = await app.inject({ method: 'GET', url: '/resources/what-to-do-when-you-cannot-sleep' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<h1>What should I do when I cannot sleep?</h1>');
  });

  it('returns a REAL 404 — not a 200 SPA shell and not a 403 — when the seam returns null', async () => {
    // The seam returns null for missing, draft, in_review, approved-but-unpublished, unpublished,
    // archived and soft-deleted alike. The route cannot tell them apart, which is the point.
    readSeam.resolvePublishedContent.mockResolvedValue(null);

    const response = await app.inject({ method: 'GET', url: '/resources/a-draft-item' });

    expect(response.statusCode).toBe(404);
    expect(response.statusCode).not.toBe(403);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('We could not find that page');
  });

  it('caches published HTML in the shared cache only, never the browser', async () => {
    readSeam.resolvePublishedContent.mockResolvedValue(answerDetail());
    const response = await app.inject({ method: 'GET', url: '/resources/x' });

    const cacheControl = String(response.headers['cache-control']);
    expect(cacheControl).toContain('s-maxage=300');
    expect(cacheControl).toContain('stale-while-revalidate=86400');
    // `max-age=0` is what lets an unpublish take effect for a returning reader.
    expect(cacheControl).toContain('max-age=0');
    expect(cacheControl).not.toContain('private');
  });

  it('caches a 404 briefly so a newly published slug is not hidden', async () => {
    readSeam.resolvePublishedContent.mockResolvedValue(null);
    const response = await app.inject({ method: 'GET', url: '/resources/not-yet' });

    expect(String(response.headers['cache-control'])).toContain('s-maxage=60');
    expect(String(response.headers['cache-control'])).not.toContain('s-maxage=300');
  });

  it('404s an over-long slug without touching the database', async () => {
    const response = await app.inject({ method: 'GET', url: `/resources/${'a'.repeat(300)}` });

    expect(response.statusCode).toBe(404);
    expect(readSeam.resolvePublishedContent).not.toHaveBeenCalled();
  });
});

describe('/resources', () => {
  it('renders the library', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({
      items: [card()],
      total: 1,
      page: 1,
      pageSize: 12,
    });

    const response = await app.inject({ method: 'GET', url: '/resources' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<h1>Solace Resources</h1>');
    expect(response.body).toContain('href="/resources/what-to-do-when-you-cannot-sleep"');
  });

  it('passes a public label filter to the seam, never an internal type', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });

    await app.inject({ method: 'GET', url: '/resources?type=Insight' });

    expect(readSeam.resolvePublishedList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 12,
      type: 'Insight',
    });
  });

  it('ignores an internal type string in the query', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });

    await app.inject({ method: 'GET', url: '/resources?type=geo_article' });

    expect(readSeam.resolvePublishedList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 12,
      type: undefined,
    });
  });

  it('clamps a hostile page parameter instead of trusting it', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });

    for (const page of ['0', '-5', 'abc', '999999']) {
      readSeam.resolvePublishedList.mockClear();
      await app.inject({ method: 'GET', url: `/resources?page=${page}` });
      expect(readSeam.resolvePublishedList.mock.calls[0][0].page).toBe(1);
    }
  });

  it('renders an empty library without an error', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });

    const response = await app.inject({ method: 'GET', url: '/resources' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('New resources are on the way');
  });
});

// ─── Human / bot parity ──────────────────────────────────────────────────────

describe('human and bot parity', () => {
  /** Strips only what legitimately varies between requests. */
  function normalise(html: string): string {
    return html.replace(/\s+/g, ' ').trim();
  }

  it('serves byte-identical HTML for a resource to every agent', async () => {
    readSeam.resolvePublishedContent.mockResolvedValue(answerDetail());

    const bodies = await Promise.all(
      AGENTS.map(async ([, ua]) => {
        const response = await app.inject({
          method: 'GET',
          url: '/resources/what-to-do-when-you-cannot-sleep',
          headers: { 'user-agent': ua },
        });
        return { status: response.statusCode, body: normalise(response.body) };
      })
    );

    const [first, ...rest] = bodies;
    for (const other of rest) {
      expect(other.status).toBe(first.status);
      expect(other.body).toBe(first.body);
    }
  });

  it('serves byte-identical HTML for the library to every agent', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({ items: [card()], total: 1, page: 1, pageSize: 12 });

    const bodies: string[] = [];
    for (const [, ua] of AGENTS) {
      const response = await app.inject({ method: 'GET', url: '/resources', headers: { 'user-agent': ua } });
      bodies.push(normalise(response.body));
    }

    expect(new Set(bodies).size).toBe(1);
  });

  it.each(AGENTS)('gives %s the full crawlable payload', async (_name, ua) => {
    readSeam.resolvePublishedContent.mockResolvedValue(answerDetail());

    const response = await app.inject({
      method: 'GET',
      url: '/resources/what-to-do-when-you-cannot-sleep',
      headers: { 'user-agent': ua },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<h1>');
    expect(response.body).toContain('Get out of bed, keep the lights low');
    expect(response.body).toContain('<link rel="canonical"');
    expect(response.body).toContain('application/ld+json');
    expect(response.body).toContain('href="/resources"');
    // Safety language and the CTA are shown to bots too — never hidden.
    expect(response.body).toContain('See how Solace works');
  });

  it('reads no user-agent header anywhere in the route module', () => {
    // The strongest available proof that cloaking is impossible: the code never looks.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'render.routes.ts'),
      'utf8'
    );
    const code = source
      .split('\n')
      .filter((line: string) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');

    expect(code).not.toMatch(/user-agent/i);
    expect(code).not.toMatch(/userAgent/);
  });
});

// ─── JavaScript-disabled ─────────────────────────────────────────────────────

describe('with JavaScript disabled', () => {
  it('serves a complete resource page in the raw response', async () => {
    readSeam.resolvePublishedContent.mockResolvedValue(answerDetail());

    const { body } = await app.inject({ method: 'GET', url: '/resources/x' });

    // Everything below is present in the bytes on the wire — no DOM, no hydration, no scripts run.
    expect(body).toContain('<h1>What should I do when I cannot sleep?</h1>');
    expect(body).toContain('Get out of bed, keep the lights low, and do something dull.');
    expect(body).toContain('<link rel="canonical" href="https://meetezri.com/resources/what-to-do-when-you-cannot-sleep"/>');
    expect(body).toContain('<meta name="description"');
    expect(body).toContain('"@type":"Article"');
    expect(body).toContain('href="/resources/sleep-and-anxiety"');
  });

  it('serves resource cards on the index in the raw response', async () => {
    readSeam.resolvePublishedList.mockResolvedValue({ items: [card()], total: 1, page: 1, pageSize: 12 });

    const { body } = await app.inject({ method: 'GET', url: '/resources' });

    expect(body).toContain('<h1>Solace Resources</h1>');
    expect(body).toContain('What should I do when I cannot sleep?</a>');
    expect(body).toContain('4 min read');
  });
});

// ─── Sitemap and robots routes ───────────────────────────────────────────────

describe('/sitemap.xml', () => {
  it('serves XML from the read seam', async () => {
    readSeam.resolveSitemapEntries.mockResolvedValue([{ ...card(), robots: 'index,follow' }]);

    const response = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/xml');
    expect(response.body).toContain('<loc>https://meetezri.com/resources/what-to-do-when-you-cannot-sleep</loc>');
    expect(String(response.headers['cache-control'])).toContain('s-maxage=300');
  });

  it('still serves the static routes when there is no content', async () => {
    readSeam.resolveSitemapEntries.mockResolvedValue([]);

    const response = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<loc>https://meetezri.com/resources</loc>');
  });
});

describe('/robots.txt', () => {
  it('serves plain text referencing the sitemap', async () => {
    const response = await app.inject({ method: 'GET', url: '/robots.txt' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('Sitemap: https://meetezri.com/sitemap.xml');
  });
});
