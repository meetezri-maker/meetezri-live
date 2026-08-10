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
  type ContentHubLinkInput,
  type ContentHubTransitionAction,
  type ContentHubUpdateBody,
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
  // Phase 4
  links: (id: string) => ['contentHub', 'links', id] as const,
  inboundLinks: (id: string) => ['contentHub', 'inboundLinks', id] as const,
  revisions: (id: string) => ['contentHub', 'revisions', id] as const,
  revision: (id: string, number: number) => ['contentHub', 'revision', id, number] as const,
  preview: (id: string) => ['contentHub', 'preview', id] as const,
  clusterValidation: (ids: string[]) => ['contentHub', 'clusterValidation', [...ids].sort()] as const,
};

/** Surfaces the backend's stable `code` where there is one, falling back to its message. */
/**
 * A message an operator can act on, and quote.
 *
 * A server error's own text is deliberately generic ("Something went wrong on Server side"),
 * which told us nothing when the approval endpoint started failing — there was no way to tie the
 * toast to a server-side record. The API already returns a `requestId` on every error; appending
 * it costs nothing and turns an unreproducible report into a lookup.
 *
 * Only the API's own status, code and request id are shown. Nothing from Prisma or the database
 * reaches the browser.
 */
function describeError(error: unknown, fallback: string): string {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const base = error.status >= 500 ? fallback : error.message || fallback;
  const requestId = typeof error.body?.requestId === 'string' ? error.body.requestId : null;

  return requestId ? `${base} (reference ${requestId})` : base;
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

// ─── Phase 4: editor queries ─────────────────────────────────────────────────

export function useContentHubLinks(id: string | undefined) {
  return useQuery({
    queryKey: contentHubKeys.links(id ?? ''),
    queryFn: () => api.content.getLinks(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useContentHubInboundLinks(id: string | undefined) {
  return useQuery({
    queryKey: contentHubKeys.inboundLinks(id ?? ''),
    queryFn: () => api.content.getInboundLinks(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useContentHubRevisions(id: string | undefined) {
  return useQuery({
    queryKey: contentHubKeys.revisions(id ?? ''),
    queryFn: () => api.content.listRevisions(id as string, { page: 1, pageSize: 50 }),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useContentHubRevision(id: string | undefined, revisionNumber: number | null) {
  return useQuery({
    queryKey: contentHubKeys.revision(id ?? '', revisionNumber ?? 0),
    queryFn: () => api.content.getRevision(id as string, revisionNumber as number),
    enabled: !!id && revisionNumber != null,
    // Revisions are immutable, so once fetched they never need refetching.
    staleTime: Infinity,
  });
}

export function useContentHubPreview(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: contentHubKeys.preview(id ?? ''),
    queryFn: () => api.content.getPreview(id as string),
    enabled: !!id && enabled,
    staleTime: 0,
  });
}

// ─── Phase 4: mutations ──────────────────────────────────────────────────────

/** Everything the editor invalidates after a change that can move status or content. */
function invalidateEditor(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: contentHubKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: contentHubKeys.reviewQueues() });
  void queryClient.invalidateQueries({ queryKey: contentHubKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: contentHubKeys.checklist(id) });
  void queryClient.invalidateQueries({ queryKey: contentHubKeys.preview(id) });
}

/**
 * Save.
 *
 * ONE mutation for autosave and explicit save — they differ only by `createRevision`. Autosave
 * stays silent (no toast, no revision refetch); explicit save toasts and refreshes revisions.
 */
export function useSaveContent(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ContentHubUpdateBody) => api.content.update(id, body),
    onSuccess: (_result, body) => {
      if (body.createRevision) {
        toast.success('Saved');
        void queryClient.invalidateQueries({ queryKey: contentHubKeys.revisions(id) });
        invalidateEditor(queryClient, id);
      } else {
        // Autosave: refresh only what a background save can affect, and never toast — a toast
        // every two seconds is noise, not feedback.
        void queryClient.invalidateQueries({ queryKey: contentHubKeys.lists() });
      }
    },
    // No onError toast: the editor renders a persistent save-state indicator instead, and a
    // conflict opens a dialog rather than a transient message.
  });
}

export function useReplaceLinks(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (links: ContentHubLinkInput[]) => api.content.replaceLinks(id, links),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.links(id) });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.checklist(id) });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.preview(id) });
      toast.success('Links saved');
    },
    onError: (error) => toast.error(describeError(error, 'Could not save links.')),
  });
}

export function useRestoreRevision(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { revisionNumber: number; expectedUpdatedAt: string }) =>
      api.content.restoreRevision(id, input.revisionNumber, {
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.revisions(id) });
      invalidateEditor(queryClient, id);
      toast.success(`Restored revision ${input.revisionNumber}`);
    },
    onError: (error) => toast.error(describeError(error, 'Could not restore the revision.')),
  });
}

export function useSetSchedule(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduledFor: string) => api.content.setSchedule(id, scheduledFor),
    onSuccess: () => {
      invalidateEditor(queryClient, id);
      toast.success('Planned date saved');
    },
    onError: (error) => toast.error(describeError(error, 'Could not set the planned date.')),
  });
}

export function useCancelSchedule(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.content.cancelSchedule(id),
    onSuccess: () => {
      invalidateEditor(queryClient, id);
      toast.success('Planned date cleared');
    },
    onError: (error) => toast.error(describeError(error, 'Could not clear the planned date.')),
  });
}

export function useValidateCluster() {
  return useMutation({
    mutationFn: (contentIds: string[]) => api.content.validateCluster(contentIds),
    onError: (error) => toast.error(describeError(error, 'Could not validate the cluster.')),
  });
}

export function usePublishCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contentIds: string[]) => api.content.publishCluster(contentIds),
    onSuccess: (result, contentIds) => {
      // Every member's detail, checklist and preview is now stale, plus the shared lists.
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contentHubKeys.reviewQueues() });
      for (const id of contentIds) invalidateEditor(queryClient, id);
      toast.success(`Published ${result.published.length} items together`);
    },
    onError: (error) => toast.error(describeError(error, 'Could not publish the cluster.')),
  });
}
