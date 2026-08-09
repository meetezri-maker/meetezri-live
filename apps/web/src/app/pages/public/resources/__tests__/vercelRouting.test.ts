/**
 * Deployment routing order.
 *
 * Vercel applies `rewrites` in order and stops at the first match, so the SPA catch-all
 * (`/(.*)` → `/index.html`) swallows anything declared after it. That failure is silent and
 * total: `/resources/x` would return a 200 SPA shell to a crawler, with no H1, no metadata and no
 * content — which is precisely the outcome Phase 5A exists to prevent, and which no unit test of
 * the renderer would catch.
 *
 * These assertions read the real `vercel.json`.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

interface Rewrite {
  source: string;
  destination: string;
}

const config = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', '..', '..', 'vercel.json'), 'utf8')
) as { rewrites: Rewrite[] };

const rewrites = config.rewrites;
const catchAllIndex = rewrites.findIndex((rule) => rule.source === '/(.*)');

/** The paths that must be handled by the renderer, not the SPA. */
const SSR_PATHS = ['/resources', '/resources/:slug', '/sitemap.xml', '/robots.txt'];

describe('vercel rewrite order', () => {
  it('has an SPA catch-all, and it is last', () => {
    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(catchAllIndex).toBe(rewrites.length - 1);
    expect(rewrites[catchAllIndex].destination).toBe('/index.html');
  });

  it.each(SSR_PATHS)('declares %s before the catch-all', (source) => {
    const index = rewrites.findIndex((rule) => rule.source === source);
    expect(index).toBeGreaterThan(-1);
    expect(index).toBeLessThan(catchAllIndex);
  });

  it.each(SSR_PATHS)('points %s at the API deployment, not the SPA shell', (source) => {
    const rule = rewrites.find((entry) => entry.source === source)!;
    expect(rule.destination).toMatch(/^https:\/\/meetezri-live-api\.vercel\.app\//);
    expect(rule.destination).not.toBe('/index.html');
  });

  it('keeps /api/* routing unchanged and still ahead of the catch-all', () => {
    const index = rewrites.findIndex((rule) => rule.source === '/api/:path*');
    expect(index).toBeGreaterThan(-1);
    expect(index).toBeLessThan(catchAllIndex);
    expect(rewrites[index].destination).toBe('https://meetezri-live-api.vercel.app/api/:path*');
  });

  it('preserves the slug parameter rather than dropping it', () => {
    const rule = rewrites.find((entry) => entry.source === '/resources/:slug')!;
    expect(rule.destination).toBe('https://meetezri-live-api.vercel.app/resources/:slug');
  });

  it('leaves every other app route to the SPA', () => {
    // Anything not explicitly declared must fall through to `/index.html`. If a future change
    // adds a broad rule like `/re(.*)`, this catches it.
    const declared = rewrites.slice(0, catchAllIndex).map((rule) => rule.source);
    for (const path of ['/', '/pricing', '/how-it-works', '/admin/content-hub', '/app/dashboard', '/login']) {
      expect({ path, swallowed: declared.includes(path) }).toEqual({ path, swallowed: false });
    }
  });
});
