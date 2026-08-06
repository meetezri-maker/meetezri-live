/**
 * Content Hub — TanStack Query keys and hooks.
 *
 * Follows the `adminQueries.ts` pattern. Keys are filter-sensitive so two different filter sets
 * never share a cache entry, and mutations invalidate ONLY the affected keys — a blanket
 * `invalidateQueries()` would refetch every admin screen in the app.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  isApiError,
  type ContentHubApprovalState,
  type ContentHubCreateBody,
  type ContentHubListParams,
  type ContentHubTransitionAction,
} from '@/lib/api';

/**
 * Query keys.
 *
 * Everything nests under the `['contentHub']` prefix so `contentHub.all()` invalidates the whole
 * feature and nothing outside it.
 */
export const contentHubKeys = {
  all: () => ['contentHub'] as const,
  lists: () => ['contentHub', 'list'] as const,
  list: (filters: ContentHubListParams) => ['contentHub', 'list', filters] as const,
  detail: (id: string) => ['contentHub', 'detail', id] as const,
  checklist: (id: string) => ['contentHub', 'checklist', id] as const,
  reviewQueues: () => ['contentHub', 'reviewQueue'] as const,
  reviewQueue: (filters: ContentHubListParams) => ['contentHub', 'reviewQueue', filters] as const,
  tags: (search?: string) => ['contentHub', 'tags', search ?? ''] as const,
};

/** Surfaces the backend's stable `code` where there is one, falling back to its message. */
function describeError(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useContentHubList(filters: ContentHubListParams) {
  return useQuery({
    queryKey: contentHubKeys.list(filters),
    queryFn: () => api.content.list(filters),
    staleTime: 60_000,
  });
}

export function useContentHubDetail(id: string | undefined) {
  return useQuery({
    queryKey: contentHubKeys.detail(id ?? ''),
    queryFn: () => api.content.getById(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useContentHubChecklist(id: string | undefined) {
  return useQuery({
    queryKey: contentHubKeys.checklist(id ?? ''),
    queryFn: () => api.content.getChecklist(id as string),
    enabled: !!id,
    // Shorter than the list: the checklist changes as gates are cleared.
    staleTime: 30_000,
  });
}

/**
 * Review queue — items awaiting editorial action, oldest first.
 *
 * A distinct key prefix from `list` so approving something refreshes the queue without
 * invalidating every filtered list the user has visited.
 */
export function useContentHubReviewQueue(filters: ContentHubListParams = {}) {
  const queueFilters: ContentHubListParams = {
    status: 'in_review',
    sort: 'updated_at',
    order: 'asc',
    pageSize: 25,
    ...filters,
  };

  return useQuery({
    queryKey: contentHubKeys.reviewQueue(queueFilters),
    queryFn: () => api.content.list(queueFilters),
    staleTime: 30_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateContent(options?: { onCreated?: (id: string) => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ContentHubCreateBody) => api.content.create(body),
    onSuccess: (created) => {
      // Only the lists — a new draft cannot affect any existing detail or checklist.
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.reviewQueues() });
      toast.success('Draft created');
      options?.onCreated?.(created.id);
    },
    onError: (error) => {
      toast.error(describeError(error, 'Could not create the draft.'));
    },
  });
}

export function useSetApproval(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { gate: string; state: ContentHubApprovalState; note?: string }) =>
      api.content.setApproval(contentId, input.gate, { state: input.state, note: input.note }),
    onSuccess: (_result, input) => {
      // A gate change can move the status, so the list and queue refresh too — but nothing
      // outside the Content Hub is touched.
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.reviewQueues() });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.detail(contentId) });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.checklist(contentId) });

      const label =
        input.state === 'approved'
          ? 'Approved'
          : input.state === 'changes_requested'
            ? 'Changes requested'
            : 'Returned to pending';
      toast.success(label);
    },
    onError: (error) => {
      toast.error(describeError(error, 'Could not update the approval.'));
    },
  });
}

export function useTransitionContent(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { action: ContentHubTransitionAction; reason?: string }) =>
      api.content.transition(contentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.reviewQueues() });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.detail(contentId) });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.checklist(contentId) });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error(describeError(error, 'Could not update the status.'));
    },
  });
}
