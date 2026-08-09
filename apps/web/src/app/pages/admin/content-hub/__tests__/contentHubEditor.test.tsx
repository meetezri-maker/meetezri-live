/**
 * Phase 4 editor tests — schema, save behaviour, workflow, preview and architecture guards.
 *
 * TipTap is mocked at the `InlineEditor` boundary so these run fast and prove the editor's own
 * logic; the conversion layer is tested separately as pure functions.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/app/components/AdminLayoutNew', () => ({
  AdminLayoutNew: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

/** Mutable so the role-gating tests can re-render as an org admin. */
const auth = vi.hoisted(() => ({ role: 'super_admin' }));

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '22222222-2222-4222-8222-222222222222' },
    profile: { role: auth.role },
  }),
}));

/** Stand-in for the lazy TipTap editor — a textarea over the same InlineContent contract. */
vi.mock('../editor/InlineEditor', () => ({
  InlineEditor: ({ value, onChange, ariaLabel }: any) => (
    <textarea
      aria-label={ariaLabel}
      value={(value ?? []).map((s: any) => s.text).join('')}
      onChange={(e) => onChange([{ text: e.target.value }])}
    />
  ),
  InlineText: ({ content }: any) => <span>{(content ?? []).map((s: any) => s.text).join('')}</span>,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      admin: { getUsers: vi.fn().mockResolvedValue({ users: [] }) },
      content: {
        list: vi.fn(),
        getById: vi.fn(),
        getChecklist: vi.fn(),
        update: vi.fn(),
        setApproval: vi.fn(),
        transition: vi.fn(),
        listRevisions: vi.fn(),
        getRevision: vi.fn(),
        restoreRevision: vi.fn(),
        getLinks: vi.fn(),
        replaceLinks: vi.fn(),
        getInboundLinks: vi.fn(),
        getPreview: vi.fn(),
        setSchedule: vi.fn(),
        cancelSchedule: vi.fn(),
        validateCluster: vi.fn(),
        publishCluster: vi.fn(),
      },
    },
  };
});

const { api, ApiError } = await import('@/lib/api');
const { ContentHubEditor } = await import('../ContentHubEditor');
const { ContentHubPreview } = await import('../ContentHubPreview');

const mockApi = api as unknown as { content: Record<string, ReturnType<typeof vi.fn>>; admin: any };

const CONTENT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTENT_ID,
    editorialRef: 'W1-A001',
    contentType: 'aeo_answer',
    publicLabel: 'Answer',
    slug: 'what-should-i-do',
    title: 'What Should I Do?',
    status: 'draft',
    approvals: { founder: 'pending', marketing: 'pending', seo: 'pending' },
    schedule: { scheduled: false, overdue: false },
    scheduledFor: null,
    tags: ['anxiety'],
    pillar: 'Someone To Talk To',
    week: 1,
    author: { id: USER_ID, fullName: 'Alex Author', email: 'a@example.com' },
    readingTimeMinutes: 2,
    wordCount: 300,
    publishedAt: null,
    updatedAt: '2026-08-07T10:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    metaDescription: 'A meta description that sits comfortably inside the fifty to one sixty range.',
    featuredImageUrl: null,
    featuredImageAlt: null,
    body: { version: 1, blocks: [{ id: 'b1', type: 'paragraph', content: [{ text: 'Hello' }] }] },
    typeFields: {},
    editorial: {},
    canonicalUrlOverride: null,
    robotsDirective: 'index,follow',
    reviewer: null,
    reviewedAt: null,
    firstPublishedAt: null,
    currentRevisionNumber: 2,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    links: [],
    approvalActors: [],
    ...overrides,
  };
}

function renderEditor(path = `/admin/content-hub/${CONTENT_ID}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/content-hub/:id" element={<ContentHubEditor />} />
          <Route path="/admin/content-hub/:id/preview" element={<ContentHubPreview />} />
          {/* Stand-in for the list screen, so "did we actually navigate?" is observable. */}
          <Route path="/admin/content-hub" element={<div>Content list stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'super_admin';
  mockApi.content.getById.mockResolvedValue(makeDetail());
  mockApi.content.getChecklist.mockResolvedValue({ passed: false, items: [] });
  mockApi.content.listRevisions.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mockApi.content.getLinks.mockResolvedValue({ links: [] });
  mockApi.content.getInboundLinks.mockResolvedValue({ links: [] });
  mockApi.content.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mockApi.content.update.mockImplementation(async (_id: string, body: any) =>
    makeDetail({ updatedAt: new Date(Date.now() + 1000).toISOString(), ...body }),
  );
});

afterEach(() => vi.useRealTimers());

// ─── Layout ──────────────────────────────────────────────────────────────────

describe('editor layout', () => {
  it('renders the six tabs', async () => {
    renderEditor();
    await screen.findByRole('tablist');
    for (const label of ['Overview', 'Editorial Brief', 'Content', 'SEO & Signals', 'Links', 'Review & Publish']) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('shows header state: type, status, word count and reading time', async () => {
    renderEditor();
    await screen.findByRole('tablist');
    // The public label appears in the header badge (and again on the Overview tab as the
    // read-only content type) — never the internal `aeo_answer` value.
    expect(screen.getAllByText('Answer').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Status: Draft/)).toBeInTheDocument();
    expect(screen.getByText(/words ·/)).toBeInTheDocument();
    expect(screen.getByText(/min read/)).toBeInTheDocument();
  });

  it('is deep-linkable by tab', async () => {
    renderEditor(`/admin/content-hub/${CONTENT_ID}?tab=seo`);
    expect(await screen.findByRole('tab', { name: /SEO & Signals/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('contains NO Phase 3 placeholder messaging', async () => {
    const { container } = renderEditor();
    await screen.findByRole('tablist');
    expect(container.textContent).not.toContain('Phase 4');
    expect(container.textContent).not.toContain('Full content editing is added');
  });

  it('moves between tabs with arrow keys', async () => {
    const user = userEvent.setup();
    renderEditor();
    const overview = await screen.findByRole('tab', { name: /Overview/i });
    overview.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Editorial Brief/i })).toHaveAttribute('aria-selected', 'true'),
    );
  });
});

// ─── Overview ────────────────────────────────────────────────────────────────

describe('overview tab', () => {
  it('shows the content type as read-only', async () => {
    renderEditor();
    expect(await screen.findByText('Cannot be changed after creation')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Content type$/)).not.toBeInTheDocument();
  });

  it('warns when a published slug is changed', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'published' }));
    const user = userEvent.setup();
    renderEditor();

    const slug = await screen.findByLabelText('Slug');
    await user.clear(slug);
    await user.type(slug, 'a-new-url');

    expect(await screen.findByText(/old address will return 404|old address return 404/i)).toBeInTheDocument();
  });

  it('requires alt text once an image URL is set', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText('Featured image URL'), 'https://example.com/a.png');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText(/alt text is required/i)).toBeInTheDocument();
  });
});

// ─── Editorial brief ─────────────────────────────────────────────────────────

describe('editorial brief tab', () => {
  it('states clearly that everything is internal', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Editorial Brief/i }));

    expect(screen.getByText('Internal only')).toBeInTheDocument();
    expect(screen.getByText(/Nothing on this tab is shown to readers/i)).toBeInTheDocument();
  });

  it('shows type-specific planning fields for an Answer', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Editorial Brief/i }));

    expect(screen.getByLabelText('Primary question')).toBeInTheDocument();
    expect(screen.getByLabelText('Supporting questions')).toBeInTheDocument();
    // Insight/Article fields must not appear on an Answer.
    expect(screen.queryByLabelText('Core concept')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Word-count target')).not.toBeInTheDocument();
  });
});

// ─── Block editor ────────────────────────────────────────────────────────────

describe('content tab block editor', () => {
  async function openContentTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('tab', { name: /^Content$/i }));
  }

  it('renders existing blocks and can add one', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openContentTab(user);

    expect(screen.getByText('Paragraph')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add block' }));
    await user.click(screen.getByRole('button', { name: 'Quote' }));

    expect(await screen.findByText('Quote')).toBeInTheDocument();
  });

  it('never offers the image block', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openContentTab(user);
    await user.click(screen.getByRole('button', { name: 'Add block' }));

    expect(screen.queryByRole('button', { name: 'Image' })).not.toBeInTheDocument();
  });

  it('offers Direct answer on an Answer', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openContentTab(user);
    await user.click(screen.getByRole('button', { name: 'Add block' }));

    expect(screen.getByRole('button', { name: 'Direct answer' })).toBeInTheDocument();
    // `geo_statement` belongs to Insights only.
    expect(screen.queryByRole('button', { name: 'Statement' })).not.toBeInTheDocument();
  });

  it('does NOT offer Direct answer on an Article', async () => {
    mockApi.content.getById.mockResolvedValue(
      makeDetail({ contentType: 'seo_blog', publicLabel: 'Article' }),
    );
    const user = userEvent.setup();
    renderEditor();
    await openContentTab(user);
    await user.click(screen.getByRole('button', { name: 'Add block' }));

    expect(screen.queryByRole('button', { name: 'Direct answer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paragraph' })).toBeInTheDocument();
  });

  it('exposes accessible move, duplicate and remove controls', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openContentTab(user);

    expect(screen.getByRole('button', { name: 'Move Paragraph up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Paragraph down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate Paragraph' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Paragraph' })).toBeInTheDocument();
  });

  it('removes a block', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openContentTab(user);

    await user.click(screen.getByRole('button', { name: 'Remove Paragraph' }));
    expect(await screen.findByText(/This document is empty/i)).toBeInTheDocument();
  });
});

// ─── Saving ──────────────────────────────────────────────────────────────────

describe('saving', () => {
  it('explicit save creates a revision and sends the concurrency token', async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByRole('tablist');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(mockApi.content.update).toHaveBeenCalled());
    const [, body] = mockApi.content.update.mock.calls[0];
    expect(body.createRevision).toBe(true);
    expect(body.expectedUpdatedAt).toBe('2026-08-07T10:00:00.000Z');
  });

  it('autosaves without creating a revision', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText(/^Title/), '!');

    await waitFor(
      () => {
        expect(mockApi.content.update).toHaveBeenCalled();
        expect(mockApi.content.update.mock.calls[0][1].createRevision).toBe(false);
      },
      { timeout: 4000 },
    );
  });

  it('does NOT autosave a published item', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'published' }));
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText(/^Title/), '!');
    await new Promise((resolve) => setTimeout(resolve, 2600));

    expect(mockApi.content.update).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('shows a persistent error when a save fails, without a toast', async () => {
    mockApi.content.update.mockRejectedValue(new ApiError('Server exploded', 500, {}));
    const user = userEvent.setup();
    renderEditor();

    await screen.findByRole('tablist');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });

  it('opens a conflict dialog on a stale token and never silently overwrites', async () => {
    mockApi.content.update.mockRejectedValue(
      new ApiError('This content was changed by someone else.', 409, {
        code: 'STALE_UPDATE',
        details: { currentUpdatedAt: '2026-08-07T11:00:00.000Z', updatedBy: 'u2' },
      }),
    );

    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('tablist');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Someone else changed this content/i)).toBeInTheDocument();
    // No force-save escape hatch.
    expect(within(dialog).queryByRole('button', { name: /overwrite|force/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Reload server version/i })).toBeInTheDocument();
  });
});

// ─── Unsaved-change protection ───────────────────────────────────────────────

describe('unsaved-change protection', () => {
  /** Fires `beforeunload` and reports whether anything asked the browser to confirm. */
  function closeTab() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('does not warn while everything is saved', async () => {
    renderEditor();
    await screen.findByRole('tablist');
    expect(closeTab()).toBe(false);
  });

  it('warns before closing the tab with unsaved work', async () => {
    // A published item never autosaves, so its dirty state persists long enough to assert on.
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'published' }));
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText(/^Title/), '!');

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(closeTab()).toBe(true);
  });

  it('confirms before following an in-app link with unsaved work', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'published' }));
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText(/^Title/), '!');
    await user.click(screen.getByRole('link', { name: /All content/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Leaving now discards them/i)).toBeInTheDocument();
    // The click did not navigate.
    expect(screen.queryByText('Content list stub')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByText('Content list stub')).toBeInTheDocument();
  });

  it('does not interrupt navigation when nothing changed', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('tablist');

    await user.click(screen.getByRole('link', { name: /All content/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Content list stub')).toBeInTheDocument();
  });

  it('stops warning once the work is saved', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'published' }));
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText(/^Title/), '!');
    expect(closeTab()).toBe(true);

    await user.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(screen.getByText(/^Saved /)).toBeInTheDocument());

    expect(closeTab()).toBe(false);
  });
});

// ─── Review & publish ────────────────────────────────────────────────────────

describe('review and publish tab', () => {
  async function openReview(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));
  }

  it('shows only actions legal from the current status', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    // draft → submit, archive. Never publish or unpublish.
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
  });

  it('offers publish once approved, and blocks it while the checklist fails', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    mockApi.content.getChecklist.mockResolvedValue({
      passed: false,
      items: [{ code: 'meta_description', label: 'Meta description', passed: false, blocking: true }],
    });

    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    const publish = await screen.findByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    expect(await screen.findByText('Meta description')).toBeInTheDocument();
  });

  it('confirms before publishing and explains the effect of unpublishing', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'published' }));
    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    await user.click(await screen.findByRole('button', { name: 'Unpublish' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/return 404/i)).toBeInTheDocument();
  });

  it('hides publish, unpublish and archive from a non-super-admin', async () => {
    auth.role = 'org_admin';
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    mockApi.content.getChecklist.mockResolvedValue({ passed: true, items: [] });

    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    // Withdraw is not restricted, so the tab is not simply empty.
    expect(screen.getByRole('button', { name: 'Withdraw to draft' })).toBeInTheDocument();
    // Atomic cluster publishing is a publish action, so it is gated the same way.
    expect(screen.queryByRole('button', { name: /Publish as cluster/ })).not.toBeInTheDocument();
  });

  it('shows the cluster publish entry point to a super admin on an approved item', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    mockApi.content.getChecklist.mockResolvedValue({ passed: true, items: [] });

    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    expect(await screen.findByRole('button', { name: /Publish as cluster/ })).toBeInTheDocument();
    expect(screen.getByText(/link to each other and must go live together/i)).toBeInTheDocument();
  });
});

// ─── Scheduling ──────────────────────────────────────────────────────────────

describe('scheduling', () => {
  it('says planned publication is manual and never claims automation', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));

    expect(screen.getByText('Planned publication')).toBeInTheDocument();
    expect(screen.getByText(/does not publish automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/someone still has to press Publish/i)).toBeInTheDocument();

    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/automatic scheduled publishing/i);
    expect(body).not.toMatch(/will publish automatically/i);
  });

  it('only allows a planned date once approved', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));

    expect(screen.getByText(/only be set once every approval gate has passed/i)).toBeInTheDocument();
  });

  it('shows the timezone explicitly', async () => {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(screen.getByText(tz)).toBeInTheDocument();
  });
});

// ─── Preview ─────────────────────────────────────────────────────────────────

describe('preview', () => {
  it('uses the preview endpoint and never the admin record', async () => {
    mockApi.content.getPreview.mockResolvedValue({
      slug: 'what-should-i-do',
      label: 'Answer',
      title: 'What Should I Do?',
      description: 'A description.',
      canonicalPath: '/resources/what-should-i-do',
      robots: 'noindex,nofollow',
      featuredImageUrl: null,
      featuredImageAlt: null,
      body: { version: 1, blocks: [{ id: 'b1', type: 'paragraph', content: [{ text: 'Public text' }] }] },
      typeFields: {},
      author: { name: 'Alex Author', title: null, bio: null, avatarUrl: null },
      reviewer: null,
      reviewedAt: null,
      publishedAt: null,
      updatedAt: null,
      readingTimeMinutes: 2,
      links: [],
      related: [],
      isPreview: true,
    });

    renderEditor(`/admin/content-hub/${CONTENT_ID}/preview`);

    expect(await screen.findByText('Public text')).toBeInTheDocument();
    expect(mockApi.content.getPreview).toHaveBeenCalledWith(CONTENT_ID);
    expect(mockApi.content.getById).not.toHaveBeenCalled();
  });

  it('shows a preview banner with noindex, and width controls', async () => {
    mockApi.content.getPreview.mockResolvedValue({
      slug: 's', label: 'Answer', title: 'T', description: null,
      canonicalPath: '/resources/s', robots: 'noindex,nofollow',
      featuredImageUrl: null, featuredImageAlt: null,
      body: { version: 1, blocks: [] }, typeFields: {},
      author: null, reviewer: null, reviewedAt: null, publishedAt: null, updatedAt: null,
      readingTimeMinutes: null, links: [], related: [], isPreview: true,
    });

    renderEditor(`/admin/content-hub/${CONTENT_ID}/preview`);

    expect(await screen.findByText(/noindex, nofollow/)).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile width')).toBeInTheDocument();
    expect(screen.getByLabelText('Desktop width')).toBeInTheDocument();
  });
});

// ─── SEO & signals ───────────────────────────────────────────────────────────

describe('seo and signals tab', () => {
  async function openSeo(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('tab', { name: /SEO & Signals/i }));
  }

  it('shows the canonical path built from the slug, and marks it as derived', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openSeo(user);

    expect(screen.getByText('/resources/what-should-i-do')).toBeInTheDocument();
  });

  it('counts the meta description against the 50–160 guidance without blocking a save', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openSeo(user);

    const field = screen.getByLabelText(/Meta description/);
    await user.clear(field);
    await user.type(field, 'Too short.');

    expect(screen.getByText(/10 characters/)).toBeInTheDocument();
    // Guidance, not a form error — a draft with a short description must still save.
    expect(screen.queryByText('Meta description is too long.')).not.toBeInTheDocument();
  });

  it('rejects a non-https canonical override', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openSeo(user);

    await user.type(screen.getByLabelText(/Canonical URL/), 'http://example.com/x');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText('Canonical URL must be an absolute https URL.')).toBeInTheDocument();
    expect(mockApi.content.update).not.toHaveBeenCalled();
  });
});

// ─── Links ───────────────────────────────────────────────────────────────────

describe('links tab', () => {
  async function openLinks(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('tab', { name: /^Links$/i }));
  }

  it('offers only managed content and mapped routes as destinations', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openLinks(user);
    await user.click(screen.getByRole('button', { name: 'Add link' }));

    const kind = screen.getByLabelText('Link 1 type');
    expect(within(kind).getByRole('option', { name: 'Content Hub item' })).toBeInTheDocument();
    expect(within(kind).getByRole('option', { name: 'Site page' })).toBeInTheDocument();
    expect(within(kind).getAllByRole('option')).toHaveLength(2);
    // No free-text URL field — arbitrary internal URLs cannot be typed.
    expect(screen.queryByLabelText(/Link 1 URL/)).not.toBeInTheDocument();
  });

  it('warns and blocks saving while a destination is unchosen', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openLinks(user);
    await user.click(screen.getByRole('button', { name: 'Add link' }));

    expect(screen.getByText('Choose a target.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save links/ })).toBeDisabled();
  });

  it('warns about a self-link', async () => {
    mockApi.content.getLinks.mockResolvedValue({
      links: [
        {
          id: 'l1',
          targetKind: 'content',
          targetContentId: CONTENT_ID,
          targetRoute: null,
          anchorText: 'me',
          relation: 'related_content',
          sortOrder: 0,
          targetStatus: 'draft',
          targetTitle: 'What Should I Do?',
          targetSlug: 'what-should-i-do',
        },
      ],
    });

    const user = userEvent.setup();
    renderEditor();
    await openLinks(user);

    expect(await screen.findByText('This links to itself.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save links/ })).toBeDisabled();
  });

  it('warns that an unpublished target will block publishing', async () => {
    mockApi.content.getLinks.mockResolvedValue({
      links: [
        {
          id: 'l1',
          targetKind: 'content',
          targetContentId: '33333333-3333-4333-8333-333333333333',
          targetRoute: null,
          anchorText: 'other',
          relation: 'related_content',
          sortOrder: 0,
          targetStatus: 'approved',
          targetTitle: 'Other',
          targetSlug: 'other',
        },
      ],
    });

    const user = userEvent.setup();
    renderEditor();
    await openLinks(user);

    expect(
      await screen.findByText(/publishing will be blocked unless they publish together/i),
    ).toBeInTheDocument();
  });

  it('shows inbound links read-only, with no edit controls', async () => {
    mockApi.content.getInboundLinks.mockResolvedValue({
      links: [
        {
          id: 'in1',
          sourceContentId: '44444444-4444-4444-8444-444444444444',
          sourceTitle: 'Something else',
          sourceStatus: 'published',
          anchorText: 'read this',
          relation: 'related_content',
        },
      ],
    });

    const user = userEvent.setup();
    renderEditor();
    await openLinks(user);

    expect(await screen.findByText('Something else')).toBeInTheDocument();
    expect(screen.getByText('(read-only)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove inbound/)).not.toBeInTheDocument();
  });
});

// ─── Revisions ───────────────────────────────────────────────────────────────

describe('revision history', () => {
  const REVISIONS = {
    items: [
      {
        id: 'r2',
        revisionNumber: 2,
        trigger: 'manual_save',
        statusAtCapture: 'draft',
        changeSummary: null,
        createdAt: '2026-08-06T09:00:00.000Z',
        createdBy: USER_ID,
        createdByName: 'Alex Author',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 50,
  };

  async function openReview(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));
  }

  it('explains that autosave does not create revisions when there are none', async () => {
    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    expect(
      await screen.findByText(/An explicit save or a status change creates one — autosave does not/i),
    ).toBeInTheDocument();
  });

  it('lists revisions with who and when', async () => {
    mockApi.content.listRevisions.mockResolvedValue(REVISIONS);
    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    expect(await screen.findByText('#2')).toBeInTheDocument();
    expect(screen.getByText(/Alex Author/)).toBeInTheDocument();
  });

  it('confirms a restore and says history is not rewritten', async () => {
    mockApi.content.listRevisions.mockResolvedValue(REVISIONS);
    mockApi.content.restoreRevision.mockResolvedValue(makeDetail());

    const user = userEvent.setup();
    renderEditor();
    await openReview(user);

    await user.click(await screen.findByRole('button', { name: 'Restore revision 2' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/History is not rewritten/i)).toBeInTheDocument();
    expect(mockApi.content.restoreRevision).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(mockApi.content.restoreRevision).toHaveBeenCalledWith(CONTENT_ID, 2, {
        expectedUpdatedAt: '2026-08-07T10:00:00.000Z',
      }),
    );
  });
});

// ─── Cluster publishing ──────────────────────────────────────────────────────

describe('cluster publishing', () => {
  const OTHER_ID = '55555555-5555-4555-8555-555555555555';

  async function openCluster(user: ReturnType<typeof userEvent.setup>) {
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    mockApi.content.getChecklist.mockResolvedValue({ passed: true, items: [] });
    mockApi.content.list.mockResolvedValue({
      items: [
        { id: CONTENT_ID, title: 'What Should I Do?', publicLabel: 'Answer', editorialRef: 'W1-A001', status: 'approved', slug: 'what-should-i-do' },
        { id: OTHER_ID, title: 'Second Item', publicLabel: 'Insight', editorialRef: 'W1-G001', status: 'approved', slug: 'second-item' },
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    });

    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));
    await user.click(await screen.findByRole('button', { name: /Publish as cluster/ }));
    return screen.findByRole('dialog');
  }

  it('states the all-or-nothing rule and requires at least two members', async () => {
    const user = userEvent.setup();
    const dialog = await openCluster(user);

    expect(within(dialog).getByText(/All 1 publish, or\s+none do/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Select between 2 and 20 items/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Validate' })).toBeDisabled();
  });

  it('will not publish before a passing validation', async () => {
    const user = userEvent.setup();
    const dialog = await openCluster(user);

    await user.click(within(dialog).getByRole('checkbox', { name: /Second Item/ }));
    expect(within(dialog).getByRole('button', { name: 'Validate' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: /Publish 2 together/ })).toBeDisabled();
  });

  it('reports per-member failures and keeps publish disabled', async () => {
    mockApi.content.validateCluster.mockResolvedValue({
      passed: false,
      members: [
        { contentId: CONTENT_ID, title: 'What Should I Do?', status: 'approved', passed: true, items: [] },
        {
          contentId: OTHER_ID,
          title: 'Second Item',
          status: 'approved',
          passed: false,
          items: [{ code: 'meta_description', label: 'Meta description missing', passed: false, blocking: true, details: null }],
        },
      ],
      linkResolution: [],
    });

    const user = userEvent.setup();
    const dialog = await openCluster(user);
    await user.click(within(dialog).getByRole('checkbox', { name: /Second Item/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Validate' }));

    expect(await within(dialog).findByText('Cluster cannot publish yet')).toBeInTheDocument();
    expect(within(dialog).getByText('Meta description missing')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Publish 2 together/ })).toBeDisabled();
    expect(mockApi.content.publishCluster).not.toHaveBeenCalled();
  });

  it('publishes the whole set once validation passes', async () => {
    mockApi.content.validateCluster.mockResolvedValue({
      passed: true,
      members: [
        { contentId: CONTENT_ID, title: 'What Should I Do?', status: 'approved', passed: true, items: [] },
        { contentId: OTHER_ID, title: 'Second Item', status: 'approved', passed: true, items: [] },
      ],
      linkResolution: [
        { sourceId: CONTENT_ID, targetId: OTHER_ID, resolution: 'in_cluster' },
      ],
    });
    mockApi.content.publishCluster.mockResolvedValue({ published: [CONTENT_ID, OTHER_ID] });

    const user = userEvent.setup();
    const dialog = await openCluster(user);
    await user.click(within(dialog).getByRole('checkbox', { name: /Second Item/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Validate' }));

    expect(await within(dialog).findByText('Cluster is ready to publish')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 resolved\s+within this cluster/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Publish 2 together/ }));

    await waitFor(() =>
      expect(mockApi.content.publishCluster).toHaveBeenCalledWith([CONTENT_ID, OTHER_ID]),
    );
  });

  it('lets an org admin validate but never publish', async () => {
    auth.role = 'org_admin';
    mockApi.content.getById.mockResolvedValue(makeDetail({ status: 'approved' }));
    mockApi.content.getChecklist.mockResolvedValue({ passed: true, items: [] });

    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('tab', { name: /Review & Publish/i }));

    // The entry point itself is a super-admin action, so an org admin cannot even open it.
    expect(screen.queryByRole('button', { name: /Publish as cluster/ })).not.toBeInTheDocument();
  });
});

// ─── Terminology ─────────────────────────────────────────────────────────────

describe('terminology', () => {
  it('renders the public label everywhere a type is shown, never the internal value', async () => {
    for (const [type, label] of [
      ['aeo_answer', 'Answer'],
      ['geo_article', 'Insight'],
      ['seo_blog', 'Article'],
    ] as const) {
      mockApi.content.getById.mockResolvedValue(makeDetail({ contentType: type, publicLabel: label }));
      const { unmount, container } = renderEditor();
      await screen.findByRole('tablist');

      expect(container.textContent).toContain(label);
      expect(container.textContent).not.toContain(type);
      expect(container.textContent).not.toMatch(/\bAEO\b|\bGEO\b/);
      unmount();
    }
  });

  it('never calls a published item a "blog post" in the preview', async () => {
    mockApi.content.getPreview.mockResolvedValue({
      slug: 's', label: 'Article', title: 'T', description: null,
      canonicalPath: '/resources/s', robots: 'index,follow',
      featuredImageUrl: null, featuredImageAlt: null,
      body: { version: 1, blocks: [] }, typeFields: {},
      author: null, reviewer: null, reviewedAt: null, publishedAt: null, updatedAt: null,
      readingTimeMinutes: null, links: [], related: [], isPreview: true,
    });

    // Phase 5A: the preview renders the shared public `ResourceArticle`, so the label appears in
    // the article header and the breadcrumbs are real links rather than a text crumb string.
    const { container } = renderEditor(`/admin/content-hub/${CONTENT_ID}/preview`);
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(screen.getByText('Article')).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/blog/i);
    expect(container.textContent).not.toMatch(/seo_blog|geo_article|aeo_answer/);
  });
});

// ─── Architecture guards ─────────────────────────────────────────────────────

describe('architecture guards', () => {
  const HUB_DIR = join(__dirname, '..');

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  /**
   * Guards run against CODE, not prose. Several of these files explain in a comment that they
   * deliberately avoid `dangerouslySetInnerHTML` or `fetch()`, and a naive scan would flag exactly
   * the files that documented the rule best.
   */
  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const files = walk(HUB_DIR).map((path) => {
    const source = readFileSync(path, 'utf8');
    return { path, source, code: stripComments(source) };
  });

  it('imports TipTap in exactly one file, reached only through a lazy boundary', () => {
    const importers = files.filter((f) => /from '@tiptap\//.test(f.code)).map((f) => f.path);
    expect(importers).toHaveLength(1);
    expect(importers[0]).toMatch(/TipTapInlineEditor\.tsx$/);

    const boundary = files.find((f) => f.path.endsWith('InlineEditor.tsx'))!;
    expect(boundary.source).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\/TipTapInlineEditor'\)/);
  });

  it('never uses dangerouslySetInnerHTML anywhere in the Content Hub', () => {
    for (const file of files) {
      expect({ file: file.path, bad: file.code.includes('dangerouslySetInnerHTML') }).toEqual({
        file: file.path,
        bad: false,
      });
    }
  });

  it('never calls fetch directly — everything goes through the query layer', () => {
    for (const file of files) {
      expect({ file: file.path, bad: /\bfetch\(/.test(file.code) }).toEqual({
        file: file.path,
        bad: false,
      });
    }
  });

  it('has no second detail screen — the draft shell is gone', () => {
    expect(files.some((f) => f.path.includes('ContentHubDraftShell'))).toBe(false);
    for (const file of files) {
      expect(file.code).not.toContain('Full content editing is added in Phase 4');
    }
  });

  it('builds preview from the serializer endpoint, not the admin record', () => {
    const preview = files.find((f) => f.path.endsWith('ContentHubPreview.tsx'))!;
    expect(preview.code).toContain('useContentHubPreview');
    expect(preview.code).not.toContain('useContentHubDetail');
  });

  it('never renders an internal content-type value', () => {
    for (const file of files) {
      const jsxText = file.code.match(/>\s*(aeo_answer|geo_article|seo_blog)\s*</g);
      expect({ file: file.path, jsxText }).toEqual({ file: file.path, jsxText: null });
    }
  });
});
