/**
 * Links tab — outbound editorial links and the read-only inbound view.
 *
 * Targets are either MANAGED CONTENT (by id) or a ROUTE REGISTRY KEY. Arbitrary internal URLs are
 * deliberately not offered: content links resolve to the target's current slug, so they survive a
 * rename, and route links resolve through the registry, so a route change is a one-line edit
 * rather than a data migration.
 *
 * The API replaces the whole set in one transaction, so this editor holds a draft list locally
 * and saves it as a unit.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { LINK_RELATIONS, ROUTE_KEYS, ROUTE_REGISTRY, interimRouteKeys } from '@meetezri/shared';
import { adminBtnPrimary, adminBtnSecondary, adminCardStatic, adminInput, adminSelect } from '@/app/admin';
import { cn } from '@/lib/utils';
import type { ContentHubLink, ContentHubLinkInput, ContentHubListItem } from '@/lib/api';
import {
  useContentHubInboundLinks,
  useContentHubLinks,
  useContentHubList,
  useReplaceLinks,
} from '@/lib/queries/contentHubQueries';

export interface LinksTabProps {
  contentId: string;
}

type DraftLink = ContentHubLinkInput & { key: string; hydrated?: ContentHubLink };

function toDraft(link: ContentHubLink): DraftLink {
  return {
    key: link.id,
    targetKind: link.targetKind,
    targetContentId: link.targetContentId,
    targetRoute: link.targetRoute,
    anchorText: link.anchorText,
    relation: link.relation,
    sortOrder: link.sortOrder,
    hydrated: link,
  };
}

export function LinksTab({ contentId }: LinksTabProps) {
  const linksQuery = useContentHubLinks(contentId);
  const inboundQuery = useContentHubInboundLinks(contentId);
  const replaceMutation = useReplaceLinks(contentId);

  // Candidate targets. Capped — a picker, not a browser.
  const candidates = useContentHubList({ page: 1, pageSize: 100, sort: 'title', order: 'asc' });

  const [draft, setDraft] = useState<DraftLink[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (linksQuery.data) {
      setDraft(linksQuery.data.links.map(toDraft));
      setDirty(false);
    }
  }, [linksQuery.data]);

  const byId = useMemo(() => {
    const map = new Map<string, ContentHubListItem>();
    for (const item of candidates.data?.items ?? []) map.set(item.id, item);
    return map;
  }, [candidates.data]);

  const update = (index: number, patch: Partial<DraftLink>) => {
    setDraft((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)));
    setDirty(true);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next.map((link, i) => ({ ...link, sortOrder: i })));
    setDirty(true);
  };

  /** Warnings the operator should see before saving. Never silently corrected. */
  const warningsFor = (link: DraftLink, index: number): string[] => {
    const warnings: string[] = [];

    if (link.targetKind === 'content') {
      if (!link.targetContentId) {
        warnings.push('Choose a target.');
      } else {
        if (link.targetContentId === contentId) warnings.push('This links to itself.');
        const target = byId.get(link.targetContentId) ?? undefined;
        const status = target?.status ?? link.hydrated?.targetStatus ?? null;
        if (status && status !== 'published') {
          warnings.push(
            status === 'archived'
              ? 'Target is archived — the link will not render publicly.'
              : 'Target is not published yet — publishing will be blocked unless they publish together.',
          );
        }
        const duplicate = draft.some(
          (other, i) =>
            i !== index &&
            other.targetKind === 'content' &&
            other.targetContentId === link.targetContentId &&
            other.relation === link.relation,
        );
        if (duplicate) warnings.push('Duplicate link to the same target and relation.');
      }
    }

    if (link.targetKind === 'route') {
      if (!link.targetRoute) warnings.push('Choose a destination.');
      else if (!ROUTE_KEYS.includes(link.targetRoute as never)) warnings.push('This route is not mapped.');
      // `interimRouteKeys()` rather than reading `.interim` directly: the registry uses
      // `as const satisfies`, so entries that omit the flag do not have the property in their type.
      else if (interimRouteKeys().includes(link.targetRoute as never)) {
        warnings.push('This destination is an interim mapping and will move later.');
      }
    }

    if (!link.anchorText?.trim()) {
      warnings.push('No anchor text — the target title will be used.');
    }

    return warnings;
  };

  const blocking = draft.some((link, index) =>
    warningsFor(link, index).some(
      (w) => w.includes('itself') || w.includes('Duplicate') || w.includes('not mapped') || w.includes('Choose'),
    ),
  );

  return (
    <div className="space-y-4">
      <div className={cn(adminCardStatic, 'p-6')}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">Outbound links</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft((current) => [
                  ...current,
                  {
                    key: `new-${Date.now()}`,
                    targetKind: 'content',
                    targetContentId: null,
                    targetRoute: null,
                    anchorText: '',
                    relation: 'related_content',
                    sortOrder: current.length,
                  },
                ]);
                setDirty(true);
              }}
              className={cn(adminBtnSecondary, 'inline-flex items-center gap-2')}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add link
            </button>
            <button
              type="button"
              disabled={!dirty || blocking || replaceMutation.isPending}
              onClick={() =>
                replaceMutation.mutate(
                  draft.map(({ key, hydrated, ...link }, index) => ({ ...link, sortOrder: index })),
                  { onSuccess: () => setDirty(false) },
                )
              }
              className={cn(adminBtnPrimary, 'inline-flex items-center gap-2')}
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {replaceMutation.isPending ? 'Saving…' : 'Save links'}
            </button>
          </div>
        </div>

        {linksQuery.isLoading ? (
          <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
            Loading links…
          </p>
        ) : draft.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-secondary)]">
            No outbound links yet. Internal links help readers and strengthen the topic cluster.
          </p>
        ) : (
          <ol className="space-y-3">
            {draft.map((link, index) => {
              const warnings = warningsFor(link, index);
              const target = link.targetContentId ? byId.get(link.targetContentId) : undefined;

              return (
                <li key={link.key} className="rounded-md border border-white/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--admin-text-secondary)]">Link {index + 1}</span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move link ${index + 1} up`}
                        className="rounded border border-white/10 p-1 text-[var(--admin-text-secondary)] disabled:opacity-30"
                      >
                        <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === draft.length - 1}
                        aria-label={`Move link ${index + 1} down`}
                        className="rounded border border-white/10 p-1 text-[var(--admin-text-secondary)] disabled:opacity-30"
                      >
                        <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft((current) => current.filter((_, i) => i !== index));
                          setDirty(true);
                        }}
                        aria-label={`Remove link ${index + 1}`}
                        className="rounded border border-white/10 p-1 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--admin-text-secondary)]">Type</label>
                      <select
                        value={link.targetKind}
                        onChange={(e) =>
                          update(index, {
                            targetKind: e.target.value as 'content' | 'route',
                            targetContentId: null,
                            targetRoute: null,
                          })
                        }
                        aria-label={`Link ${index + 1} type`}
                        className={cn(adminSelect, 'w-full')}
                      >
                        <option value="content">Content Hub item</option>
                        <option value="route">Site page</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-[var(--admin-text-secondary)]">Destination</label>
                      {link.targetKind === 'content' ? (
                        <select
                          value={link.targetContentId ?? ''}
                          onChange={(e) => update(index, { targetContentId: e.target.value || null })}
                          aria-label={`Link ${index + 1} destination`}
                          className={cn(adminSelect, 'w-full')}
                        >
                          <option value="">Choose…</option>
                          {(candidates.data?.items ?? [])
                            .filter((item) => item.id !== contentId)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} — {item.publicLabel} ({item.status})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <select
                          value={link.targetRoute ?? ''}
                          onChange={(e) => update(index, { targetRoute: e.target.value || null })}
                          aria-label={`Link ${index + 1} destination`}
                          className={cn(adminSelect, 'w-full')}
                        >
                          <option value="">Choose…</option>
                          {ROUTE_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {ROUTE_REGISTRY[key].label} ({ROUTE_REGISTRY[key].href})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-[var(--admin-text-secondary)]">Anchor text</label>
                      <input
                        value={link.anchorText ?? ''}
                        onChange={(e) => update(index, { anchorText: e.target.value })}
                        aria-label={`Link ${index + 1} anchor text`}
                        className={cn(adminInput, 'w-full')}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-[var(--admin-text-secondary)]">Relation</label>
                      <select
                        value={link.relation}
                        onChange={(e) => update(index, { relation: e.target.value })}
                        aria-label={`Link ${index + 1} relation`}
                        className={cn(adminSelect, 'w-full')}
                      >
                        {LINK_RELATIONS.map((relation) => (
                          <option key={relation} value={relation}>
                            {relation.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {target ? (
                    <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                      {target.publicLabel} · /resources/{target.slug} · {target.status}
                    </p>
                  ) : null}

                  {warnings.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {warnings.map((warning) => (
                        <li key={warning} className="flex items-start gap-1.5 text-xs text-amber-300">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className={cn(adminCardStatic, 'p-6')}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
          Inbound links <span className="text-xs font-normal text-[var(--admin-text-muted)]">(read-only)</span>
        </h2>
        {inboundQuery.isLoading ? (
          <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
            Loading…
          </p>
        ) : (inboundQuery.data?.links.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--admin-text-secondary)]">
            Nothing links here yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {inboundQuery.data!.links.map((link) => (
              <li key={link.id} className="text-sm text-[var(--admin-text-secondary)]">
                <span className="text-[var(--admin-text)]">{link.sourceTitle}</span> · {link.sourceStatus}
                {link.anchorText ? ` · “${link.anchorText}”` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
