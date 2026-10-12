import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { renderNotFoundDocument } from './renderDocument';

describe('static not-found document', () => {
  const html = renderNotFoundDocument(renderToString(<NotFoundPage />));

  it('is complete, branded, and useful without JavaScript', () => {
    expect(html).toContain('<title>Page Not Found | Solace</title>');
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain('could not be found');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('<script');
  });

  it('does not inherit public canonical or structured data', () => {
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('application/ld+json');
    expect(html).not.toContain('index,follow');
  });
});
