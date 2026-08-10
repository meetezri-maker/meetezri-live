/**
 * Author / reviewer picker.
 *
 * Reuses `profiles` through the existing admin users endpoint — there is no author table and no
 * public author-profile management in this version (plan §15.1).
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { adminSelect } from '@/app/admin';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
}

/**
 * Roles eligible to be credited as an author or reviewer.
 *
 * `therapist` is included alongside the admin roles: a clinician reviewing a wellbeing article is
 * exactly the reviewer this field exists to record, and excluding them made the list narrower than
 * the editorial process actually is.
 */
export const AUTHOR_ELIGIBLE_ROLES = ['super_admin', 'org_admin', 'team_admin', 'therapist'];

/**
 * Eligible people, filtered BY THE SERVER.
 *
 * This used to request `page=1&limit=100` and filter for admin roles in the browser. With 269
 * profiles and both admins created months earlier, neither appeared in the newest-100 window, so
 * every option was discarded and the field offered only "Unassigned" — while the profiles plainly
 * existed. Asking the API for the roles we want makes the result independent of how many members
 * have signed up since, which is the part that was actually broken.
 */
function useEligiblePeople() {
  return useQuery({
    queryKey: ['contentHub', 'people', AUTHOR_ELIGIBLE_ROLES],
    queryFn: async () => {
      const result = (await api.admin.getUsers({
        page: 1,
        limit: 200,
        roles: AUTHOR_ELIGIBLE_ROLES,
      })) as unknown;

      // The endpoint returns a bare array; the other shapes are tolerated defensively.
      const rows = (result as { users?: AdminUser[]; items?: AdminUser[] } | AdminUser[]) ?? [];
      const list = Array.isArray(rows) ? rows : (rows.users ?? rows.items ?? []);

      return [...list].sort((a, b) =>
        (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''),
      );
    },
    staleTime: 5 * 60_000,
  });
}

export interface PersonSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

export function PersonSelect({ id, label, value, onChange, hint }: PersonSelectProps) {
  const { data, isLoading } = useEligiblePeople();
  const selected = data?.find((person) => person.id === value);
  /**
   * A person already stored on the record but absent from the list — deactivated, or their role
   * changed since. Rendering the raw id would look like data loss and re-saving would silently
   * drop them, so the current value is always kept selectable.
   */
  const hasStoredButUnlisted = !!value && !selected;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className={cn(adminSelect, 'w-full')}
      >
        <option value="">Unassigned</option>
        {hasStoredButUnlisted ? (
          <option value={value}>Currently assigned (no longer listed)</option>
        ) : null}
        {(data ?? []).map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name || person.email || person.id}
            {person.role ? ` — ${person.role.replace(/_/g, ' ')}` : ''}
          </option>
        ))}
      </select>

      {selected ? (
        <p className="mt-1 flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
          {selected.avatar_url ? (
            <img
              src={selected.avatar_url}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 rounded-full object-cover"
            />
          ) : null}
          {selected.full_name ?? selected.email}
        </p>
      ) : null}

      {hint ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{hint}</p> : null}
    </div>
  );
}
