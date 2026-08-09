/**
 * Render layer — ARCHITECTURE GUARDS.
 *
 * Like the Content Hub guards, these protect DECISIONS rather than behaviour: each one guards
 * something a later change would otherwise undo silently, and would be discovered by a reader on
 * the public site rather than by a failing test.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { PublicResource, PublicResourceCard } from '@meetezri/public-content';
import type { PublicCard, PublicDetail } from '../../content-hub/content-hub.public.schema';
import { PUBLIC_CONTRACT_VERIFIED } from '../../content-hub/content-hub.public.contract';
import type {
  resolvePublishedContent,
  resolvePublishedList,
  resolveSitemapEntries,
} from '../../content-hub/content-hub.read.service';
import { STATIC_PUBLIC_ROUTES } from '../sitemap';

const RENDER_DIR = join(__dirname, '..');

function renderFiles(): Array<{ name: string; source: string; code: string }> {
  return readdirSync(RENDER_DIR)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => {
      const source = readFileSync(join(RENDER_DIR, name), 'utf8');
      // Guards run against code, not prose — several of these files explain the rule in a comment.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      return { name, source, code };
    });
}

describe('the render layer never bypasses the public read seam', () => {
  it('imports no Prisma client anywhere', () => {
    for (const file of renderFiles()) {
      expect({ file: file.name, bad: /lib\/prisma|prisma\./.test(file.code) }).toEqual({
        file: file.name,
        bad: false,
      });
    }
  });

  it('never calls the serializer directly — that is the read seam’s job', () => {
    for (const file of renderFiles()) {
      expect({ file: file.name, bad: /\b(serializeDetail|serializeCard)\s*\(/.test(file.code) }).toEqual(
        { file: file.name, bad: false }
      );
    }
  });

  it('reads content only through the approved seam functions', () => {
    const routes = renderFiles().find((file) => file.name === 'render.routes.ts')!;
    expect(routes.code).toContain('content-hub.read.service');

    // Only these three. Notably NOT `resolvePreviewContent`, which returns unpublished content
    // and must never be reachable from a public route.
    expect(routes.code).toContain('resolvePublishedContent');
    expect(routes.code).toContain('resolvePublishedList');
    expect(routes.code).toContain('resolveSitemapEntries');
    expect(routes.code).not.toContain('resolvePreviewContent');
  });

  it('declares no authenticate or authorize preHandler', () => {
    const routes = renderFiles().find((file) => file.name === 'render.routes.ts')!;
    expect(routes.code).not.toContain('app.authenticate');
    expect(routes.code).not.toContain('app.authorize');
  });
});

describe('the renderer is shared, not duplicated', () => {
  it('renders public pages from @meetezri/public-content rather than local components', () => {
    const detail = renderFiles().find((file) => file.name === 'renderResourceDetail.tsx')!;
    const index = renderFiles().find((file) => file.name === 'renderResourcesIndex.tsx')!;

    expect(detail.code).toContain("from '@meetezri/public-content'");
    expect(index.code).toContain("from '@meetezri/public-content'");
  });

  it('defines no block rendering of its own', () => {
    // A `switch (block.type)` here would be a second renderer, and the two would drift.
    for (const file of renderFiles()) {
      expect({ file: file.name, bad: /switch\s*\(\s*block\.type/.test(file.code) }).toEqual({
        file: file.name,
        bad: false,
      });
    }
  });

  it('uses dangerouslySetInnerHTML only for the stylesheet and JSON-LD', () => {
    const offenders = renderFiles()
      .filter((file) => file.code.includes('dangerouslySetInnerHTML'))
      .map((file) => file.name);

    // Both remaining uses are in the document shell: a `<style>` element (whose children must not
    // be React-escaped) and `<script type="application/ld+json">` (escaped by `serialiseJsonLd`).
    // Never a content field.
    expect(offenders).toEqual(['renderDocument.tsx']);
  });
});

describe('canonical URLs come from configuration, never from the request', () => {
  it('does not derive the origin from a request header', () => {
    const routes = renderFiles().find((file) => file.name === 'render.routes.ts')!;
    for (const header of ['request.headers.host', 'headers.origin', 'x-web-base-url', 'referer']) {
      expect({ header, present: routes.code.includes(header) }).toEqual({ header, present: false });
    }
  });

  it('does not use getWebBaseUrlFromRequest, which prefers caller-supplied headers', () => {
    const routes = renderFiles().find((file) => file.name === 'render.routes.ts')!;
    expect(routes.code).not.toContain('getWebBaseUrlFromRequest');
  });
});

describe('the sitemap invites only public routes', () => {
  it('lists no admin, member, onboarding or auth path', () => {
    for (const entry of STATIC_PUBLIC_ROUTES) {
      expect({ path: entry.path, bad: /^\/(admin|app|onboarding|login|signup|auth)\b/.test(entry.path) })
        .toEqual({ path: entry.path, bad: false });
    }
  });
});

/**
 * The read-seam contract.
 *
 * THIS GUARD WAS TOO WEAK AND A DEPLOY PROVED IT. The previous version asserted
 * `PublicDetail → PublicResource`, but `PublicDetail` was an alias of the schema type — so the
 * guard was really checking an alias against itself, and it passed happily while the value the
 * renderer actually receives had drifted. It never touched `resolvePublishedContent`.
 *
 * These assertions instead derive the types from the REAL return signatures of the three read-seam
 * functions the renderer calls, so they describe the exact objects passed to `ResourceArticle`,
 * `ResourcesLibrary` and `buildSitemap`. If the seam ever returns something broader than the
 * renderer contract, compilation fails here first.
 *
 * The optionality canary lives in `content-hub.public.contract.ts`, next to the schema it watches.
 */
type Assert<Condition extends true> = Condition;
type Extends<A, B> = [A] extends [B] ? true : false;

/** Exactly what `renderResourceDetail` passes to `ResourceArticle`. */
type ResolvedPublished = NonNullable<Awaited<ReturnType<typeof resolvePublishedContent>>>;
/** Exactly what `renderResourcesIndex` passes to `ResourcesLibrary`. */
type ResolvedCard = Awaited<ReturnType<typeof resolvePublishedList>>['items'][number];
/** Exactly what the sitemap route passes to `buildSitemap`. */
type ResolvedSitemapRow = Awaited<ReturnType<typeof resolveSitemapEntries>>[number];

type _SeamDetailFitsRenderer = Assert<Extends<ResolvedPublished, PublicResource>>;
type _SeamCardFitsRenderer = Assert<Extends<ResolvedCard, PublicResourceCard>>;
type _SeamSitemapRowFitsRenderer = Assert<Extends<ResolvedSitemapRow, PublicResourceCard>>;

/** Required keys of the seam's own return type — never `never`, or a field went optional. */
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];

type _SeamSlugRequired = Assert<Extends<'slug', RequiredKeys<ResolvedPublished>>>;
type _SeamLabelRequired = Assert<Extends<'label', RequiredKeys<ResolvedPublished>>>;
type _SeamTitleRequired = Assert<Extends<'title', RequiredKeys<ResolvedPublished>>>;
type _SeamBodyRequired = Assert<Extends<'body', RequiredKeys<ResolvedPublished>>>;
type _SeamCardSlugRequired = Assert<Extends<'slug', RequiredKeys<ResolvedCard>>>;

describe('the read seam satisfies the renderer contract', () => {
  it('passes the exact resolvePublishedContent return type to the renderer', () => {
    // The type-level assertions above are the real test — this body exists so the guard is a
    // reported test rather than a silent compile step, and so the value flow is exercised too.
    const toRenderer = (input: ResolvedPublished): PublicResource => input;
    const toCard = (input: ResolvedCard): PublicResourceCard => input;
    const toSitemapCard = (input: ResolvedSitemapRow): PublicResourceCard => input;

    expect([toRenderer, toCard, toSitemapCard].every((fn) => typeof fn === 'function')).toBe(true);
  });

  it('keeps the aliased public types identical to the seam types', () => {
    const detailAlias = (input: PublicDetail): ResolvedPublished => input;
    const cardAlias = (input: PublicCard): ResolvedCard => input;

    expect(typeof detailAlias).toBe('function');
    expect(typeof cardAlias).toBe('function');
  });

  it('binds the Zod schemas to the stated public types in both directions', () => {
    // Importing the module is what runs the schema↔type assertions in
    // `content-hub.public.contract.ts`; the constant just proves it was not elided.
    expect(PUBLIC_CONTRACT_VERIFIED).toBe(true);
  });
});
