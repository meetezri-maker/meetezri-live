import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ROUTE_PATHS,
  PUBLIC_SEO_REGISTRY,
  PUBLIC_SITE_ORIGIN,
  buildPublicStructuredData,
  getPublicSeo,
  serialisePublicJsonLd,
  validatePublicSeoRegistry,
} from '@meetezri/public-content';

describe('public SEO registry', () => {
  it('resolves only the six exact allowlisted paths', () => {
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
  });

  it('emits only approved valid schema for indexable routes', () => {
    for (const entry of PUBLIC_SEO_REGISTRY) {
      const documents = buildPublicStructuredData(entry);
      if (!entry.indexable) expect(documents).toEqual([]);
      for (const document of documents) {
        const serialized = serialisePublicJsonLd(document);
        expect(() => JSON.parse(serialized)).not.toThrow();
        if (document['@type'] === 'WebPage') {
          expect(serialized).toContain(entry.canonicalUrl);
        }
        expect(serialized).not.toMatch(/Product|Offer|Review|AggregateRating|Medical|Organization|Person/);
        expect(serialized).not.toMatch(/\[(?:LEGAL|INSERT|PERIOD|URL|PATH)/i);
      }
    }
  });

  it('escapes script-closing input safely', () => {
    expect(serialisePublicJsonLd({ value: '</script>' })).toBe('{"value":"\\u003c/script>"}');
  });
});
