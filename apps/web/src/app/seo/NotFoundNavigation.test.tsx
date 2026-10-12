import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { PublicRouteMetadata } from './PublicRouteMetadata';

describe('client-side unknown navigation', () => {
  beforeEach(() => {
    document.head.innerHTML = '<title>Solace</title><meta name="robots" content="noindex,nofollow">';
  });

  it('renders Not Found and removes metadata left by the previous public route', async () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <PublicRouteMetadata />
        <Routes>
          <Route path="/terms" element={<Link to="/missing-client-route">Open missing page</Link>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.querySelector('link[rel="canonical"]')).not.toBeNull());
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Open missing page' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Page Not Found | Solace'));
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
