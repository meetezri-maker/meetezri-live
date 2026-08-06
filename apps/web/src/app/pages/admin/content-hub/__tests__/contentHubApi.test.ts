/**
 * Content Hub — web API client tests.
 *
 * `fetch` is stubbed so these assert the CONTRACT (path, method, params, body) rather than
 * network behaviour. A wrong query-parameter name is the kind of bug that silently returns the
 * unfiltered list, so the parameter names are checked explicitly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
      signOut: vi.fn(),
    },
  },
}));

const { api, isApiError } = await import('@/lib/api');

function mockJson(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

/** URL of the most recent fetch call. */
function lastUrl(): URL {
  return new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://localhost');
}

function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)![1] as RequestInit;
}

describe('api.content.list', () => {
  it('hits the admin list endpoint with no params by default', async () => {
    fetchMock.mockResolvedValue(mockJson({ items: [], total: 0, page: 1, pageSize: 25 }));
    await api.content.list();

    expect(lastUrl().pathname).toBe('/api/admin/content');
    expect(lastUrl().search).toBe('');
    expect(lastInit().method).toBe('GET');
  });

  it('serialises every supported filter with the API parameter names', async () => {
    fetchMock.mockResolvedValue(mockJson({ items: [], total: 0, page: 2, pageSize: 10 }));

    await api.content.list({
      page: 2,
      pageSize: 10,
      search: 'talk',
      contentType: 'geo_article',
      status: 'in_review',
      pillar: 'Someone To Talk To',
      week: 1,
      tags: ['anxiety', 'sleep-health'],
      awaitingApproval: true,
      dueToPublish: true,
      sort: 'created_at',
      order: 'asc',
    });

    const params = lastUrl().searchParams;
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('10');
    expect(params.get('search')).toBe('talk');
    expect(params.get('contentType')).toBe('geo_article');
    expect(params.get('status')).toBe('in_review');
    expect(params.get('pillar')).toBe('Someone To Talk To');
    expect(params.get('week')).toBe('1');
    expect(params.get('awaitingApproval')).toBe('true');
    expect(params.get('dueToPublish')).toBe('true');
    expect(params.get('sort')).toBe('created_at');
    expect(params.get('order')).toBe('asc');
    // Tags repeat rather than joining, matching the API's array coercion.
    expect(params.getAll('tags')).toEqual(['anxiety', 'sleep-health']);
  });

  it('omits falsy toggles instead of sending false', async () => {
    fetchMock.mockResolvedValue(mockJson({ items: [], total: 0, page: 1, pageSize: 25 }));
    await api.content.list({ awaitingApproval: false, dueToPublish: false });

    expect(lastUrl().searchParams.has('awaitingApproval')).toBe(false);
    expect(lastUrl().searchParams.has('dueToPublish')).toBe(false);
  });
});

describe('api.content.create', () => {
  it('POSTs the create body', async () => {
    fetchMock.mockResolvedValue(mockJson({ id: 'new-id' }));
    await api.content.create({ contentType: 'aeo_answer', title: 'A title', tags: ['x'] });

    expect(lastUrl().pathname).toBe('/api/admin/content');
    expect(lastInit().method).toBe('POST');
    expect(JSON.parse(lastInit().body as string)).toEqual({
      contentType: 'aeo_answer',
      title: 'A title',
      tags: ['x'],
    });
  });
});

describe('api.content detail endpoints', () => {
  it('encodes the id in the detail path', async () => {
    fetchMock.mockResolvedValue(mockJson({ id: 'abc' }));
    await api.content.getById('abc/def');
    expect(lastUrl().pathname).toBe('/api/admin/content/abc%2Fdef');
  });

  it('hits the checklist endpoint', async () => {
    fetchMock.mockResolvedValue(mockJson({ passed: true, items: [] }));
    await api.content.getChecklist('abc');
    expect(lastUrl().pathname).toBe('/api/admin/content/abc/checklist');
  });
});

describe('api.content.setApproval', () => {
  it('PUTs to the gate path with state and note', async () => {
    fetchMock.mockResolvedValue(mockJson({ gates: {}, status: 'in_review' }));
    await api.content.setApproval('abc', 'marketing', { state: 'changes_requested', note: 'Fix intro' });

    expect(lastUrl().pathname).toBe('/api/admin/content/abc/approvals/marketing');
    expect(lastInit().method).toBe('PUT');
    expect(JSON.parse(lastInit().body as string)).toEqual({
      state: 'changes_requested',
      note: 'Fix intro',
    });
  });
});

describe('api.content.transition', () => {
  it('POSTs the action', async () => {
    fetchMock.mockResolvedValue(mockJson({ status: 'in_review', revisionNumber: 1 }));
    await api.content.transition('abc', { action: 'submit' });

    expect(lastUrl().pathname).toBe('/api/admin/content/abc/transition');
    expect(lastInit().method).toBe('POST');
    expect(JSON.parse(lastInit().body as string)).toEqual({ action: 'submit' });
  });
});

describe('error mapping', () => {
  it('preserves the backend stable code on the thrown ApiError', async () => {
    fetchMock.mockResolvedValue(
      mockJson(
        { statusCode: 409, error: 'Request failed', code: 'SLUG_TAKEN', message: 'The slug "x" is already in use.' },
        409,
      ),
    );

    const error = await api.content.create({ contentType: 'seo_blog', title: 'x' }).catch((e) => e);

    expect(isApiError(error)).toBe(true);
    // Callers narrow on `code`, never on message text.
    expect(error.code).toBe('SLUG_TAKEN');
    expect(error.status).toBe(409);
    expect(error.message).toContain('already in use');
  });

  it('surfaces a readable message for a 422 checklist failure', async () => {
    fetchMock.mockResolvedValue(
      mockJson(
        { statusCode: 422, error: 'Request failed', code: 'CHECKLIST_FAILED', message: 'The publish checklist did not pass.' },
        422,
      ),
    );

    const error = await api.content.transition('abc', { action: 'publish' }).catch((e) => e);
    expect(error.code).toBe('CHECKLIST_FAILED');
  });
});
