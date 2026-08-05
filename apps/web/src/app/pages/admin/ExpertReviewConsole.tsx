import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Clock, Loader2, MessageSquare, RefreshCw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { AdminPaginationBar } from '@/app/components/admin/AdminPaginationBar';
import { ApiError, api, type ExpertReviewConversation, type ExpertReviewConversationListResponse } from '@/lib/api';

type ReviewFilter = 'pending' | 'reviewed' | 'all';

type ReviewForm = {
  expert_analysis: string;
  expert_rephrased: string;
};

const PAGE_SIZE = 25;
const MIN_REVIEW_LENGTH = 10;
const ANALYSIS_MAX = 10000;
const REPHRASED_MAX = 20000;

function getReviewedParam(filter: ReviewFilter): boolean | undefined {
  if (filter === 'pending') return false;
  if (filter === 'reviewed') return true;
  return undefined;
}

function formatDate(value: string | null): string {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function preview(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function getFieldError(value: string, min: number, max: number, label: string): string | null {
  const length = value.trim().length;
  if (length === 0) return `${label} is required.`;
  if (length < min) return `${label} must be at least ${min} characters.`;
  if (length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have access to Expert Reviews.';
    if (error.status === 502 || error.status === 503) return 'Expert Reviews are temporarily unavailable.';
  }
  return 'Could not load Expert Reviews. Please try again.';
}

function getSaveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 422) return 'Please check the review fields and try again.';
    if (error.status === 404) return 'This conversation could not be found.';
    if (error.status === 502 || error.status === 503) return 'Expert Reviews are temporarily unavailable.';
    if (error.status === 403) return 'You do not have access to save Expert Reviews.';
  }
  return 'Could not save the expert review. Please try again.';
}

function StatusBadge({ reviewed }: { reviewed: boolean | null }) {
  if (reviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Reviewed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
      <Clock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading expert reviews">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-10/12 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-8/12 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({
  conversation,
  isLoading,
  isSaving,
  onClose,
  onSave,
}: {
  conversation: ExpertReviewConversation | null;
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: string, form: ReviewForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ReviewForm>({ expert_analysis: '', expert_rephrased: '' });

  useEffect(() => {
    if (!conversation) return;
    setForm({
      expert_analysis: conversation.expert_analysis ?? '',
      expert_rephrased: conversation.expert_rephrased ?? '',
    });
  }, [conversation?.id]);

  const analysisError = getFieldError(form.expert_analysis, MIN_REVIEW_LENGTH, ANALYSIS_MAX, 'Expert analysis');
  const rephrasedError = getFieldError(form.expert_rephrased, MIN_REVIEW_LENGTH, REPHRASED_MAX, 'Expert rephrased response');
  const canSave = !!conversation && !analysisError && !rephrasedError && !isSaving;

  const handleSave = async () => {
    if (!conversation || !canSave) return;
    await onSave(conversation.id, {
      expert_analysis: form.expert_analysis.trim(),
      expert_rephrased: form.expert_rephrased.trim(),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="my-8 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">Expert Review</h2>
            </div>
            {conversation ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span>{formatDate(conversation.created_at)}</span>
                {conversation.session_id ? <span className="font-mono text-xs">Session {conversation.session_id}</span> : null}
                <StatusBadge reviewed={conversation.is_reviewed} />
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close review">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center" aria-label="Loading conversation detail">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : conversation ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
            <section className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">User message</h3>
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-gray-900">
                  {conversation.user_query}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Assistant response</h3>
                <div className="max-h-96 overflow-y-auto rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm leading-relaxed text-gray-900">
                  {conversation.brain_output}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-800">Expert analysis</span>
                <textarea
                  value={form.expert_analysis}
                  onChange={(event) => setForm((prev) => ({ ...prev, expert_analysis: event.target.value }))}
                  rows={8}
                  className="w-full resize-y rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-500"
                  aria-invalid={!!analysisError}
                />
                <span className="mt-1 flex justify-between gap-3 text-xs text-gray-500">
                  <span className={analysisError ? 'text-red-600' : ''}>{analysisError ?? 'Required'}</span>
                  <span>{form.expert_analysis.trim().length}/{ANALYSIS_MAX}</span>
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-800">Expert rephrased response</span>
                <textarea
                  value={form.expert_rephrased}
                  onChange={(event) => setForm((prev) => ({ ...prev, expert_rephrased: event.target.value }))}
                  rows={10}
                  className="w-full resize-y rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-500"
                  aria-invalid={!!rephrasedError}
                />
                <span className="mt-1 flex justify-between gap-3 text-xs text-gray-500">
                  <span className={rephrasedError ? 'text-red-600' : ''}>{rephrasedError ?? 'Required'}</span>
                  <span>{form.expert_rephrased.trim().length}/{REPHRASED_MAX}</span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!canSave}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save review
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Conversation detail could not be loaded.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function ExpertReviewConsole() {
  const [items, setItems] = useState<ExpertReviewConversation[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ExpertReviewConversation | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadConversations = useCallback(async (nextPage = page, nextFilter = filter) => {
    const firstLoad = items.length === 0;
    setError(null);
    setIsLoading(firstLoad);
    setIsFilterLoading(!firstLoad);
    try {
      const data: ExpertReviewConversationListResponse = await api.admin.getExpertReviewConversations({
        page: nextPage,
        limit: PAGE_SIZE,
        reviewed: getReviewedParam(nextFilter),
      });
      setItems(data.items);
      setPage(data.page);
      setTotal(data.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(getSafeErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsFilterLoading(false);
    }
  }, [filter, items.length, page]);

  useEffect(() => {
    void loadConversations(1, 'pending');
  }, []);

  const handleFilterChange = (nextFilter: ReviewFilter) => {
    setFilter(nextFilter);
    setPage(1);
    void loadConversations(1, nextFilter);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    void loadConversations(nextPage, filter);
  };

  const openConversation = async (conversation: ExpertReviewConversation) => {
    setSelectedId(conversation.id);
    setSelectedConversation(null);
    setIsDetailLoading(true);
    try {
      const detail = await api.admin.getExpertReviewConversation(conversation.id);
      setSelectedConversation(detail);
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
      setSelectedId(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSave = async (id: string, form: ReviewForm) => {
    setIsSaving(true);
    try {
      const updated = await api.admin.saveExpertReviewConversation(id, form);
      setSelectedConversation(updated);
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Expert review saved');
    } catch (err) {
      toast.error(getSaveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const emptyTitle = useMemo(() => {
    if (filter === 'pending') return 'No pending expert reviews';
    if (filter === 'reviewed') return 'No reviewed conversations';
    return 'No conversations found';
  }, [filter]);

  return (
    <AdminLayoutNew>
      <div className="p-4 sm:p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Expert Reviews</h1>
              <p className="text-gray-600">Review AI conversation quality and save expert analysis.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadConversations(page, filter)}
            disabled={isLoading || isFilterLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading || isFilterLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Expert review filters">
          {(['pending', 'reviewed', 'all'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleFilterChange(option)}
              aria-pressed={filter === option}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                filter === option
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option === 'pending' ? 'Pending' : option === 'reviewed' ? 'Reviewed' : 'All'}
            </button>
          ))}
          {isFilterLoading ? <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading</span> : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <AlertCircle className="h-5 w-5" />
              Expert Reviews unavailable
            </div>
            <p className="mb-4 text-sm">{error}</p>
            <button type="button" onClick={() => void loadConversations(page, filter)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <ReviewSkeleton />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <MessageSquare className="mx-auto mb-4 h-14 w-14 text-gray-300" />
            <h2 className="mb-2 text-xl font-bold text-gray-900">{emptyTitle}</h2>
            <p className="text-gray-600">Change filters or check again later.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((conversation, index) => (
                <motion.article
                  key={conversation.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.18) }}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <span>{formatDate(conversation.created_at)}</span>
                        <StatusBadge reviewed={conversation.is_reviewed} />
                      </div>
                      <h2 className="text-base font-bold text-gray-900">{preview(conversation.user_query, 120)}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openConversation(conversation)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Review
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">User message</p>
                      <p className="text-sm leading-relaxed text-gray-800">{preview(conversation.user_query)}</p>
                    </div>
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-3">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-purple-700">Assistant response</p>
                      <p className="text-sm leading-relaxed text-gray-800">{preview(conversation.brain_output)}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
            <AdminPaginationBar
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              onPageSizeChange={() => undefined}
              selectId="expert-review-page-size"
              pageSizeOptions={[PAGE_SIZE]}
              className="mt-6 rounded-2xl border border-gray-200 bg-white"
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedId ? (
          <ReviewModal
            conversation={selectedConversation}
            isLoading={isDetailLoading}
            isSaving={isSaving}
            onClose={() => {
              if (!isSaving) {
                setSelectedId(null);
                setSelectedConversation(null);
              }
            }}
            onSave={handleSave}
          />
        ) : null}
      </AnimatePresence>
    </AdminLayoutNew>
  );
}