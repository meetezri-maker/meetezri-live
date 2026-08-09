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
 * The serializer contract.
 *
 * `PublicDetail` is inferred from the API's zod response schema — the RUNTIME truth, which Fastify
 * validates responses against. `PublicResource` is the VIEW truth the shared renderer consumes.
 * These assignments are the compile-time proof that the two agree; if a serializer field is
 * renamed or dropped, this file fails to compile rather than the public page rendering blanks.
 */
describe('serializer output satisfies the shared view contract', () => {
  it('type-checks PublicDetail as a PublicResource', () => {
    const assertDetail = (input: PublicDetail): PublicResource => input;
    const assertCard = (input: PublicCard): PublicResourceCard => input;

    expect(typeof assertDetail).toBe('function');
    expect(typeof assertCard).toBe('function');
  });
});
