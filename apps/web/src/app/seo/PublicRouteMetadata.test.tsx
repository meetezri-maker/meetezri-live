import { beforeEach, describe, expect, it } from 'vitest';
import { getPublicSeo } from '@meetezri/public-content';
import {
  applyPrivateMetadata,
  applyPublicMetadata,
} from './PublicRouteMetadata';

const count = (selector: string) => document.head.querySelectorAll(selector).length;

describe('public route metadata synchronization', () => {
  beforeEach(() => {
    document.head.innerHTML = '<title>Solace</title><meta name="robots" content="noindex,nofollow">';
  });

  it('keeps exactly one complete metadata set', () => {
    applyPublicMetadata(getPublicSeo('/')!);
    applyPublicMetadata(getPublicSeo('/pricing')!);

    expect(document.title).toBe('Membership and Pricing | Solace');
    expect(count('meta[name="description"]')).toBe(1);
    expect(count('link[rel="canonical"]')).toBe(1);
    expect(count('meta[name="robots"]')).toBe(1);
    expect(count('meta[property="og:title"]')).toBe(1);
    expect(count('meta[name="twitter:title"]')).toBe(1);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.talktosolace2.ai/pricing'
    );
  });

  it('does not leak Early Access noindex or schema to another public route', () => {
    applyPublicMetadata(getPublicSeo('/early-access')!);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    expect(count('script[type="application/ld+json"]')).toBe(0);

    applyPublicMetadata(getPublicSeo('/how-it-works')!);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
    expect(count('script[type="application/ld+json"]')).toBe(2);
  });

  it('removes public canonicals, social tags and schema at the private boundary', () => {
    applyPublicMetadata(getPublicSeo('/terms')!);
    applyPrivateMetadata();

    expect(document.title).toBe('Solace');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow'
    );
    expect(count('link[rel="canonical"]')).toBe(0);
    expect(count('meta[property^="og:"]')).toBe(0);
    expect(count('meta[name^="twitter:"]')).toBe(0);
    expect(count('script[type="application/ld+json"]')).toBe(0);
  });
});
