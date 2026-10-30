import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { StaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { getPublicSeo } from '@meetezri/public-content';
import { HowItWorks } from './HowItWorks';
import { Landing } from './Landing';
import { Pricing } from './Pricing';
import { TalkItOut } from './TalkItOut';
import { SUBSCRIPTION_PLANS } from '../utils/subscriptionPlans';

function renderPage(Page: () => JSX.Element, path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <MemoryRouter initialEntries={[path]}>
        <Page />
      </MemoryRouter>
    </StaticRouter>,
  );
}

const h1Count = (html: string) => (html.match(/<h1(?:\s|>)/g) ?? []).length;

describe('Cycle 3A-1A public authority intent', () => {
  it('keeps the homepage product-focused and links informational guidance contextually', () => {
    const html = renderPage(Landing, '/');
    expect(h1Count(html)).toBe(1);
    expect(html).toContain('A place to talk through what you&#x27;re carrying');
    expect(html).toContain('with Solace.');
    expect(html).toContain(
      'An AI-assisted conversation experience designed to give you space to express what is on your mind and reflect at your own pace.',
    );
    expect(html).toContain('href="/resources/what-should-i-do-when-i-have-nobody-to-talk-to"');
    expect(html).toContain('href="/talk-it-out"');
    expect(getPublicSeo('/')).toMatchObject({
      canonicalUrl: 'https://www.talktosolace2.ai/',
      robots: 'index,follow',
    });
  });

  it('narrows How It Works and points to the flagship product page', () => {
    const html = renderPage(HowItWorks, '/how-it-works');
    expect(h1Count(html)).toBe(1);
    expect(html).toContain('href="/talk-it-out"');
    expect(html).toContain('Before You Begin');
    expect(html).not.toContain('support reflection and emotional processing');
    expect(getPublicSeo('/how-it-works')).toMatchObject({
      canonicalUrl: 'https://www.talktosolace2.ai/how-it-works',
      robots: 'index,follow',
    });
  });

  it('preserves Talk It Out authority, boundaries, and image semantics', () => {
    const html = renderPage(TalkItOut, '/talk-it-out');
    expect(h1Count(html)).toBe(1);
    expect(html).toContain('>Talk It Out</h1>');
    expect(html).toContain('Talk It Out cannot provide professional judgment, diagnosis, treatment, or emergency intervention.');
    expect(html).toMatch(/talk-it-out\.jpg[^>]+width="1717"[^>]+height="916"[^>]+loading="eager"[^>]+decoding="async"/);
    expect(getPublicSeo('/talk-it-out')).toMatchObject({
      canonicalUrl: 'https://www.talktosolace2.ai/talk-it-out',
      robots: 'index,follow',
    });
  });

  it('corrects public pricing terminology without changing plan values', () => {
    const html = renderPage(Pricing, '/pricing');
    expect(html).toContain('Talk It Out conversations');
    expect(html).not.toContain('AI Companion Conversations');
    expect(html).toContain('Automated safety resource prompts');
    expect(html).not.toContain('Emergency Detection');
    expect(html).not.toContain('Priority Handling');
    expect(SUBSCRIPTION_PLANS.trial).toMatchObject({ displayName: 'Discover', price: 0, credits: 30 });
    expect(SUBSCRIPTION_PLANS.core).toMatchObject({ displayName: 'Grow', price: 25, credits: 200 });
    expect(SUBSCRIPTION_PLANS.pro).toMatchObject({ displayName: 'Thrive', price: 49, credits: 400 });
  });

  it('reserves intrinsic dimensions and prioritizes the homepage LCP image', () => {
    const html = renderPage(Landing, '/');
    expect(html).toMatch(/hero-lake\.jpg[^>]+width="1600"[^>]+height="1067"[^>]+fetchPriority="high"/);
    expect(html).toMatch(/width="651"[^>]+height="262"[^>]+logo black\.png/);
  });
});
