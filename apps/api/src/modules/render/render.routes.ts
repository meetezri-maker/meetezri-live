/**
 * Runtime server rendering for the public Resources pages.
 *
 * Registered at the ROOT of the API app (no `/api` prefix) because these paths are user-facing
 * URLs, not API endpoints: `apps/web/vercel.json` rewrites `/resources`, `/resources/*`,
 * `/sitemap.xml` and `/robots.txt` here, ahead of the SPA catch-all.
 *
 * Three properties this file must preserve:
 *
 *   1. NO AUTHENTICATION, and no `/api/admin` prefix — `plugins/auth.ts` keys privileged handling
 *      off that prefix, and these routes must never acquire it.
 *   2. NO USER-AGENT BRANCHING. There is not a single read of the UA header below. Chrome,
 *      GPTBot, ClaudeBot, PerplexityBot and Googlebot execute identical code and receive
 *      byte-identical HTML for the same URL and state. Cloaking is both dishonest and, for the
 *      answer engines this content targets, actively counterproductive.
 *   3. ALL READS GO THROUGH `content-hub.read.service.ts`. No Prisma here, no raw rows, no
 *      serializer bypass.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PublicLabel } from '@meetezri/public-content';
import {
  resolvePublishedContent,
  resolvePublishedList,
  resolveSitemapEntries,
} from '../content-hub/content-hub.read.service';
import { loadAssetManifest } from './assetManifest';
import { renderResourceDetail } from './renderResourceDetail';
import { renderNotFound, renderResourcesIndex } from './renderResourcesIndex';
import { buildRobots, buildSitemap } from './sitemap';

/**
 * Shared cache policy for public HTML and XML.
 *
 * `s-maxage` is the SHARED cache only — `max-age=0` keeps it out of the reader's browser cache,
 * so unpublishing takes effect for a returning visitor within the CDN window rather than being
 * pinned in their browser for a day. Five minutes bounds how long an unpublished resource can
 * keep serving; `stale-while-revalidate` keeps the page fast for the following day without
 * extending that window.
 */
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

/**
 * 404s cache for one minute only.
 *
 * A newly published slug is frequently requested moments before it exists (someone shares the URL
 * during the release). Caching that 404 for five minutes would hide the real page from everyone
 * behind the same CDN node.
 */
const NOT_FOUND_CACHE = 'public, max-age=0, s-maxage=60';

const PUBLIC_LABELS: PublicLabel[] = ['Answer', 'Insight', 'Article'];

/**
 * The public origin, used for canonicals, Open Graph URLs and the sitemap.
 *
 * Read from CONFIGURATION ONLY — never from the request. `getWebBaseUrlFromRequest` deliberately
 * is not used here: it prefers `Origin`/`Referer`/`X-Web-Base-Url`, which is right for email
 * redirects but wrong for a canonical tag, because a canonical derived from a caller-controlled
 * header is a canonical-injection bug. The API is also reached through a Vercel rewrite, so
 * `Host` is the web domain in production and the API domain when hit directly.
 *
 * `WEB_BASE_URL` is the repository's existing variable for "where the public site lives", so it
 * is reused rather than adding a second name for the same fact.
 */
function publicOrigin(): string {
  const configured = process.env.PUBLIC_SITE_ORIGIN || process.env.WEB_BASE_URL || process.env.CLIENT_URL;
  try {
    const url = new URL(String(configured));
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
  } catch {
    // fall through
  }
  return 'https://meetezri.com';
}

function parseLabel(value: unknown): PublicLabel | null {
  return typeof value === 'string' && (PUBLIC_LABELS as string[]).includes(value)
    ? (value as PublicLabel)
    : null;
}

function parsePage(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 500 ? parsed : 1;
}

function sendHtml(reply: FastifyReply, status: number, html: string, cache: string) {
  return reply
    .status(status)
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Cache-Control', cache)
    // The response embeds no per-user state, so it is safe in a shared cache. Saying so
    // explicitly stops a future auth plugin from silently making it private.
    .header('X-Robots-Tag', 'all')
    .send(html);
}

export async function renderRoutes(app: FastifyInstance) {
  // Same origin as the canonicals: the SPA bundle is served from the public site.
  const assetsFor = () => loadAssetManifest(publicOrigin());

  /** `/resources` — the unified public library. */
  app.get('/resources', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const label = parseLabel(query.type);
    const page = parsePage(query.page);
    const pageSize = 12;

    const [list, assets] = await Promise.all([
      resolvePublishedList({ page, pageSize, type: label ?? undefined }),
      assetsFor(),
    ]);

    return sendHtml(
      reply,
      200,
      renderResourcesIndex({
        origin: publicOrigin(),
        items: list.items,
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        label,
        assets,
      }),
      PUBLIC_CACHE
    );
  });

  /**
   * `/resources/:slug`.
   *
   * `resolvePublishedContent` returns null for anything not published, so draft, in-review,
   * approved-but-unpublished, unpublished, archived and soft-deleted content all produce the same
   * real 404 — never a 403, and never a 200 SPA shell.
   */
  app.get('/resources/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const origin = publicOrigin();

    if (!slug || slug.length > 200) {
      const assets = await assetsFor();
      return sendHtml(
        reply,
        404,
        renderNotFound({ origin, path: `/resources/${slug ?? ''}`, assets }),
        NOT_FOUND_CACHE
      );
    }

    const [detail, assets] = await Promise.all([resolvePublishedContent(slug), assetsFor()]);

    if (!detail) {
      return sendHtml(
        reply,
        404,
        renderNotFound({ origin, path: `/resources/${slug}`, assets }),
        NOT_FOUND_CACHE
      );
    }

    return sendHtml(reply, 200, renderResourceDetail({ origin, detail, assets }), PUBLIC_CACHE);
  });

  app.get('/sitemap.xml', async (_request: FastifyRequest, reply: FastifyReply) => {
    const resources = await resolveSitemapEntries();
    return reply
      .status(200)
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', PUBLIC_CACHE)
      .send(buildSitemap({ origin: publicOrigin(), resources }));
  });

  app.get('/robots.txt', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(200)
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Cache-Control', PUBLIC_CACHE)
      .send(buildRobots(publicOrigin()));
  });
}
