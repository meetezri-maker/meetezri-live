import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SITE_FOOTER_COLUMNS, SITE_NAV_LINKS } from '@meetezri/public-content';
import { About } from './About';
import { Safety } from './Safety';
import { TalkItOut } from './TalkItOut';

const cases = [
  {
    path: '/about',
    Page: About,
    h1: 'About Solace',
    required: [
      'Rosalind Mitchell is the Founder of Solace.',
      'Solace was created to make space for honest reflection in everyday life.',
    ],
  },
  {
    path: '/safety',
    Page: Safety,
    h1: 'Safety and Support at Solace',
    required: [
      'Solace cannot contact emergency services for you.',
      'These automated responses can miss or misinterpret language',
    ],
  },
  {
    path: '/talk-it-out',
    Page: TalkItOut,
    h1: 'Talk It Out',
    required: [
      'Begin with what is on your mind, speak naturally, and reflect at your own pace.',
      'The public page explains the experience without exposing the private member interface',
    ],
  },
] as const;

function renderPage(Page: typeof About, path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>,
  );
}

describe('Cycle 2A public authority pages', () => {
  it.each(cases)('$path renders meaningful public HTML with exactly one descriptive H1', ({ path, Page, h1, required }) => {
    const html = renderPage(Page, path);
    expect((html.match(/<h1(?:\s|>)/g) ?? [])).toHaveLength(1);
    expect(html).toContain(h1);
    for (const text of required) expect(html).toContain(text);
    expect(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length).toBeGreaterThan(500);
    expect(html).not.toMatch(/access_token|refresh_token|currentUser|billingCustomerId/);
  });

  it('renders the approved primary navigation in order', () => {
    const html = renderPage(About, '/about');
    const primary = html.slice(html.indexOf('aria-label="Primary"'), html.indexOf('</nav>'));
    let previous = -1;
    for (const link of SITE_NAV_LINKS) {
      const position = primary.indexOf(`href="${link.href}"`);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
  });

  it('renders the approved footer sections and no Admin Portal link', () => {
    const html = renderPage(Safety, '/safety');
    for (const column of SITE_FOOTER_COLUMNS) {
      expect(html).toContain(column.heading);
      for (const link of column.links) expect(html).toContain(`href="${link.href}"`);
    }
    expect(html).not.toContain('Admin Portal');
    expect(html).not.toContain('href="/admin/login"');
  });

  it('does not invent a public support destination', () => {
    const html = renderPage(Safety, '/safety');
    expect(html).not.toMatch(/support@/i);
    expect(html).not.toContain('/app/settings/help-support');
    expect(html).not.toContain('href="/support"');
  });

  it('keeps unsupported or prohibited claims out of the authority pages', () => {
    const html = cases.map(({ path, Page }) => renderPage(Page, path)).join('\n');
    for (const claim of [
      'HIPAA', 'industry-leading security', 'available 24/7', 'guaranteed detection',
      'professional monitoring', 'ProfilePage', 'founding date', 'headquarters',
    ]) {
      expect(html).not.toContain(claim);
    }
  });
});
