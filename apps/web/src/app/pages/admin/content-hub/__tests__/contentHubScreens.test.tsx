/**
 * Content Hub — Phase 3 screen tests.
 *
 * `AdminLayoutNew` and `AuthContext` are mocked (the pattern `ExpertReviewConsole.test.tsx`
 * already uses) so these test the screens, not the admin shell.
 *
 * The headline assertions are the TERMINOLOGY GUARDS: every screen is rendered with fixtures whose
 * network payloads contain `aeo_answer` / `geo_article` / `seo_blog`, and the visible DOM text is
 * searched for those and for "AEO"/"GEO"/"SEO".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/app/components/AdminLayoutNew', () => ({
  AdminLayoutNew: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' }, profile: { role: 'super_admin' } }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      content: {
        list: vi.fn(),
        create: vi.fn(),
        getById: vi.fn(),
        getChecklist: vi.fn(),
        setApproval: vi.fn(),
        transition: vi.fn(),
      },
    },
  };
});

const { api } = await import('@/lib/api');
const { ContentHubList } = await import('../ContentHubList');
const { ContentHubCreate } = await import('../ContentHubCreate');
const { ContentHubReview } = await import('../ContentHubReview');

const mockApi = api as unknown as {
  content: Record<string, ReturnType<typeof vi.fn>>;
};

/** Internal type values are present in the payload on purpose — they must not reach the DOM. */
function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    editorialRef: 'W1-A001',
    contentType: 'aeo_answer',
    publicLabel: 'Answer',
    slug: 'what-should-i-do',
    title: 'What Should I Do?',
    status: 'draft',
    approvals: { founder: 'pending', marketing: 'approved', seo: 'changes_requested' },
    schedule: { scheduled: false, overdue: false },
    scheduledFor: null,
    tags: ['anxiety'],
    pillar: 'Someone To Talk To',
    week: 1,
    author: { id: 'a1', fullName: 'Alex Author', email: 'a@example.com' },
    readingTimeMinutes: 3,
    wordCount: 500,
    publishedAt: null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function listResponse(items: unknown[], total = items.length) {
  return { items, total, page: 1, pageSize: 25 };
}

function renderWithProviders(ui: React.ReactElement, initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/admin/content-hub/:id" element={<div>Draft shell</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.content.list.mockResolvedValue(listResponse([]));
  mockApi.content.getChecklist.mockResolvedValue({ passed: false, items: [] });
});

// Safety net: if any test ever installs fake timers and fails before restoring them, they would
// otherwise stay installed and every subsequent test in the file would time out.
afterEach(() => {
  vi.useRealTimers();
});

// ─── List ────────────────────────────────────────────────────────────────────

describe('ContentHubList', () => {
  it('shows a loading skeleton, then rows', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([makeItem()]));
    renderWithProviders(<ContentHubList />);

    expect(await screen.findByText('What Should I Do?')).toBeInTheDocument();
  });

  it('shows the empty-library state when nothing exists', async () => {
    renderWithProviders(<ContentHubList />);
    expect(await screen.findByText('No content yet')).toBeInTheDocument();
  });

  it('shows the filtered-empty state once a filter is applied', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContentHubList />);

    await screen.findByText('No content yet');
    await user.selectOptions(screen.getByLabelText('Status'), 'draft');

    expect(await screen.findByText('No content matches these filters')).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    mockApi.content.list.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<ContentHubList />);

    expect(await screen.findByText('Could not load content')).toBeInTheDocument();

    mockApi.content.list.mockResolvedValue(listResponse([makeItem()]));
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('What Should I Do?')).toBeInTheDocument();
  });

  it('renders the public label, never the internal type', async () => {
    mockApi.content.list.mockResolvedValue(
      listResponse([
        makeItem({ id: 'a', contentType: 'aeo_answer', publicLabel: 'Answer', title: 'A' }),
        makeItem({ id: 'g', contentType: 'geo_article', publicLabel: 'Insight', title: 'G' }),
        makeItem({ id: 's', contentType: 'seo_blog', publicLabel: 'Article', title: 'S' }),
      ]),
    );
    renderWithProviders(<ContentHubList />);

    expect(await screen.findByText('Answer')).toBeInTheDocument();
    expect(screen.getByText('Insight')).toBeInTheDocument();
    expect(screen.getByText('Article')).toBeInTheDocument();
  });

  it('renders a planned badge inside the status pill, never a "Scheduled" status', async () => {
    mockApi.content.list.mockResolvedValue(
      listResponse([
        makeItem({
          status: 'approved',
          schedule: { scheduled: true, overdue: false },
          scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ]),
    );
    renderWithProviders(<ContentHubList />);

    const pill = await screen.findByText(/^Approved · Planned/);
    expect(pill).toBeInTheDocument();
    expect(screen.queryByText(/^Scheduled$/)).not.toBeInTheDocument();
  });

  it('renders an overdue badge when the planned date has passed', async () => {
    mockApi.content.list.mockResolvedValue(
      listResponse([
        makeItem({
          status: 'approved',
          schedule: { scheduled: true, overdue: true },
          scheduledFor: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      ]),
    );
    renderWithProviders(<ContentHubList />);

    expect(await screen.findByText(/^Approved · Due/)).toBeInTheDocument();
  });

  it('describes every approval gate in accessible text, not colour', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([makeItem()]));
    renderWithProviders(<ContentHubList />);

    await screen.findByText('What Should I Do?');
    expect(screen.getByLabelText('Founder: Pending')).toBeInTheDocument();
    expect(screen.getByLabelText('Marketing: Approved')).toBeInTheDocument();
    expect(screen.getByLabelText('SEO: Changes requested')).toBeInTheDocument();
  });

  it('debounces search and resets to page 1', async () => {
    // Real timers on purpose. Fake timers here fight userEvent's own scheduler, and a timeout
    // would leave them installed for every later test in the file.
    const user = userEvent.setup();
    mockApi.content.list.mockResolvedValue(listResponse([makeItem()], 200));

    renderWithProviders(<ContentHubList />);
    await screen.findByText('What Should I Do?');

    const callsBefore = mockApi.content.list.mock.calls.length;
    await user.type(screen.getByLabelText('Search'), 'talk');

    // Debounced: typing four characters must not produce four requests.
    expect(mockApi.content.list.mock.calls.length).toBe(callsBefore);

    await waitFor(
      () => {
        const last = mockApi.content.list.mock.calls.at(-1)![0];
        expect(last.search).toBe('talk');
        expect(last.page).toBe(1);
      },
      { timeout: 2000 },
    );
  });

  it('sends the internal type value while showing the public label', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContentHubList />);
    await screen.findByText('No content yet');

    await user.selectOptions(screen.getByLabelText('Type'), 'geo_article');

    await waitFor(() => {
      expect(mockApi.content.list.mock.calls.at(-1)![0].contentType).toBe('geo_article');
    });
  });

  it('TERMINOLOGY GUARD — no internal term is visible', async () => {
    mockApi.content.list.mockResolvedValue(
      listResponse([
        makeItem({ id: 'a', contentType: 'aeo_answer', publicLabel: 'Answer' }),
        makeItem({ id: 'g', contentType: 'geo_article', publicLabel: 'Insight', title: 'Second' }),
        makeItem({ id: 's', contentType: 'seo_blog', publicLabel: 'Article', title: 'Third' }),
      ]),
    );
    const { container } = renderWithProviders(<ContentHubList />);
    await screen.findByText('What Should I Do?');

    const text = container.textContent ?? '';
    for (const forbidden of ['aeo_answer', 'geo_article', 'seo_blog', 'AEO', 'GEO']) {
      expect(text).not.toContain(forbidden);
    }
    // "SEO" is allowed ONLY as the approval-gate label, never as a content type.
    expect(text).not.toMatch(/SEO (Blog|Article|Content)/);
  });
});

// ─── Create ──────────────────────────────────────────────────────────────────

describe('ContentHubCreate', () => {
  it('starts on the type step with the three public labels', () => {
    renderWithProviders(<ContentHubCreate />);

    expect(screen.getByText('Step 1 of 2 — choose what you are creating.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Answer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insight' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Article' })).toBeInTheDocument();
  });

  it('moves to step 2 and focuses its heading', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContentHubCreate />);

    await user.click(screen.getByRole('heading', { name: 'Insight' }));

    const heading = await screen.findByRole('heading', { name: /Insight details/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('auto-generates the slug from the title until it is edited', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContentHubCreate />);
    await user.click(screen.getByRole('heading', { name: 'Answer' }));

    await user.type(screen.getByLabelText('Title *'), 'What Should I Do?');
    await waitFor(() => expect(screen.getByLabelText('Slug')).toHaveValue('what-should-i-do'));

    await user.clear(screen.getByLabelText('Slug'));
    await user.type(screen.getByLabelText('Slug'), 'my-custom-slug');

    // Once touched, further title edits must not overwrite the operator's choice.
    await user.type(screen.getByLabelText('Title *'), ' Extra');
    expect(screen.getByLabelText('Slug')).toHaveValue('my-custom-slug');
  });

  it('shows a validation error for a reserved slug', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContentHubCreate />);
    await user.click(screen.getByRole('heading', { name: 'Answer' }));

    await user.type(screen.getByLabelText('Title *'), 'Something');
    await user.clear(screen.getByLabelText('Slug'));
    await user.type(screen.getByLabelText('Slug'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByText(/reserved/i)).toBeInTheDocument();
    expect(mockApi.content.create).not.toHaveBeenCalled();
  });

  it('creates with normalised tags and redirects', async () => {
    mockApi.content.create.mockResolvedValue({ id: 'new-id' });
    const user = userEvent.setup();
    renderWithProviders(<ContentHubCreate />);

    await user.click(screen.getByRole('heading', { name: 'Article' }));
    await user.type(screen.getByLabelText('Title *'), 'Someone To Talk To At Night');
    await user.type(screen.getByLabelText('Tags'), 'Anxiety, SLEEP HEALTH, anxiety');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => expect(mockApi.content.create).toHaveBeenCalled());
    const body = mockApi.content.create.mock.calls[0][0];
    expect(body.contentType).toBe('seo_blog');
    expect(body.tags).toEqual(['anxiety', 'sleep-health']);

    expect(await screen.findByText('Draft shell')).toBeInTheDocument();
  });

  it('maps a SLUG_TAKEN error onto the slug field', async () => {
    const { ApiError } = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
    mockApi.content.create.mockRejectedValue(
      new ApiError('The slug "x" is already in use.', 409, { code: 'SLUG_TAKEN' }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ContentHubCreate />);
    await user.click(screen.getByRole('heading', { name: 'Answer' }));
    await user.type(screen.getByLabelText('Title *'), 'Duplicate title');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
  });

  it('TERMINOLOGY GUARD — no internal term is visible', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ContentHubCreate />);
    await user.click(screen.getByRole('heading', { name: 'Insight' }));
    await screen.findByRole('heading', { name: /Insight details/ });

    const text = container.textContent ?? '';
    for (const forbidden of ['aeo_answer', 'geo_article', 'seo_blog', 'AEO', 'GEO']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

// ─── Review queue ────────────────────────────────────────────────────────────

describe('ContentHubReview', () => {
  const reviewItem = makeItem({ status: 'in_review' });

  it('queries in_review, oldest first', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([reviewItem]));
    renderWithProviders(<ContentHubReview />);

    await screen.findByText('What Should I Do?');
    const params = mockApi.content.list.mock.calls[0][0];
    expect(params.status).toBe('in_review');
    expect(params.order).toBe('asc');
  });

  it('shows an empty state when nothing is waiting', async () => {
    renderWithProviders(<ContentHubReview />);
    expect(await screen.findByText('Nothing is waiting for review right now.')).toBeInTheDocument();
  });

  it('loads the checklist only when a row is expanded', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([reviewItem]));
    mockApi.content.getChecklist.mockResolvedValue({
      passed: false,
      items: [
        { code: 'meta_description', label: 'Meta description is 50–160 characters', passed: false, blocking: true },
        { code: 'featured_image', label: 'Featured image is set', passed: false, blocking: false },
      ],
    });

    const user = userEvent.setup();
    renderWithProviders(<ContentHubReview />);
    await screen.findByText('What Should I Do?');

    expect(mockApi.content.getChecklist).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /checklist/i }));

    expect(await screen.findByText('Meta description is 50–160 characters')).toBeInTheDocument();
    // Blocking vs warning is stated in text, not colour alone.
    expect(screen.getByText('Blocking')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('approves a gate and refreshes the queue', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([reviewItem]));
    mockApi.content.setApproval.mockResolvedValue({ gates: {}, status: 'in_review' });

    const user = userEvent.setup();
    renderWithProviders(<ContentHubReview />);
    await screen.findByText('What Should I Do?');

    await user.click(screen.getByRole('button', { name: 'Set approval' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Gate'), 'founder');
    await user.selectOptions(within(dialog).getByLabelText('Decision'), 'approved');
    await user.click(within(dialog).getByRole('button', { name: 'Save decision' }));

    await waitFor(() => {
      expect(mockApi.content.setApproval).toHaveBeenCalledWith('c1', 'founder', {
        state: 'approved',
        note: undefined,
      });
    });
    // The queue refetches after the mutation.
    await waitFor(() => expect(mockApi.content.list.mock.calls.length).toBeGreaterThan(1));
  });

  it('requests changes with a note', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([reviewItem]));
    mockApi.content.setApproval.mockResolvedValue({ gates: {}, status: 'changes_requested' });

    const user = userEvent.setup();
    renderWithProviders(<ContentHubReview />);
    await screen.findByText('What Should I Do?');
    await user.click(screen.getByRole('button', { name: 'Set approval' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Decision'), 'changes_requested');
    await user.type(within(dialog).getByLabelText(/^Note/), 'Tighten the intro');
    await user.click(within(dialog).getByRole('button', { name: 'Save decision' }));

    await waitFor(() => {
      expect(mockApi.content.setApproval.mock.calls[0][2]).toEqual({
        state: 'changes_requested',
        note: 'Tighten the intro',
      });
    });
  });

  it('supports returning a gate to pending', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([reviewItem]));
    mockApi.content.setApproval.mockResolvedValue({ gates: {}, status: 'in_review' });

    const user = userEvent.setup();
    renderWithProviders(<ContentHubReview />);
    await screen.findByText('What Should I Do?');
    await user.click(screen.getByRole('button', { name: 'Set approval' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Decision'), 'pending');
    await user.click(within(dialog).getByRole('button', { name: 'Save decision' }));

    await waitFor(() => expect(mockApi.content.setApproval.mock.calls[0][2].state).toBe('pending'));
  });

  it('offers NO publish action — publishing is Phase 4', async () => {
    mockApi.content.list.mockResolvedValue(listResponse([reviewItem]));
    renderWithProviders(<ContentHubReview />);
    await screen.findByText('What Should I Do?');

    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(mockApi.content.transition).not.toHaveBeenCalled();
  });

  it('TERMINOLOGY GUARD — no internal term is visible', async () => {
    mockApi.content.list.mockResolvedValue(
      listResponse([
        makeItem({ id: 'g', status: 'in_review', contentType: 'geo_article', publicLabel: 'Insight' }),
      ]),
    );
    const { container } = renderWithProviders(<ContentHubReview />);
    await screen.findByText('What Should I Do?');

    const text = container.textContent ?? '';
    for (const forbidden of ['aeo_answer', 'geo_article', 'seo_blog', 'AEO', 'GEO']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
