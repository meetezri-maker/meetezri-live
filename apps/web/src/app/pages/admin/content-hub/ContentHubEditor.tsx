/**
 * Content Hub — full editor workspace (`/admin/content-hub/:id`).
 *
 * REPLACES the Phase 3 `ContentHubDraftShell`. There is exactly one detail screen; the temporary
 * shell and its "editing arrives in Phase 4" messaging are gone.
 *
 * Six tabs over one form state. The tab is in the URL (`?tab=`) so a colleague can be sent
 * straight to the SEO tab, and switching tabs never loses unsaved work because every tab reads
 * from the same in-memory state rather than remounting a form.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, Loader2, Save } from 'lucide-react';
import {
  deriveReadingStats,
  normaliseSlug,
  type ContentBody,
  type ContentType,
} from '@meetezri/shared';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import {
  adminBtnPrimary,
  adminBtnSecondary,
  adminCardStatic,
  adminPageAtmosphere,
  adminPageGlowTeal,
  adminPageGlowTop,
  adminPageRoot,
  adminPageTitle,
  adminPageVignette,
} from '@/app/admin';
import { useAuth } from '@/app/contexts/AuthContext';
import { useContentHubDetail, useSaveContent } from '@/lib/queries/contentHubQueries';
import { cn } from '@/lib/utils';
import { ApprovalDots } from './components/ApprovalDots';
import { ContentErrorState } from './components/ContentStates';
import { ContentStatusPill } from './components/ContentStatusPill';
import { ContentTypeBadge } from './components/ContentTypeBadge';
import { ConfirmActionDialog } from './components/ConfirmActionDialog';
import { ConflictDialog } from './components/ConflictDialog';
import { BlockEditor } from './editor/BlockEditor';
import { useEditorState, useUnsavedChangesWarning } from './editor/useEditorState';
import {
  editorDraftSchema,
  toUpdateBody,
  validateDocument,
  type EditorFormValues,
  type EditorTab,
} from './schema/contentHubEditor.schema';
import { OverviewTab } from './tabs/OverviewTab';
import { EditorialBriefTab } from './tabs/EditorialBriefTab';
import { SeoSignalsTab } from './tabs/SeoSignalsTab';
import { LinksTab } from './tabs/LinksTab';
import { ReviewPublishTab } from './tabs/ReviewPublishTab';

const TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'brief', label: 'Editorial Brief' },
  { id: 'content', label: 'Content' },
  { id: 'seo', label: 'SEO & Signals' },
  { id: 'links', label: 'Links' },
  { id: 'review', label: 'Review & Publish' },
];

function isEditorTab(value: string | null): value is EditorTab {
  return !!value && TABS.some((tab) => tab.id === value);
}

export function ContentHubEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = (profile?.role ?? 'team_admin') as string;

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeTab: EditorTab = isEditorTab(urlTab) ? urlTab : 'overview';

  const { data, isLoading, isError, refetch } = useContentHubDetail(id);
  const saveMutation = useSaveContent(id ?? '');

  // Body, type fields and editorial live outside react-hook-form: they are nested structures the
  // block editor mutates wholesale, and RHF adds nothing for them but re-render cost.
  const [body, setBody] = useState<ContentBody>({ version: 1, blocks: [] });
  const [typeFields, setTypeFields] = useState<Record<string, unknown>>({});
  const [editorial, setEditorial] = useState<Record<string, unknown>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  /** Set when a guarded link was clicked while unsaved work was on screen. */
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  const form = useForm<EditorFormValues>({
    // Same cast as elsewhere in the repo — resolvers v5 types against zod v3 shapes.
    resolver: zodResolver(editorDraftSchema as any),
    defaultValues: { robotsDirective: 'index,follow' },
  });

  const editorState = useEditorState({
    content: data,
    save: (payload) => saveMutation.mutateAsync(payload),
  });
  useUnsavedChangesWarning(editorState.isDirty);

  // Hydrate once the record arrives, and again after a restore or conflict reload.
  useEffect(() => {
    if (!data) return;
    form.reset({
      title: data.title,
      slug: data.slug,
      metaDescription: data.metaDescription ?? '',
      featuredImageUrl: data.featuredImageUrl ?? '',
      featuredImageAlt: data.featuredImageAlt ?? '',
      pillar: data.pillar ?? '',
      week: data.week ?? '',
      tagsInput: (data.tags ?? []).join(', '),
      editorialRef: data.editorialRef ?? '',
      authorId: data.author?.id ?? '',
      reviewerId: data.reviewer?.id ?? '',
      reviewedAt: data.reviewedAt ? data.reviewedAt.slice(0, 10) : '',
      canonicalUrlOverride: data.canonicalUrlOverride ?? '',
      robotsDirective: (data.robotsDirective as never) ?? 'index,follow',
    });
    setBody((data.body as ContentBody) ?? { version: 1, blocks: [] });
    setTypeFields(data.typeFields ?? {});
    setEditorial(data.editorial ?? {});
    setSlugTouched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, data?.updatedAt]);

  const buildBody = useCallback(
    (createRevision: boolean, confirmSlugChange?: boolean, changeSummary?: string) => () =>
      toUpdateBody(form.getValues(), {
        body,
        typeFields,
        editorial,
        expectedUpdatedAt: editorState.currentToken ?? data?.updatedAt ?? '',
        createRevision,
        confirmSlugChange,
        changeSummary,
      }),
    [form, body, typeFields, editorial, editorState.currentToken, data?.updatedAt],
  );

  /** Any authored change marks dirty and schedules an autosave. */
  const touch = useCallback(() => {
    editorState.markDirty(buildBody(false));
  }, [editorState, buildBody]);

  const handleBodyChange = useCallback(
    (next: ContentBody) => {
      setBody(next);
      editorState.markDirty(() =>
        toUpdateBody(form.getValues(), {
          body: next,
          typeFields,
          editorial,
          expectedUpdatedAt: editorState.currentToken ?? '',
          createRevision: false,
        }),
      );
    },
    [editorState, form, typeFields, editorial],
  );

  const contentType = (data?.contentType ?? 'seo_blog') as ContentType;
  const validation = useMemo(() => validateDocument(body, contentType), [body, contentType]);
  const stats = useMemo(() => deriveReadingStats(body), [body]);

  const errorsByTab = useMemo(() => {
    const counts: Partial<Record<EditorTab, number>> = {};
    for (const issue of validation.errors) counts[issue.tab] = (counts[issue.tab] ?? 0) + 1;
    for (const [field] of Object.entries(form.formState.errors)) {
      const tab: EditorTab = ['metaDescription', 'featuredImageUrl', 'featuredImageAlt', 'canonicalUrlOverride', 'robotsDirective'].includes(field)
        ? 'seo'
        : 'overview';
      counts[tab] = (counts[tab] ?? 0) + 1;
    }
    return counts;
  }, [validation.errors, form.formState.errors]);

  const setTab = (tab: EditorTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  /**
   * Guards the links that leave this record.
   *
   * `BrowserRouter` is mounted directly (`.cursorrules`), so React Router v7's data-router blocker
   * is unavailable — the guard is applied at the two links that leave the editor rather than by
   * intercepting the history stack. Anything that navigates by other means is still covered by the
   * `beforeunload` handler on a real page load.
   */
  const guardNavigation = (to: string) => (event: React.MouseEvent) => {
    if (!editorState.isDirty) return;
    event.preventDefault();
    setPendingDestination(to);
  };

  const handleExplicitSave = form.handleSubmit(async () => {
    const isPublished = data?.status === 'published';
    const slugChanged = data && normaliseSlug(form.getValues('slug') ?? '') !== data.slug;
    await editorState.saveNow(buildBody(true, isPublished && slugChanged ? true : undefined));
  });

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className={cn(adminPageRoot, 'p-6')}>
          <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
            Loading content…
          </p>
        </div>
      </AdminLayoutNew>
    );
  }

  if (isError || !data || !id) {
    return (
      <AdminLayoutNew>
        <div className={cn(adminPageRoot, 'p-6')}>
          <ContentErrorState onRetry={() => void refetch()} message="Could not load this content." />
        </div>
      </AdminLayoutNew>
    );
  }

  const saveLabel = (() => {
    switch (editorState.saveState.kind) {
      case 'saving':
        return 'Saving…';
      case 'saved':
        return `Saved ${new Date(editorState.saveState.at).toLocaleTimeString()}`;
      case 'dirty':
        return 'Unsaved changes';
      case 'error':
        return editorState.saveState.message;
      default:
        return 'Up to date';
    }
  })();

  return (
    <AdminLayoutNew>
      <div className={adminPageRoot}>
        <div className={adminPageAtmosphere} aria-hidden="true">
          <div className={adminPageGlowTop} />
          <div className={adminPageGlowTeal} />
          <div className={adminPageVignette} />
        </div>

        <div className="relative z-10 space-y-4 p-4 sm:p-6">
          <Link
            to="/admin/content-hub"
            onClick={guardNavigation('/admin/content-hub')}
            className={cn(adminBtnSecondary, 'inline-flex items-center gap-2')}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            All content
          </Link>

          {/* Header — identity, state and the always-reachable actions. */}
          <div className={cn(adminCardStatic, 'p-4')}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className={cn(adminPageTitle, 'truncate')}>{data.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ContentTypeBadge contentType={data.contentType} label={data.publicLabel} />
                  <ContentStatusPill
                    status={data.status}
                    schedule={data.schedule}
                    scheduledFor={data.scheduledFor}
                  />
                  <ApprovalDots approvals={data.approvals} />
                </div>
                <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                  {stats.wordCount} words · {stats.readingTimeMinutes} min read ·{' '}
                  <span
                    role="status"
                    aria-live="polite"
                    className={editorState.saveState.kind === 'error' ? 'text-red-300' : undefined}
                  >
                    {saveLabel}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/admin/content-hub/${id}/preview`}
                  onClick={guardNavigation(`/admin/content-hub/${id}/preview`)}
                  className={cn(adminBtnSecondary, 'inline-flex items-center gap-2')}
                >
                  <Eye aria-hidden="true" className="h-4 w-4" />
                  Preview
                </Link>
                <button
                  type="button"
                  onClick={handleExplicitSave}
                  disabled={editorState.saveState.kind === 'saving'}
                  className={cn(adminBtnPrimary, 'inline-flex items-center gap-2')}
                >
                  {editorState.saveState.kind === 'saving' ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save aria-hidden="true" className="h-4 w-4" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Tabs — scroll horizontally on narrow widths rather than wrapping the action bar. */}
          <div className={cn(adminCardStatic, 'overflow-x-auto')}>
            <div role="tablist" aria-label="Editor sections" className="flex min-w-max">
              {TABS.map((tab) => {
                const errorCount = errorsByTab[tab.id] ?? 0;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => setTab(tab.id)}
                    onKeyDown={(e) => {
                      const index = TABS.findIndex((t) => t.id === activeTab);
                      if (e.key === 'ArrowRight') setTab(TABS[(index + 1) % TABS.length].id);
                      if (e.key === 'ArrowLeft') setTab(TABS[(index - 1 + TABS.length) % TABS.length].id);
                    }}
                    className={cn(
                      'whitespace-nowrap border-b-2 px-4 py-3 text-sm',
                      activeTab === tab.id
                        ? 'border-teal-400 text-[var(--admin-text)]'
                        : 'border-transparent text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]',
                    )}
                  >
                    {tab.label}
                    {errorCount > 0 ? (
                      <span
                        className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300"
                        aria-label={`${errorCount} ${errorCount === 1 ? 'problem' : 'problems'}`}
                      >
                        {errorCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            className="space-y-4"
          >
            {activeTab === 'overview' ? (
              <OverviewTab
                form={form}
                content={data}
                slugTouched={slugTouched}
                onSlugTouched={() => setSlugTouched(true)}
                onChange={touch}
              />
            ) : null}

            {activeTab === 'brief' ? (
              <EditorialBriefTab
                contentType={contentType}
                editorial={editorial}
                typeFields={typeFields}
                onEditorialChange={(next) => {
                  setEditorial(next);
                  touch();
                }}
                onTypeFieldsChange={(next) => {
                  setTypeFields(next);
                  touch();
                }}
              />
            ) : null}

            {activeTab === 'content' ? (
              <>
                {validation.publishBlockers.length > 0 ? (
                  <div
                    className={cn(adminCardStatic, 'border-amber-400/30 bg-amber-400/[0.05] p-4')}
                    role="status"
                  >
                    <p className="text-sm font-medium text-amber-200">
                      Saveable, but these will block publishing
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--admin-text-secondary)]">
                      {validation.publishBlockers.map((issue) => (
                        <li key={`${issue.code}-${issue.blockId ?? ''}`}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <BlockEditor
                  body={body}
                  contentType={contentType}
                  onChange={handleBodyChange}
                  issues={validation.errors}
                />
              </>
            ) : null}

            {activeTab === 'seo' ? (
              <SeoSignalsTab
                form={form}
                contentType={contentType}
                typeFields={typeFields}
                onTypeFieldsChange={(next) => {
                  setTypeFields(next);
                  touch();
                }}
                onChange={touch}
                wordCount={stats.wordCount}
                publicLabel={data.publicLabel}
                slug={data.slug}
              />
            ) : null}

            {activeTab === 'links' ? <LinksTab contentId={id} /> : null}

            {activeTab === 'review' ? (
              <ReviewPublishTab contentId={id} content={data} role={role} />
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={pendingDestination !== null}
        onOpenChange={(open) => !open && setPendingDestination(null)}
        title="Leave without saving?"
        body="This content has changes that have not been saved. Leaving now discards them."
        confirmLabel="Leave without saving"
        onConfirm={() => {
          const destination = pendingDestination;
          setPendingDestination(null);
          if (destination) navigate(destination);
        }}
      />

      <ConflictDialog
        conflict={editorState.conflict}
        onReload={async () => {
          const fresh = await refetch();
          if (fresh.data) editorState.resolveConflict(fresh.data.updatedAt);
        }}
      />
    </AdminLayoutNew>
  );
}
