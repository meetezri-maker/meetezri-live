const mockPrisma = {
  content_links: { findMany: jest.fn() },
  content_items: { findMany: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { resolveRelated } from '../content-hub.read.service';

function row(id: string, slug: string, robots = 'index,follow') {
  return {
    id,
    slug,
    robots_directive: robots,
    content_type: 'seo_blog',
    title: slug,
    meta_description: `About ${slug}`,
    featured_image_url: null,
    featured_image_alt: null,
    reading_time_minutes: 3,
    published_at: new Date('2026-01-02T00:00:00Z'),
    first_published_at: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('topical related Resource selection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps manual order first, deduplicates it, then fills from the deterministic cluster', async () => {
    mockPrisma.content_links.findMany.mockResolvedValue([
      { target_content_id: 'manual' },
      { target_content_id: 'manual' },
    ]);
    mockPrisma.content_items.findMany
      .mockResolvedValueOnce([row('manual', 'manual-resource')])
      .mockResolvedValueOnce([
        row('cluster-2', 'why-talking-through-thoughts-can-make-them-feel-lighter'),
        row('cluster-1', 'what-should-i-do-when-i-have-nobody-to-talk-to'),
      ]);

    const result = await resolveRelated('current', 'someone-to-talk-to-at-night', 'Talking', 3);
    expect(result.map((item) => item.slug)).toEqual([
      'manual-resource',
      'what-should-i-do-when-i-have-nobody-to-talk-to',
      'why-talking-through-thoughts-can-make-them-feel-lighter',
    ]);
  });

  it('returns fewer cards instead of querying unrelated latest content', async () => {
    mockPrisma.content_links.findMany.mockResolvedValue([]);
    mockPrisma.content_items.findMany.mockResolvedValue([
      row('cluster-1', 'what-should-i-do-when-i-have-nobody-to-talk-to'),
    ]);

    const result = await resolveRelated('current', 'someone-to-talk-to-at-night', 'Talking', 3);
    expect(result.map((item) => item.slug)).toEqual([
      'what-should-i-do-when-i-have-nobody-to-talk-to',
    ]);
    expect(mockPrisma.content_items.findMany).toHaveBeenCalledTimes(1);
  });

  it('filters stored-noindex candidates and never broadens clustered habits to R23', async () => {
    mockPrisma.content_links.findMany.mockResolvedValue([]);
    mockPrisma.content_items.findMany.mockResolvedValue([
      row('hidden', 'questions-about-small-daily-habits-motivation-and-consistency', 'noindex,follow'),
      row('visible', 'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time'),
      row('unrelated', 'why-do-i-keep-replaying-conversations-in-my-head'),
    ]);

    const result = await resolveRelated('current', 'small-daily-habits-vs-motivation', 'Habits', 3);
    expect(result.map((item) => item.slug)).toEqual([
      'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time',
    ]);
    expect(result.map((item) => item.slug)).not.toContain('why-do-i-keep-replaying-conversations-in-my-head');
  });
});

