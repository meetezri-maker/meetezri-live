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

/** Admins are the only candidates in v1 — every author currently also holds an admin account. */
function useAdminPeople() {
  return useQuery({
    queryKey: ['contentHub', 'people'],
    queryFn: async () => {
      const result = (await api.admin.getUsers({ page: 1, limit: 100 })) as unknown;
      const rows = (result as { users?: AdminUser[]; items?: AdminUser[] } | AdminUser[]) ?? [];
      const list = Array.isArray(rows) ? rows : (rows.users ?? rows.items ?? []);
      return list.filter((user) =>
        ['super_admin', 'org_admin', 'team_admin'].includes(String(user.role ?? '')),
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
  const { data, isLoading } = useAdminPeople();
  const selected = data?.find((person) => person.id === value);

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
