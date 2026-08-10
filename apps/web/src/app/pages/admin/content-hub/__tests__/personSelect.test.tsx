/**
 * Regression: empty Author / Reviewer dropdowns, and the Reviewed-on round trip.
 *
 * WHAT HAPPENED. `PersonSelect` requested `GET /api/admin/users?page=1&limit=100` — the newest 100
 * profiles — and then filtered for admin roles in the browser. Production has 269 profiles and its
 * two admins were created months earlier, at positions 204 and 264, so neither was in that window.
 * Every option was filtered away and the field offered only "Unassigned", while the profiles
 * plainly existed. The filter now happens server-side, so the result no longer depends on how many
 * members have signed up since.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, api: { admin: { getUsers: vi.fn() } } };
});

const { api } = await import('@/lib/api');
const { PersonSelect, AUTHOR_ELIGIBLE_ROLES } = await import('../components/PersonSelect');
const { dateInputToIso, isoToDateInput } = await import('../schema/contentHubEditor.schema');

const mockApi = api as unknown as { admin: { getUsers: ReturnType<typeof vi.fn> } };

const ROSALIND = {
  id: '6874e034-a3e9-45a0-835f-cfe21fdda65d',
  full_name: 'Rosalind Mitchell',
  email: 'r@example.com',
  role: 'super_admin',
  avatar_url: null,
};
const SAIF = {
  id: 'c6b3e17c-f7a0-4f26-b0d9-875147fa8776',
  full_name: 'Saif Ali',
  email: 's@example.com',
  role: 'super_admin',
  avatar_url: null,
};

function renderSelect(props: Partial<Parameters<typeof PersonSelect>[0]> = {}) {
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <PersonSelect id="author" label="Author" value="" onChange={onChange} {...props} />
    </QueryClientProvider>,
  );
  return { ...utils, onChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.admin.getUsers.mockResolvedValue([ROSALIND, SAIF]);
});

describe('the picker asks the server for eligible people', () => {
  it('sends a role filter instead of filtering a page in the browser', async () => {
    renderSelect();

    await waitFor(() => expect(mockApi.admin.getUsers).toHaveBeenCalled());
    const params = mockApi.admin.getUsers.mock.calls[0][0];

    // The fix: the roles go to the API.
    expect(params.roles).toEqual(AUTHOR_ELIGIBLE_ROLES);
    // And the page-one-of-newest-100 assumption is gone.
    expect(params.limit).toBeGreaterThan(100);
  });

  it('includes therapists alongside admin roles', () => {
    expect(AUTHOR_ELIGIBLE_ROLES).toEqual(
      expect.arrayContaining(['super_admin', 'org_admin', 'team_admin', 'therapist']),
    );
  });

  it('populates the Author dropdown with real profiles', async () => {
    renderSelect({ id: 'author', label: 'Author' });

    const select = await screen.findByLabelText('Author');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));

    expect(within(select).getByRole('option', { name: /Rosalind Mitchell/ })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Saif Ali/ })).toBeInTheDocument();
  });

  it('populates the Reviewer dropdown from the same source', async () => {
    renderSelect({ id: 'reviewer', label: 'Reviewer' });

    const select = await screen.findByLabelText('Reviewer');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
    expect(within(select).getByRole('option', { name: /Rosalind Mitchell/ })).toBeInTheDocument();
  });

  it('always offers Unassigned', async () => {
    renderSelect();
    const select = await screen.findByLabelText('Author');
    expect(within(select).getByRole('option', { name: 'Unassigned' })).toBeInTheDocument();
  });

  it('reproduces the bug when the server returns no eligible people', async () => {
    // The old client-side filter produced exactly this: a list of members, none eligible.
    mockApi.admin.getUsers.mockResolvedValue([]);
    renderSelect();

    const select = await screen.findByLabelText('Author');
    await waitFor(() => expect(select).not.toBeDisabled());
    expect(within(select).getAllByRole('option')).toHaveLength(1);
  });

  it('tolerates a wrapped response shape', async () => {
    mockApi.admin.getUsers.mockResolvedValue({ users: [ROSALIND] });
    renderSelect();

    const select = await screen.findByLabelText('Author');
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: /Rosalind Mitchell/ })).toBeInTheDocument(),
    );
  });
});

describe('selecting a person yields a real profile id', () => {
  it('reports the selected profile id, not a name', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    const select = await screen.findByLabelText('Author');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));

    await user.selectOptions(select, ROSALIND.id);
    expect(onChange).toHaveBeenCalledWith(ROSALIND.id);
  });

  it('reports an empty value for Unassigned, which the payload maps to null', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect({ value: ROSALIND.id });

    const select = await screen.findByLabelText('Author');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));

    await user.selectOptions(select, '');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('hydrates an existing assignment as the selected option', async () => {
    renderSelect({ value: SAIF.id });

    const select = (await screen.findByLabelText('Author')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(SAIF.id));
    expect(screen.getByText('Saif Ali')).toBeInTheDocument();
  });

  it('keeps an assigned person selectable even when they drop out of the list', async () => {
    // Deactivated, or their role changed. Rendering a raw id would look like data loss, and
    // re-saving would silently drop them.
    mockApi.admin.getUsers.mockResolvedValue([ROSALIND]);
    renderSelect({ value: SAIF.id });

    const select = (await screen.findByLabelText('Author')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(SAIF.id));
    expect(
      within(select).getByRole('option', { name: /no longer listed/i }),
    ).toBeInTheDocument();
  });
});

// ─── Reviewed on ─────────────────────────────────────────────────────────────

describe('Reviewed on round-trips the calendar date', () => {
  it('sends a full ISO datetime for the date the reviewer picked', () => {
    expect(dateInputToIso('2026-08-10')).toBe('2026-08-10T00:00:00.000Z');
  });

  it('returns the same day the input showed', () => {
    expect(isoToDateInput(dateInputToIso('2026-08-10'))).toBe('2026-08-10');
  });

  it('never shifts the day, in any timezone', () => {
    // String-only conversion, so a UTC+13 or UTC-11 runner cannot move the date.
    for (const date of ['2026-01-01', '2026-12-31', '2026-08-10']) {
      expect({ date, back: isoToDateInput(dateInputToIso(date)) }).toEqual({ date, back: date });
    }
  });

  it('clears to null', () => {
    expect(dateInputToIso('')).toBeNull();
    expect(isoToDateInput(null)).toBe('');
  });

  it('renders a stored timestamp back into the date input', () => {
    // What the admin GET returns for a stored `timestamptz`.
    expect(isoToDateInput('2026-08-10T00:00:00+00:00')).toBe('2026-08-10');
  });
});
