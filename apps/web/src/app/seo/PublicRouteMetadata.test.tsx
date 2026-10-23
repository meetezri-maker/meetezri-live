import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { PUBLIC_ROUTE_PATHS, getPublicSeo } from '@meetezri/public-content';
import {
  PublicRouteMetadata,
  applyNotFoundMetadata,
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
    expect(count('script[type="application/ld+json"]')).toBe(1);
  });

  it('switches between Terms noindex and an indexable authority page without stale metadata', () => {
    applyPublicMetadata(getPublicSeo('/about')!);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://www.talktosolace2.ai/about'
    );
    expect(count('script[type="application/ld+json"]')).toBe(1);

    applyPublicMetadata(getPublicSeo('/terms')!);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://www.talktosolace2.ai/terms'
    );
    expect(count('script[type="application/ld+json"]')).toBe(0);

    applyPublicMetadata(getPublicSeo('/safety')!);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://www.talktosolace2.ai/safety'
    );
    expect(count('script[type="application/ld+json"]')).toBe(1);
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

  it('clears stale public metadata and applies the not-found title', () => {
    applyPublicMetadata(getPublicSeo('/')!);
    applyNotFoundMetadata();

    expect(document.title).toBe('Page Not Found | Solace');
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

describe('designer homepage review route', () => {
  beforeEach(() => {
    document.head.innerHTML = '<title>Solace</title><meta name="robots" content="noindex,nofollow">';
  });

  it('is not a public, sitemap-eligible route', () => {
    expect(getPublicSeo('/landing-page')).toBeUndefined();
    expect(PUBLIC_ROUTE_PATHS).not.toContain('/landing-page');
  });

  it('is noindex, and the noindex does not leak onto / after navigating', async () => {
    render(
      <MemoryRouter initialEntries={['/landing-page']}>
        <PublicRouteMetadata />
        <Routes>
          <Route path="/landing-page" element={<Link to="/">Previous homepage</Link>} />
          <Route path="/" element={<Link to="/landing-page">Designer homepage</Link>} />
        </Routes>
      </MemoryRouter>,
    );
    const robots = () => document.querySelector('meta[name="robots"]');

    await waitFor(() => expect(robots()).toHaveAttribute('content', 'noindex,nofollow'));
    expect(count('link[rel="canonical"]')).toBe(0);

    fireEvent.click(screen.getByRole('link', { name: 'Previous homepage' }));
    const home = getPublicSeo('/')!;
    await waitFor(() => expect(robots()).toHaveAttribute('content', home.robots));
    expect(home.robots).toBe('index,follow');
    expect(document.title).toBe(home.title);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', home.canonicalUrl);

    fireEvent.click(screen.getByRole('link', { name: 'Designer homepage' }));
    await waitFor(() => expect(robots()).toHaveAttribute('content', 'noindex,nofollow'));
    expect(count('link[rel="canonical"]')).toBe(0);
  });
});
