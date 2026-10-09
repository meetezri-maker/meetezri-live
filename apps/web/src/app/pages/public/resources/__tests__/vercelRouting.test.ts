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
) as {
  rewrites: Rewrite[];
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

const rewrites = config.rewrites;
const catchAllIndex = rewrites.findIndex((rule) => rule.source === '/(.*)');

/** The paths that must be handled by the renderer, not the SPA. */
const SSR_PATHS = ['/resources', '/resources/:slug', '/sitemap.xml', '/robots.txt'];

describe('vercel rewrite order', () => {
  it('has an SPA catch-all, and it is last', () => {
    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(catchAllIndex).toBe(rewrites.length - 1);
    expect(rewrites[catchAllIndex].destination).toBe('/spa.html');
  });

  it.each(SSR_PATHS)('declares %s before the catch-all', (source) => {
    const index = rewrites.findIndex((rule) => rule.source === source);
    expect(index).toBeGreaterThan(-1);
    expect(index).toBeLessThan(catchAllIndex);
  });

  it.each(SSR_PATHS)('points %s at the API deployment, not the SPA shell', (source) => {
    const rule = rewrites.find((entry) => entry.source === source)!;
    expect(rule.destination).toMatch(/^https:\/\/meetezri-live-api\.vercel\.app\//);
    expect(rule.destination).not.toBe('/spa.html');
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

  it('maps the six public routes to protected prerender artifacts', () => {
    const expected = {
      '/': '/_public/home.html',
      '/how-it-works': '/_public/how-it-works.html',
      '/pricing': '/_public/pricing.html',
      '/privacy': '/_public/privacy.html',
      '/terms': '/_public/terms.html',
      '/early-access': '/_public/early-access.html',
    };
    for (const [source, destination] of Object.entries(expected)) {
      expect(rewrites.find((rule) => rule.source === source)?.destination).toBe(destination);
    }
  });

  it('maps confirmed private deep links and the temporary fallback to spa.html', () => {
    for (const source of [
      '/login',
      '/signup',
      '/auth/:path*',
      '/onboarding',
      '/onboarding/:path*',
      '/app/:path*',
      '/admin/:path*',
      '/dev/:path*',
    ]) {
      expect(rewrites.find((rule) => rule.source === source)?.destination).toBe('/spa.html');
    }
    expect(rewrites[catchAllIndex].destination).toBe('/spa.html');
  });

  it('protects direct internal artifact requests from indexing', () => {
    const rule = config.headers.find((entry) => entry.source === '/_public/(.*)');
    expect(rule?.headers).toContainEqual({
      key: 'X-Robots-Tag',
      value: 'noindex, nofollow, noarchive',
    });
  });

  it('adds noindex headers to confirmed private and development routes', () => {
    for (const source of [
      '/login',
      '/signup',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/onboarding',
      '/auth/(.*)',
      '/invite/(.*)',
      '/app/(.*)',
      '/admin/(.*)',
      '/dev/(.*)',
    ]) {
      expect(config.headers.find((entry) => entry.source === source)?.headers).toContainEqual({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive',
      });
    }
  });
});
