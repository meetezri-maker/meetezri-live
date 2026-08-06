/**
 * Content Hub — query keys and navigation/role wiring.
 *
 * Guards two things that are easy to break invisibly: cache keys that stop distinguishing
 * filters, and mutations that over-invalidate (a blanket `invalidateQueries()` would refetch
 * every admin screen in the app).
 */

import { describe, expect, it } from 'vitest';
import { APPROVAL_GATES } from '@meetezri/shared';
import { contentHubKeys } from '@/lib/queries/contentHubQueries';
import { NAVIGATION } from '@/app/components/admin/adminNavigation';

describe('query keys', () => {
  it('namespaces everything under contentHub', () => {
    for (const key of [
      contentHubKeys.all(),
      contentHubKeys.lists(),
      contentHubKeys.list({}),
      contentHubKeys.detail('id'),
      contentHubKeys.checklist('id'),
      contentHubKeys.reviewQueues(),
      contentHubKeys.reviewQueue({}),
      contentHubKeys.tags(),
    ]) {
      expect(key[0]).toBe('contentHub');
    }
  });

  it('is filter-sensitive, so two filter sets never share a cache entry', () => {
    expect(contentHubKeys.list({ status: 'draft' })).not.toEqual(
      contentHubKeys.list({ status: 'published' }),
    );
    expect(contentHubKeys.list({ page: 1 })).not.toEqual(contentHubKeys.list({ page: 2 }));
  });

  it('is stable for identical filters', () => {
    expect(contentHubKeys.list({ status: 'draft', page: 2 })).toEqual(
      contentHubKeys.list({ status: 'draft', page: 2 }),
    );
  });

  it('keeps the review queue on its own prefix', () => {
    // So approving something refreshes the queue without invalidating every filtered list.
    expect(contentHubKeys.reviewQueues()).toEqual(['contentHub', 'reviewQueue']);
    expect(contentHubKeys.lists()).toEqual(['contentHub', 'list']);
  });

  it('scopes detail and checklist per id', () => {
    expect(contentHubKeys.detail('a')).not.toEqual(contentHubKeys.detail('b'));
    expect(contentHubKeys.checklist('a')).not.toEqual(contentHubKeys.checklist('b'));
  });

  it('never collides with the existing admin key namespace', () => {
    expect(contentHubKeys.all()).not.toEqual(['admin']);
  });
});

describe('admin navigation', () => {
  const section = NAVIGATION.find((s) => s.name === 'Content Hub');

  it('adds a Content Hub section', () => {
    expect(section).toBeDefined();
  });

  it('is restricted to super_admin and org_admin', () => {
    expect(section?.roles.sort()).toEqual(['org_admin', 'super_admin']);
    // team_admin must not see the Content Hub at all.
    expect(section?.roles).not.toContain('team_admin');
    for (const page of section?.pages ?? []) {
      expect(page.roles).not.toContain('team_admin');
    }
  });

  it('links the three Phase 3 screens', () => {
    expect(section?.pages.map((p) => p.href)).toEqual([
      '/admin/content-hub',
      '/admin/content-hub/new',
      '/admin/content-hub/review',
    ]);
  });

  it('uses public-facing labels only', () => {
    const text = [section?.name, ...(section?.pages.map((p) => p.name) ?? [])].join(' ');
    for (const forbidden of ['AEO', 'GEO', 'aeo_answer', 'geo_article', 'seo_blog']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('does NOT add Phase 4+ entries', () => {
    const names = section?.pages.map((p) => p.name) ?? [];
    for (const future of ['Media', 'Analytics', 'Authors', 'Calendar', 'Taxonomy', 'Import']) {
      expect(names).not.toContain(future);
    }
  });

  it('preserves the Expert Review entry', () => {
    const allPages = NAVIGATION.flatMap((s) => s.pages);
    const expertReview = allPages.find((p) => p.href === '/admin/expert-reviews');
    expect(expertReview).toBeDefined();
    expect(expertReview?.name).toBe('Expert Reviews');
  });

  it('leaves the rest of the navigation intact', () => {
    // Content Hub is appended, so every pre-existing section still exists.
    for (const name of ['Dashboards', 'User Management', 'Content', 'Security & Compliance', 'Data']) {
      expect(NAVIGATION.some((s) => s.name === name)).toBe(true);
    }
  });
});

describe('approval gates come from the shared constant', () => {
  it('does not assume exactly three gates', () => {
    // The UI iterates APPROVAL_GATES; this asserts the source of truth is shared, so adding a
    // fourth safety gate expands the UI with no layout change.
    expect(APPROVAL_GATES.length).toBeGreaterThanOrEqual(3);
    expect([...APPROVAL_GATES]).toContain('founder');
  });
});
