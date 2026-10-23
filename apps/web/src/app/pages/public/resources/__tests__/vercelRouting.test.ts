import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/routing/spaRouteManifest.json';
import { isSpaRoute } from '@/app/routing/spaRouteManifest';

interface Rewrite {
  source: string;
  destination: string;
}

const webRoot = join(__dirname, '..', '..', '..', '..', '..', '..');
const config = JSON.parse(readFileSync(join(webRoot, 'vercel.json'), 'utf8')) as {
  redirects: Array<{ source: string; destination: string; permanent: boolean }>;
  rewrites: Rewrite[];
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

function sourcePattern(source: string): RegExp {
  const segments = source.split('/').map((segment) => {
    if (!segment.startsWith(':')) {
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (segment.endsWith('*')) return '.*';
    const custom = segment.match(/^:[^(]+\((.+)\)$/);
    return custom ? `(?:${custom[1]})` : '[^/]+';
  });
  return new RegExp(`^${segments.join('/')}$`);
}

function destinationFor(pathname: string): string | undefined {
  return config.rewrites.find((rule) => sourcePattern(rule.source).test(pathname))?.destination;
}

const dynamicSample = (route: string) => route.replace(/:[^/]+/g, 'sample-id');

describe('Cycle 1C route inventory', () => {
  it('keeps the shared SPA allowlist synchronized with React Router', () => {
    const source = readFileSync(join(webRoot, 'src', 'app', 'App.tsx'), 'utf8')
      .replace(/{\/\*[\s\S]*?\*\/}/g, '');
    const literalRoutes = [...source.matchAll(/\bpath="(\/[^"*]+)"/g)].map((match) => match[1]);

    for (const route of [...manifest.exactRoutes, ...manifest.dynamicRoutes]) {
      expect(source, `missing React route ${route}`).toContain(`path="${route}"`);
    }
    expect(source).toContain('path="/onboarding"');
    expect(source).toContain('path="/app/*"');

    for (const route of literalRoutes) {
      if (['/how-it-works', '/talk-it-out', '/about', '/safety', '/privacy', '/terms', '/pricing', '/resources', '/resources/:slug'].includes(route)) continue;
      expect(isSpaRoute(dynamicSample(route)), `unclassified React route ${route}`).toBe(true);
    }
  });

  it.each(manifest.exactRoutes)('routes exact SPA deep link %s to spa.html', (pathname) => {
    expect(destinationFor(pathname)).toBe('/spa.html');
  });

  it.each(manifest.dynamicRoutes)('routes dynamic SPA deep link %s to spa.html', (route) => {
    expect(destinationFor(dynamicSample(route))).toBe('/spa.html');
  });

  it.each([
    '/onboarding',
    '/onboarding/welcome',
    '/onboarding/a-future-step',
    '/app',
    '/app/dashboard',
    '/app/a-future-member-page',
  ])('preserves the intentional SPA prefix for %s', (pathname) => {
    expect(isSpaRoute(pathname)).toBe(true);
    expect(destinationFor(pathname)).toBe('/spa.html');
  });
});

describe('Vercel routing boundaries', () => {
  it('removes the blanket SPA catch-all', () => {
    expect(config.rewrites.find((rule) => rule.source === '/(.*)')).toBeUndefined();
  });

  it.each([
    '/definitely-not-a-real-solace-page',
    '/unknown/with/multiple/segments',
    '/auth/not-a-real-action',
    '/invite/not-a-real-invitation',
    '/admin/not-a-real-admin-page',
    '/admin/content-hub/item/extra',
    '/profile/person/extra',
    '/error/not-real',
    '/dev/not-real',
  ])('does not rewrite unknown path %s to spa.html', (pathname) => {
    expect(isSpaRoute(pathname)).toBe(false);
    expect(destinationFor(pathname)).toBeUndefined();
  });

  it.each([
    ['/', undefined],
    ['/how-it-works', '/_public/how-it-works.html'],
    ['/talk-it-out', '/_public/talk-it-out.html'],
    ['/about', '/_public/about.html'],
    ['/safety', '/_public/safety.html'],
    ['/pricing', '/_public/pricing.html'],
    ['/privacy', '/_public/privacy.html'],
    ['/terms', '/_public/terms.html'],
    ['/early-access', '/_public/early-access.html'],
  ])('preserves public routing for %s', (pathname, destination) => {
    expect(destinationFor(pathname)).toBe(destination);
  });

  it.each([
    ['/api/status', 'https://meetezri-live-api.vercel.app/api/:path*'],
    ['/resources', 'https://meetezri-live-api.vercel.app/resources'],
    ['/resources/a-published-slug', 'https://meetezri-live-api.vercel.app/resources/:slug'],
    ['/sitemap.xml', 'https://meetezri-live-api.vercel.app/sitemap.xml'],
    ['/robots.txt', 'https://meetezri-live-api.vercel.app/robots.txt'],
  ])('preserves infrastructure routing for %s', (pathname, destination) => {
    expect(destinationFor(pathname)).toBe(destination);
  });

  it('keeps the permanent /home redirect; Vercel preserves its query string', () => {
    expect(config.redirects).toContainEqual({ source: '/home', destination: '/', permanent: true });
  });

  it('retains private and internal-artifact noindex headers', () => {
    for (const source of [
      '/login', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/landing-page',
      '/auth/(.*)', '/invite/(.*)', '/onboarding', '/onboarding/(.*)', '/app', '/app/(.*)',
      '/admin/(.*)', '/profile/(.*)', '/error/(.*)', '/dev/(.*)', '/_public/(.*)',
    ]) {
      const matchingHeaders = config.headers
        .filter((entry) => entry.source === source)
        .flatMap((entry) => entry.headers);
      expect(matchingHeaders).toContainEqual({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive',
      });
    }
  });
});
