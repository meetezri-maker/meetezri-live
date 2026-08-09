/**
 * Public Content Hub queries.
 *
 * DELIBERATELY SEPARATE FROM `contentHubQueries.ts`. The admin keys cache authenticated,
 * per-user, frequently-invalidated data; these cache anonymous, shared, long-lived data. Merging
 * the two key spaces is how an admin's draft list ends up in a cache that a logged-out visitor
 * reads, and how a public page ends up being invalidated on every admin save.
 *
 * There are no mutations here. The public API is read-only.
 */

import { useQuery } from '@tanstack/react-query';
import { api, type PublicLabel } from '@/lib/api';

export const publicContentKeys = {
  all: ['publicContent'] as const,
  list: (filters: { page: number; type: PublicLabel | null }) =>
    [...publicContentKeys.all, 'list', filters] as const,
  detail: (slug: string) => [...publicContentKeys.all, 'detail', slug] as const,
  related: (slug: string) => [...publicContentKeys.all, 'related', slug] as const,
};

/**
 * Anonymous public content changes on a publish, not on a click.
 *
 * Five minutes fresh matches the CDN's `s-maxage`, so the browser and the shared cache agree on
 * how stale a page may be — and a reader tabbing between resources does not refetch.
 */
const PUBLIC_STALE_MS = 5 * 60 * 1000;

export function usePublicResources(filters: { page: number; type: PublicLabel | null }) {
  return useQuery({
    queryKey: publicContentKeys.list(filters),
    queryFn: () =>
      api.publicContent.list({
        page: filters.page,
        pageSize: 12,
        type: filters.type ?? undefined,
      }),
    staleTime: PUBLIC_STALE_MS,
  });
}

export function usePublicResource(slug: string | undefined) {
  return useQuery({
    queryKey: publicContentKeys.detail(slug ?? ''),
    queryFn: () => api.publicContent.detail(slug!),
    enabled: !!slug,
    staleTime: PUBLIC_STALE_MS,
    // A 404 here means "not published", which no amount of retrying will change.
    retry: false,
  });
}
