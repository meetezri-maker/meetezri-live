/**
 * Slug utility — API entry point.
 *
 * The normalisation algorithm is tested exhaustively in `contentHubDomain.test.ts`; this suite
 * covers the API-side behaviour layered on top: deriving a slug from a title, and normalising a
 * caller-supplied value before judging it.
 */

import { deriveSlug, prepareSlug, isReservedSlug, RESERVED_SLUGS } from './slug';

describe('deriveSlug', () => {
  it('derives a slug from a title', () => {
    expect(deriveSlug('What Should I Do When I Have Nobody to Talk To?')).toBe(
      'what-should-i-do-when-i-have-nobody-to-talk-to'
    );
  });

  it('returns null rather than a placeholder when nothing survives normalisation', () => {
    // A caller that silently accepted "" or "untitled" would create a broken public URL.
    expect(deriveSlug('')).toBeNull();
    expect(deriveSlug('   ')).toBeNull();
    expect(deriveSlug('!!!???')).toBeNull();
  });
});

describe('prepareSlug', () => {
  it('normalises before judging, so a messy but usable input is accepted', () => {
    expect(prepareSlug('  My Great Post  ')).toEqual({ slug: 'my-great-post', valid: true });
  });

  it('reports the reason a slug is unusable', () => {
    expect(prepareSlug('admin')).toEqual({ slug: 'admin', valid: false, reason: 'reserved' });
    expect(prepareSlug('')).toEqual({ slug: '', valid: false, reason: 'empty' });
    expect(prepareSlug('   ')).toEqual({ slug: '', valid: false, reason: 'empty' });
  });

  it('catches reserved words that only appear after normalisation', () => {
    // "Sitemap" is not reserved as typed, but normalises to one that is.
    expect(prepareSlug('Sitemap')).toEqual({ slug: 'sitemap', valid: false, reason: 'reserved' });
  });

  it('never returns a slug the caller could store as-is when invalid', () => {
    const result = prepareSlug('API');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('reserved');
  });
});

describe('reserved slugs', () => {
  it('covers the approved list', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(isReservedSlug(reserved)).toBe(true);
    }
  });

  it('does not over-reach', () => {
    expect(isReservedSlug('answers')).toBe(false);
    expect(isReservedSlug('someone-to-talk-to-at-night')).toBe(false);
  });
});
