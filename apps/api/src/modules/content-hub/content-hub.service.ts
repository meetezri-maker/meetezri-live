/**
 * Content Hub — admin CRUD, revisions and link management.
 *
 * The publish state machine lives in `content-hub.publish.service.ts`, scheduling in
 * `content-hub.schedule.service.ts` and cluster publishing in `content-hub.cluster.service.ts`.
 * Public reads NEVER come through here — they go through `content-hub.read.service.ts`.
 *
 * ROLE CHECKS ARE REPEATED HERE ON PURPOSE. Route guards are UX; the service is the security
 * boundary (plan §7.6). `super_admin`-only actions re-check inside the function so a future route
 * refactor cannot silently widen them.
 */

import { randomUUID } from 'crypto';
import {
  PUBLIC_CONTENT_LABEL,
  isRouteKey,
  normaliseTags,
  resolveRouteHref,
  resolveRouteLabel,
  type ContentType,
} from '@meetezri/shared';
import prisma, { type PrismaClientLike } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/auditLog';
import { deriveContentMetrics } from '../../lib/readingTime';
import { deriveSlug, prepareSlug } from '../../lib/slug';
import {
  contentNotFound,
  contentTypeImmutable,
  forbiddenAction,
  invalidLink,
  mapPrismaUniqueViolation,
  revisionNotFound,
  slugChangeNotConfirmed,
  slugInvalid,
  slugReserved,
  slugTaken,
  staleUpdate,
} from './content-hub.errors';
import {
  captureRevision,
  type RevisionCapture,
} from './content-hub.revision';
import type {
  CreateContentInput,
  LinkInput,
  ListContentQuery,
  UpdateContentInput,
} from './content-hub.schema';

export type AdminRole = 'super_admin' | 'org_admin' | 'team_admin';

export interface Actor {
  id: string;
  role: AdminRole;
}

const PERSON_SELECT = { id: true, full_name: true, email: true } as const;

// ─── Derived helpers ─────────────────────────────────────────────────────────

/**
 * Scheduling is derived, never stored as a status.
 *
 * `scheduled` means `status === 'approved'` AND `scheduled_for` is set — computing it makes the
 * inconsistent state (a `scheduled` status with no date) unrepresentable.
 */
export function deriveScheduleState(status: string, scheduledFor: Date | null) {
  const scheduled = status === 'approved' && scheduledFor !== null;
  return { scheduled, overdue: scheduled && scheduledFor!.getTime() <= Date.now() };
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mapListItem(row: any) {
  return {
    id: row.id,
    editorialRef: row.editorial_ref,
    contentType: row.content_type,
    publicLabel: PUBLIC_CONTENT_LABEL[row.content_type as ContentType],
    slug: row.slug,
    title: row.title,
    status: row.status,
    approvals: {
      founder: row.founder_approval,
      marketing: row.marketing_approval,
      seo: row.seo_approval,
    },
    schedule: deriveScheduleState(row.status, row.scheduled_for),
    scheduledFor: toIso(row.scheduled_for),
    tags: row.tags ?? [],
    pillar: row.pillar,
    week: row.week,
    author: row.profiles_author
      ? {
          id: row.profiles_author.id,
          fullName: row.profiles_author.full_name,
          email: row.profiles_author.email,
        }
      : null,
    readingTimeMinutes: row.reading_time_minutes,
    wordCount: row.word_count,
    publishedAt: toIso(row.published_at),
    updatedAt: row.updated_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function listContent(query: ListContentQuery) {
  const where: Record<string, unknown> = { deleted_at: null };

  if (query.contentType) where.content_type = query.contentType;
  if (query.status) where.status = query.status;
  if (query.pillar) where.pillar = query.pillar;
  if (query.week !== undefined) where.week = query.week;

  // `hasSome` -> `tags && ARRAY[...]`. Correct and fast at v1 volume with no index (plan §1.2.2).
  if (query.tags && query.tags.length > 0) where.tags = { hasSome: query.tags };

  if (query.awaitingApproval) {
    where.status = 'in_review';
  }

  if (query.dueToPublish) {
    where.status = 'approved';
    where.scheduled_for = { lte: new Date() };
  }

  // Search is limited to the three approved v1 fields — no body full-text search.
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
      { editorial_ref: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const take = Math.min(Math.max(query.pageSize, 1), 100);
  const skip = (Math.max(query.page, 1) - 1) * take;

  const [rows, total] = await Promise.all([
    prisma.content_items.findMany({
      where,
      include: { profiles_author: { select: PERSON_SELECT } },
      orderBy: { [query.sort]: query.order },
      take,
      skip,
    }),
    prisma.content_items.count({ where }),
  ]);

  return { items: rows.map(mapListItem), total, page: query.page, pageSize: take };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createContent(input: CreateContentInput, actor: Actor) {
  const rawSlug = input.slug ?? deriveSlug(input.title);
  if (!rawSlug) throw slugInvalid(input.slug ?? input.title);

  const prepared = prepareSlug(rawSlug);
  if (!prepared.valid) {
    throw prepared.reason === 'reserved' ? slugReserved(prepared.slug) : slugInvalid(prepared.slug);
  }

  try {
    const created = await prisma.content_items.create({
      data: {
        content_type: input.contentType,
        title: input.title,
        slug: prepared.slug,
        pillar: input.pillar ?? null,
        week: input.week ?? null,
        tags: input.tags ?? [],
        editorial_ref: input.editorialRef ?? null,
        author_id: input.authorId ?? null,
        created_by: actor.id,
        updated_by: actor.id,
      },
      include: { profiles_author: { select: PERSON_SELECT } },
    });

    // No revision on create: the approved rule is that revisions come from explicit saves,
    // transitions and restores. A create has nothing to compare against.
    await writeAuditLog({
      actorId: actor.id,
      action: 'content.created',
      details: {
        contentId: created.id,
        contentType: created.content_type,
        slug: created.slug,
        editorialRef: created.editorial_ref,
      },
    });

    return mapListItem(created);
  } catch (error) {
    const mapped = mapPrismaUniqueViolation(error, {
      slug: prepared.slug,
      editorialRef: input.editorialRef,
    });
    if (mapped) throw mapped;
    throw error;
  }
}

// ─── Get ─────────────────────────────────────────────────────────────────────

/** Approval actors come from `audit_logs` — the gates themselves store only state. */
async function loadApprovalActors(contentId: string) {
  const rows = await prisma.audit_logs.findMany({
    where: { action: 'content.approval_set' },
    orderBy: { created_at: 'desc' },
    take: 200,
    include: { profiles: { select: { id: true, full_name: true } } },
  });

  const latest = new Map<string, { actorId: string | null; actorName: string | null; at: string; state: string }>();

  for (const row of rows) {
    const details = (row.details ?? {}) as { contentId?: string; gate?: string; to?: string };
    if (details.contentId !== contentId || !details.gate) continue;
    if (latest.has(details.gate)) continue;
    latest.set(details.gate, {
      actorId: row.actor_id,
      actorName: row.profiles?.full_name ?? null,
      at: row.created_at.toISOString(),
      state: details.to ?? 'pending',
    });
  }

  return latest;
}

export async function getContent(id: string) {
  const row = await prisma.content_items.findFirst({
    where: { id, deleted_at: null },
    include: {
      profiles_author: { select: PERSON_SELECT },
      profiles_reviewer: { select: PERSON_SELECT },
    },
  });
  if (!row) throw contentNotFound(id);

  const [links, actors] = await Promise.all([getLinks(id), loadApprovalActors(id)]);

  const gates = ['founder', 'marketing', 'seo'] as const;
  const approvalActors = gates.map((gate) => {
    const found = actors.get(gate);
    const state = (row as any)[`${gate}_approval`];
    return {
      gate,
      state,
      actorId: found?.actorId ?? null,
      actorName: found?.actorName ?? null,
      at: found?.at ?? null,
    };
  });

  return {
    ...mapListItem(row),
    metaDescription: row.meta_description,
    featuredImageUrl: row.featured_image_url,
    featuredImageAlt: row.featured_image_alt,
    body: row.body,
    typeFields: (row.type_fields ?? {}) as Record<string, unknown>,
    editorial: (row.editorial ?? {}) as Record<string, unknown>,
    canonicalUrlOverride: row.canonical_url_override,
    robotsDirective: row.robots_directive,
    reviewer: row.profiles_reviewer
      ? {
          id: row.profiles_reviewer.id,
          fullName: row.profiles_reviewer.full_name,
          email: row.profiles_reviewer.email,
        }
      : null,
    reviewedAt: toIso(row.reviewed_at),
    firstPublishedAt: toIso(row.first_published_at),
    currentRevisionNumber: row.current_revision_number,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    links,
    approvalActors,
  };
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateContent(id: string, input: UpdateContentInput, actor: Actor) {
  const existing = await prisma.content_items.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw contentNotFound(id);

  // Optimistic concurrency — silently overwriting a colleague's work is the failure mode this
  // prevents, and with three admins sharing a cluster it is a realistic one.
  if (existing.updated_at.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
    throw staleUpdate(existing.updated_at, existing.updated_by);
  }

  // Published items are edited live in v1 (plan §8.3), but only through EXPLICIT saves —
  // autosave is disabled for them so nobody edits a live page by accident.
  if (existing.status === 'published' && !input.createRevision) {
    throw forbiddenAction('autosave a published item — use an explicit save');
  }

  const data: Record<string, unknown> = { updated_by: actor.id, updated_at: new Date() };
  const auditDetails: Record<string, unknown> = { contentId: id, changedFields: [] as string[] };
  const changed = auditDetails.changedFields as string[];

  const set = (key: string, value: unknown, field: string) => {
    data[key] = value;
    changed.push(field);
  };

  if (input.title !== undefined) set('title', input.title, 'title');
  if (input.metaDescription !== undefined) set('meta_description', input.metaDescription, 'metaDescription');
  if (input.featuredImageUrl !== undefined) set('featured_image_url', input.featuredImageUrl, 'featuredImageUrl');
  if (input.featuredImageAlt !== undefined) set('featured_image_alt', input.featuredImageAlt, 'featuredImageAlt');
  if (input.pillar !== undefined) set('pillar', input.pillar, 'pillar');
  if (input.week !== undefined) set('week', input.week, 'week');
  if (input.canonicalUrlOverride !== undefined) set('canonical_url_override', input.canonicalUrlOverride, 'canonicalUrlOverride');
  if (input.robotsDirective !== undefined) set('robots_directive', input.robotsDirective, 'robotsDirective');
  if (input.authorId !== undefined) set('author_id', input.authorId, 'authorId');
  if (input.reviewerId !== undefined) set('reviewer_id', input.reviewerId, 'reviewerId');
  if (input.reviewedAt !== undefined) set('reviewed_at', input.reviewedAt ? new Date(input.reviewedAt) : null, 'reviewedAt');
  if (input.editorialRef !== undefined) set('editorial_ref', input.editorialRef, 'editorialRef');
  if (input.typeFields !== undefined) set('type_fields', input.typeFields, 'typeFields');
  if (input.editorial !== undefined) set('editorial', input.editorial, 'editorial');

  let tagsChanged: { added: string[]; removed: string[] } | null = null;
  if (input.tags !== undefined) {
    const normalised = normaliseTags(input.tags);
    const before = new Set(existing.tags);
    const after = new Set(normalised);
    tagsChanged = {
      added: normalised.filter((t) => !before.has(t)),
      removed: existing.tags.filter((t) => !after.has(t)),
    };
    set('tags', normalised, 'tags');
  }

  // Derived metrics are recomputed server-side; a client can never set them directly.
  if (input.body !== undefined) {
    const metrics = deriveContentMetrics(input.body);
    data.body = input.body as object;
    data.word_count = metrics.word_count;
    data.reading_time_minutes = metrics.reading_time_minutes;
    changed.push('body');
  }

  // Slug changes on a PUBLISHED item are gated three ways: super_admin, an explicit confirmation
  // flag, and its own audit event (plan §9.3.1). Internal links resolve by id and are unaffected;
  // the blast radius is entirely external — bookmarks, backlinks and AI citations.
  let slugChange: { from: string; to: string } | null = null;
  if (input.slug !== undefined) {
    const prepared = prepareSlug(input.slug);
    if (!prepared.valid) {
      throw prepared.reason === 'reserved' ? slugReserved(prepared.slug) : slugInvalid(prepared.slug);
    }
    if (prepared.slug !== existing.slug) {
      if (existing.status === 'published') {
        if (actor.role !== 'super_admin') throw forbiddenAction('change a published URL');
        if (!input.confirmSlugChange) throw slugChangeNotConfirmed();
      }
      slugChange = { from: existing.slug, to: prepared.slug };
      set('slug', prepared.slug, 'slug');
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.content_items.update({ where: { id }, data });

      // Explicit save captures a revision; autosave deliberately does not, or a 30-minute
      // editing session would produce hundreds of near-identical rows.
      if (input.createRevision) {
        await captureRevision(tx, {
          contentId: id,
          trigger: 'manual_save',
          changeSummary: input.changeSummary ?? null,
          actorId: actor.id,
        });
      }

      await writeAuditLog(
        { actorId: actor.id, action: 'content.updated', details: auditDetails },
        { tx }
      );

      if (slugChange) {
        await writeAuditLog(
          {
            actorId: actor.id,
            action: 'content.slug_changed',
            details: { contentId: id, ...slugChange, wasPublished: existing.status === 'published' },
          },
          { tx }
        );
      }

      if (tagsChanged && (tagsChanged.added.length > 0 || tagsChanged.removed.length > 0)) {
        await writeAuditLog(
          { actorId: actor.id, action: 'content.tags_updated', details: { contentId: id, ...tagsChanged } },
          { tx }
        );
      }

      return row;
    });

    return getContent(updated.id);
  } catch (error) {
    const mapped = mapPrismaUniqueViolation(error, {
      slug: slugChange?.to,
      editorialRef: input.editorialRef ?? undefined,
    });
    if (mapped) throw mapped;
    throw error;
  }
}

/** Content type is immutable — changing it would orphan `type_fields`. */
export function assertContentTypeUnchanged(existing: string, requested: string | undefined) {
  if (requested !== undefined && requested !== existing) throw contentTypeImmutable();
}

// ─── Duplicate ───────────────────────────────────────────────────────────────

export async function duplicateContent(id: string, actor: Actor) {
  const source = await prisma.content_items.findFirst({ where: { id, deleted_at: null } });
  if (!source) throw contentNotFound(id);

  const baseSlug = deriveSlug(`${source.title} copy`) ?? `copy-${randomUUID().slice(0, 8)}`;
  let slug = baseSlug;
  for (let attempt = 1; attempt < 20; attempt += 1) {
    const clash = await prisma.content_items.findFirst({ where: { slug, deleted_at: null }, select: { id: true } });
    if (!clash) break;
    slug = `${baseSlug}-${attempt + 1}`.slice(0, 80);
  }

  const created = await prisma.content_items.create({
    data: {
      content_type: source.content_type,
      title: `${source.title} (copy)`,
      slug,
      // Copied: authored content and editorial metadata.
      body: source.body as object,
      type_fields: source.type_fields as object,
      editorial: source.editorial as object,
      pillar: source.pillar,
      week: source.week,
      tags: source.tags,
      meta_description: source.meta_description,
      featured_image_url: source.featured_image_url,
      featured_image_alt: source.featured_image_alt,
      author_id: source.author_id,
      word_count: source.word_count,
      reading_time_minutes: source.reading_time_minutes,
      // Reset: identity, workbook reference, lifecycle, gates, scheduling, publication,
      // revision counter. Links are NOT copied — an editorial decision belongs to the new item.
      editorial_ref: null,
      status: 'draft',
      founder_approval: 'pending',
      marketing_approval: 'pending',
      seo_approval: 'pending',
      scheduled_for: null,
      published_at: null,
      first_published_at: null,
      current_revision_number: 0,
      created_by: actor.id,
      updated_by: actor.id,
    },
    include: { profiles_author: { select: PERSON_SELECT } },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: 'content.created',
    details: { contentId: created.id, duplicatedFrom: id, contentType: created.content_type },
  });

  return mapListItem(created);
}

// ─── Soft delete ─────────────────────────────────────────────────────────────

export async function deleteContent(id: string, actor: Actor) {
  if (actor.role !== 'super_admin') throw forbiddenAction('delete content');

  const existing = await prisma.content_items.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw contentNotFound(id);

  // A live page must be taken down deliberately before it is deleted, so deletion is never the
  // thing that removes something from the public site.
  if (existing.status === 'published') {
    throw forbiddenAction('delete published content — unpublish it first');
  }

  await prisma.$transaction(async (tx) => {
    await tx.content_items.update({ where: { id }, data: { deleted_at: new Date(), updated_by: actor.id } });
    await writeAuditLog(
      { actorId: actor.id, action: 'content.deleted', details: { contentId: id, slug: existing.slug } },
      { tx }
    );
  });
}

// ─── Links ───────────────────────────────────────────────────────────────────

export async function getLinks(contentId: string) {
  const links = await prisma.content_links.findMany({
    where: { source_id: contentId },
    orderBy: { sort_order: 'asc' },
    include: { target: { select: { title: true, slug: true, status: true, content_type: true } } },
  });

  return links.map((link) => ({
    id: link.id,
    targetKind: link.target_kind as 'content' | 'route',
    targetContentId: link.target_content_id,
    targetRoute: link.target_route,
    anchorText: link.anchor_text,
    relation: link.relation as any,
    sortOrder: link.sort_order,
    targetTitle: link.target?.title ?? null,
    targetSlug: link.target?.slug ?? null,
    targetStatus: (link.target?.status ?? null) as any,
    targetPublicLabel: link.target ? PUBLIC_CONTENT_LABEL[link.target.content_type as ContentType] : null,
    routeLabel: link.target_route ? resolveRouteLabel(link.target_route) : null,
    routeHref: link.target_route ? resolveRouteHref(link.target_route) : null,
  }));
}

export async function getInboundLinks(contentId: string) {
  const links = await prisma.content_links.findMany({
    where: { target_content_id: contentId },
    include: { source: { select: { id: true, title: true, slug: true, status: true } } },
  });

  return links.map((link) => ({
    id: link.id,
    sourceId: link.source.id,
    sourceTitle: link.source.title,
    sourceSlug: link.source.slug,
    sourceStatus: link.source.status as any,
    relation: link.relation as any,
    anchorText: link.anchor_text,
  }));
}

/** Replace the whole outbound set in one transaction — simpler and more predictable than per-row CRUD. */
export async function replaceLinks(contentId: string, links: LinkInput[], actor: Actor) {
  const existing = await prisma.content_items.findFirst({ where: { id: contentId, deleted_at: null }, select: { id: true } });
  if (!existing) throw contentNotFound(contentId);

  const seenEdges = new Set<string>();
  const targetIds: string[] = [];

  for (const link of links) {
    if (link.targetKind === 'content') {
      if (!link.targetContentId) throw invalidLink('A content link needs a target.');
      if (link.targetContentId === contentId) throw invalidLink('Content cannot link to itself.');
      const edge = `${link.targetContentId}:${link.relation}`;
      if (seenEdges.has(edge)) throw invalidLink('Duplicate link to the same target and relation.');
      seenEdges.add(edge);
      targetIds.push(link.targetContentId);
    } else {
      if (!link.targetRoute || !isRouteKey(link.targetRoute)) {
        throw invalidLink(`Unknown route key: ${link.targetRoute}`, { targetRoute: link.targetRoute });
      }
    }
  }

  if (targetIds.length > 0) {
    const found = await prisma.content_items.findMany({
      where: { id: { in: targetIds }, deleted_at: null },
      select: { id: true },
    });
    if (found.length !== new Set(targetIds).size) {
      throw invalidLink('One or more link targets do not exist.');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.content_links.deleteMany({ where: { source_id: contentId } });

    if (links.length > 0) {
      await tx.content_links.createMany({
        data: links.map((link, index) => ({
          source_id: contentId,
          target_kind: link.targetKind,
          target_content_id: link.targetKind === 'content' ? link.targetContentId ?? null : null,
          target_route: link.targetKind === 'route' ? link.targetRoute ?? null : null,
          anchor_text: link.anchorText ?? null,
          relation: link.relation,
          sort_order: link.sortOrder ?? index,
        })),
      });
    }

    // IDs and route keys only — never anchor text bodies or content.
    await writeAuditLog(
      {
        actorId: actor.id,
        action: 'content.links_updated',
        details: {
          contentId,
          contentTargets: links.filter((l) => l.targetKind === 'content').map((l) => l.targetContentId),
          routeTargets: links.filter((l) => l.targetKind === 'route').map((l) => l.targetRoute),
        },
      },
      { tx }
    );
  });

  // Link changes never create a revision — links are separate rows, not item content.
  return getLinks(contentId);
}

// ─── Revisions ───────────────────────────────────────────────────────────────

export async function listRevisions(contentId: string, page: number, pageSize: number) {
  const take = Math.min(Math.max(pageSize, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const [rows, total] = await Promise.all([
    prisma.content_revisions.findMany({
      where: { content_id: contentId },
      orderBy: { revision_number: 'desc' },
      include: { profiles: { select: { full_name: true } } },
      take,
      skip,
    }),
    prisma.content_revisions.count({ where: { content_id: contentId } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      revisionNumber: row.revision_number,
      trigger: row.trigger as any,
      statusAtCapture: row.status_at_capture as any,
      changeSummary: row.change_summary,
      createdBy: row.created_by,
      createdByName: row.profiles?.full_name ?? null,
      createdAt: row.created_at.toISOString(),
    })),
    total,
    page,
    pageSize: take,
  };
}

export async function getRevision(contentId: string, revisionNumber: number) {
  const row = await prisma.content_revisions.findFirst({
    where: { content_id: contentId, revision_number: revisionNumber },
    include: { profiles: { select: { full_name: true } } },
  });
  if (!row) throw revisionNotFound(revisionNumber);

  return {
    id: row.id,
    revisionNumber: row.revision_number,
    trigger: row.trigger as any,
    statusAtCapture: row.status_at_capture as any,
    changeSummary: row.change_summary,
    createdBy: row.created_by,
    createdByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at.toISOString(),
    snapshot: row.snapshot,
  };
}

/**
 * Restore a revision.
 *
 * NEVER mutates the revision: the snapshot is applied to the item and a NEW revision is written,
 * so history is append-only and the restore itself is recorded.
 */
export async function restoreRevision(
  contentId: string,
  revisionNumber: number,
  expectedUpdatedAt: string,
  actor: Actor
) {
  const [item, revision] = await Promise.all([
    prisma.content_items.findFirst({ where: { id: contentId, deleted_at: null } }),
    prisma.content_revisions.findFirst({ where: { content_id: contentId, revision_number: revisionNumber } }),
  ]);

  if (!item) throw contentNotFound(contentId);
  if (!revision) throw revisionNotFound(revisionNumber);

  if (item.updated_at.toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
    throw staleUpdate(item.updated_at, item.updated_by);
  }

  const snapshot = revision.snapshot as Record<string, any>;
  const metrics = deriveContentMetrics(snapshot.body);

  await prisma.$transaction(async (tx) => {
    await tx.content_items.update({
      where: { id: contentId },
      data: {
        title: snapshot.title,
        slug: snapshot.slug,
        meta_description: snapshot.meta_description ?? null,
        featured_image_url: snapshot.featured_image_url ?? null,
        featured_image_alt: snapshot.featured_image_alt ?? null,
        body: snapshot.body,
        type_fields: snapshot.type_fields ?? {},
        editorial: snapshot.editorial ?? {},
        pillar: snapshot.pillar ?? null,
        week: snapshot.week ?? null,
        tags: snapshot.tags ?? [],
        author_id: snapshot.author_id ?? null,
        reviewer_id: snapshot.reviewer_id ?? null,
        reviewed_at: snapshot.reviewed_at ? new Date(snapshot.reviewed_at) : null,
        canonical_url_override: snapshot.canonical_url_override ?? null,
        robots_directive: snapshot.robots_directive ?? 'index,follow',
        // Derived values are recomputed, never restored.
        word_count: metrics.word_count,
        reading_time_minutes: metrics.reading_time_minutes,
        updated_by: actor.id,
        updated_at: new Date(),
      },
    });

    const newRevision = await captureRevision(tx, {
      contentId,
      trigger: 'restore',
      changeSummary: `Restored from revision ${revisionNumber}`,
      actorId: actor.id,
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: 'content.revision_restored',
        details: { contentId, fromRevision: revisionNumber, newRevision: newRevision.revisionNumber },
      },
      { tx }
    );
  });

  return getContent(contentId);
}

export type { RevisionCapture, PrismaClientLike };
