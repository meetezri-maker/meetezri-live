import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ROUTE_PATHS,
  PUBLIC_ORGANIZATION_ID,
  PUBLIC_SEO_REGISTRY,
  PUBLIC_SITE_ORIGIN,
  PUBLIC_WEBSITE_ID,
  buildPublicStructuredData,
  getPublicSeo,
  serialisePublicJsonLd,
  validatePublicSeoRegistry,
} from '@meetezri/public-content';

describe('public SEO registry', () => {
  it('resolves only the nine exact allowlisted paths', () => {
    expect(PUBLIC_SEO_REGISTRY.map((entry) => entry.path)).toEqual(PUBLIC_ROUTE_PATHS);
    for (const path of PUBLIC_ROUTE_PATHS) expect(getPublicSeo(path)?.path).toBe(path);
    expect(getPublicSeo('/unknown')).toBeUndefined();
    expect(getPublicSeo('/pricing/')).toBeUndefined();
  });

  it('passes uniqueness, canonical ownership and robots invariants', () => {
    expect(() => validatePublicSeoRegistry()).not.toThrow();
    for (const entry of PUBLIC_SEO_REGISTRY) {
      expect(entry.canonicalUrl).toBe(new URL(entry.canonicalPath, `${PUBLIC_SITE_ORIGIN}/`).toString());
      expect(entry.openGraph.url).toBe(entry.canonicalUrl);
      if (!entry.indexable) expect(entry.robots).toMatch(/^noindex/);
    }
    expect(getPublicSeo('/early-access')).toMatchObject({
      indexable: false,
      robots: 'noindex,follow',
    });
    const terms = getPublicSeo('/terms');
    expect(terms).toMatchObject({
      indexable: false,
      robots: 'noindex,follow',
    });
    expect(terms).not.toHaveProperty('sitemap');
    for (const path of ['/talk-it-out', '/about', '/safety'] as const) {
      expect(getPublicSeo(path)).toMatchObject({ indexable: true, robots: 'index,follow' });
    }
  });

  it('emits one approved graph for each indexable route', () => {
    for (const entry of PUBLIC_SEO_REGISTRY) {
      const documents = buildPublicStructuredData(entry);
      if (!entry.indexable) {
        expect(documents).toEqual([]);
        continue;
      }
      expect(documents).toHaveLength(1);
      for (const document of documents) {
        const serialized = serialisePublicJsonLd(document);
        expect(() => JSON.parse(serialized)).not.toThrow();
        expect(document['@context']).toBe('https://schema.org');
        expect(Array.isArray(document['@graph'])).toBe(true);
        expect(serialized).toContain(`${entry.canonicalUrl}#webpage`);
        const types = (document['@graph'] as Array<Record<string, unknown>>)
          .flatMap((node) => Array.isArray(node['@type']) ? node['@type'] : [node['@type']]);
        expect(types).not.toEqual(expect.arrayContaining([
          'Product', 'Offer', 'Review', 'AggregateRating', 'MedicalOrganization',
          'MedicalWebPage', 'ProfilePage', 'Person',
        ]));
        expect(serialized).not.toMatch(/\[(?:LEGAL|INSERT|PERIOD|URL|PATH)/i);
      }
    }
  });

  it('owns Organization and WebSite on the homepage and references stable IDs elsewhere', () => {
    const homepageGraph = buildPublicStructuredData(getPublicSeo('/')!)[0]['@graph'] as Array<Record<string, unknown>>;
    expect(homepageGraph).toEqual(expect.arrayContaining([
      expect.objectContaining({ '@type': 'Organization', '@id': PUBLIC_ORGANIZATION_ID }),
      expect.objectContaining({ '@type': 'WebSite', '@id': PUBLIC_WEBSITE_ID }),
    ]));

    for (const path of ['/talk-it-out', '/about', '/safety'] as const) {
      const graph = buildPublicStructuredData(getPublicSeo(path)!)[0]['@graph'] as Array<Record<string, unknown>>;
      expect(graph).not.toEqual(expect.arrayContaining([expect.objectContaining({ '@type': 'Organization' })]));
      expect(JSON.stringify(graph)).toContain(PUBLIC_ORGANIZATION_ID);
      expect(JSON.stringify(graph)).toContain(PUBLIC_WEBSITE_ID);
    }
    const aboutGraph = buildPublicStructuredData(getPublicSeo('/about')!)[0]['@graph'] as Array<Record<string, unknown>>;
    expect(aboutGraph).toEqual(expect.arrayContaining([expect.objectContaining({ '@type': 'AboutPage' })]));
  });

  it('escapes script-closing input safely', () => {
    expect(serialisePublicJsonLd({ value: '</script>' })).toBe('{"value":"\\u003c/script>"}');
  });
});
