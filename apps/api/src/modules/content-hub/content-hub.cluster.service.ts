/**
 * Content Hub — atomic cluster publishing.
 *
 * WHY THIS EXISTS: the Week 1 link graph is cyclic (A→B, G→A, G→B, B→A, B→G). Under a rule that
 * every link target must ALREADY be published, no item could ever be published first. Cluster
 * publishing validates the whole set together and commits in ONE transaction — all members go
 * live, or none do, so a published page never links to a 404.
 *
 * A CLUSTER IS NOT AN ENTITY. Membership is an ad-hoc set of ids passed to the endpoint; nothing
 * is persisted. A cluster is a release-time grouping, not a property of content, and the
 * three-table lock stands.
 *
 * A CLUSTER RELAXES LINK ORDERING, NEVER APPROVAL. Every member must independently be `approved`.
 */

import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import { writeAuditLog } from '../../lib/auditLog';
import { clusterInvalid, forbiddenAction } from './content-hub.errors';
import { captureRevision } from './content-hub.revision';
import { evaluateChecklist } from './content-hub.publish.service';
import type { Actor } from './content-hub.service';
import type { ChecklistItem } from './content-hub.schema';

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 20;
/** 3 members ≈ 9 writes; the cap ≈ 60. Explicit rather than relying on Prisma's default. */
const CLUSTER_TIMEOUT_MS = 30_000;

export interface ClusterMemberReport {
  contentId: string;
  editorialRef: string | null;
  title: string;
  status: string;
  passed: boolean;
  items: ChecklistItem[];
}

export interface ClusterLinkResolution {
  sourceId: string;
  target: string;
  resolution: 'published' | 'in_cluster' | 'route' | 'unresolved';
}

export interface ClusterValidationResult {
  passed: boolean;
  members: ClusterMemberReport[];
  linkResolution: ClusterLinkResolution[];
}

function boundsIssue(count: number): ChecklistItem[] | null {
  if (count < MIN_MEMBERS) {
    return [{ code: 'cluster.too_small', label: `A cluster needs at least ${MIN_MEMBERS} members`, passed: false, blocking: true }];
  }
  if (count > MAX_MEMBERS) {
    return [{ code: 'cluster.too_large', label: `A cluster may contain at most ${MAX_MEMBERS} members`, passed: false, blocking: true }];
  }
  return null;
}

/**
 * Validate a cluster.
 *
 * Read-only and reusable: called standalone by the validate endpoint AND re-run inside the
 * publish transaction, because the endpoint's result is advisory and must never be trusted.
 */
export async function validateCluster(
  contentIds: string[],
  client: typeof prisma | Parameters<typeof evaluateChecklist>[0] = prisma
): Promise<ClusterValidationResult> {
  const bounds = boundsIssue(contentIds.length);
  if (bounds) {
    return { passed: false, members: [], linkResolution: [] };
  }

  const rows = await client.content_items.findMany({
    where: { id: { in: contentIds }, deleted_at: null },
    select: { id: true, editorial_ref: true, title: true, status: true, slug: true },
  });

  const found = new Map(rows.map((r) => [r.id, r]));
  const members: ClusterMemberReport[] = [];
  const linkResolution: ClusterLinkResolution[] = [];

  // Slugs must be unique across the set as well as against the database.
  const slugCounts = new Map<string, number>();
  for (const row of rows) slugCounts.set(row.slug, (slugCounts.get(row.slug) ?? 0) + 1);

  for (const id of contentIds) {
    const row = found.get(id);

    if (!row) {
      members.push({
        contentId: id,
        editorialRef: null,
        title: '(not found)',
        status: 'unknown',
        passed: false,
        items: [{ code: 'cluster.member_missing', label: 'Member exists and is not deleted', passed: false, blocking: true }],
      });
      continue;
    }

    const items: ChecklistItem[] = [];

    // Rule 1 — approval can never be skipped by clustering.
    const approvedOk = row.status === 'approved';
    items.push({
      code: 'cluster.member_approved',
      label: 'Member is approved',
      passed: approvedOk,
      blocking: true,
      ...(approvedOk ? {} : { details: `Status is ${row.status}.` }),
    });

    if ((slugCounts.get(row.slug) ?? 0) > 1) {
      items.push({
        code: 'cluster.slug_collision',
        label: 'Slug is unique within the cluster',
        passed: false,
        blocking: true,
        details: `Duplicate slug: ${row.slug}`,
      });
    }

    // Rule 2 — the full checklist, with rule 11 evaluated against `published ∪ cluster`.
    const checklist = await evaluateChecklist(client, id, { clusterIds: contentIds });
    items.push(...checklist.items);

    members.push({
      contentId: id,
      editorialRef: row.editorial_ref,
      title: row.title,
      status: row.status,
      passed: items.every((i) => !i.blocking || i.passed),
      items,
    });
  }

  // Rule 3 — an explicit per-link report, so a failure names the edge rather than the document.
  const links = await client.content_links.findMany({
    where: { source_id: { in: contentIds } },
    select: { source_id: true, target_kind: true, target_content_id: true, target_route: true },
  });

  const contentTargetIds = links
    .filter((l) => l.target_kind === 'content' && l.target_content_id)
    .map((l) => l.target_content_id as string);

  const publishedTargets =
    contentTargetIds.length > 0
      ? await client.content_items.findMany({
          where: { id: { in: contentTargetIds }, status: 'published', deleted_at: null },
          select: { id: true },
        })
      : [];
  const publishedIds = new Set(publishedTargets.map((t) => t.id));
  const clusterSet = new Set(contentIds);

  for (const link of links) {
    if (link.target_kind === 'route') {
      linkResolution.push({ sourceId: link.source_id, target: link.target_route ?? '', resolution: 'route' });
      continue;
    }
    const target = link.target_content_id ?? '';
    linkResolution.push({
      sourceId: link.source_id,
      target,
      resolution: publishedIds.has(target)
        ? 'published'
        : clusterSet.has(target)
          ? 'in_cluster'
          : 'unresolved',
    });
  }

  return { passed: members.length > 0 && members.every((m) => m.passed), members, linkResolution };
}

export interface ClusterPublishResult {
  clusterId: string;
  published: Array<{ id: string; revisionNumber: number }>;
  /** Phase 7 hook — paths to purge once cache invalidation exists. */
  invalidatePaths: string[];
}

/**
 * Publish a cluster atomically.
 *
 * `super_admin` only — it IS publishing. `org_admin` may validate (to prepare a release) but not
 * execute.
 *
 * Everything below happens in ONE transaction, including the audit writes, so a rolled-back
 * cluster leaves no misleading "published" event behind.
 */
export async function publishCluster(contentIds: string[], actor: Actor): Promise<ClusterPublishResult> {
  if (actor.role !== 'super_admin') throw forbiddenAction('publish a cluster');

  const bounds = boundsIssue(contentIds.length);
  if (bounds) throw clusterInvalid([{ contentId: null, items: bounds }]);

  const clusterId = randomUUID();

  return prisma.$transaction(
    async (tx) => {
      // Re-validate INSIDE the transaction. The endpoint's earlier result is advisory only.
      const validation = await validateCluster(contentIds, tx);
      if (!validation.passed) throw clusterInvalid(validation.members.filter((m) => !m.passed));

      const now = new Date();
      const published: Array<{ id: string; revisionNumber: number }> = [];
      const slugs: string[] = [];

      for (const id of contentIds) {
        const row = await tx.content_items.findFirstOrThrow({ where: { id, deleted_at: null } });

        await tx.content_items.update({
          where: { id },
          data: {
            status: 'published',
            published_at: now,
            ...(row.first_published_at ? {} : { first_published_at: now }),
            scheduled_for: null,
            updated_by: actor.id,
            updated_at: now,
          },
        });

        const revision = await captureRevision(tx, {
          contentId: id,
          trigger: 'transition',
          changeSummary: `Cluster publish ${clusterId}`,
          actorId: actor.id,
          statusOverride: 'published',
        });

        await writeAuditLog(
          {
            actorId: actor.id,
            action: 'content.published',
            details: {
              contentId: id,
              from: row.status,
              to: 'published',
              revisionNumber: revision.revisionNumber,
              firstPublish: !row.first_published_at,
              clusterId,
              clusterSize: contentIds.length,
            },
          },
          { tx }
        );

        if (row.scheduled_for) {
          await writeAuditLog(
            {
              actorId: actor.id,
              action: 'content.schedule_cleared',
              details: { contentId: id, from: row.scheduled_for.toISOString(), reason: 'published' },
            },
            { tx }
          );
        }

        published.push({ id, revisionNumber: revision.revisionNumber });
        slugs.push(row.slug);
      }

      await writeAuditLog(
        {
          actorId: actor.id,
          action: 'content.cluster_published',
          details: { clusterId, memberIds: contentIds, memberCount: contentIds.length },
        },
        { tx }
      );

      return {
        clusterId,
        published,
        invalidatePaths: [...slugs.map((slug) => `/resources/${slug}`), '/resources', '/sitemap.xml'],
      };
    },
    { timeout: CLUSTER_TIMEOUT_MS }
  );
}

/** Records an explicit validation run. Ordinary invalid form submissions are NOT audited. */
export async function auditClusterValidation(
  contentIds: string[],
  passed: boolean,
  actor: Actor
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    action: 'content.cluster_validated',
    details: { memberIds: contentIds, passed },
  });
}

export async function auditClusterFailure(
  clusterId: string,
  members: ClusterMemberReport[],
  actor: Actor
): Promise<void> {
  const failed = members.find((m) => !m.passed);
  await writeAuditLog({
    actorId: actor.id,
    action: 'content.cluster_publish_failed',
    details: {
      clusterId,
      failedMemberId: failed?.contentId ?? null,
      failedRules: failed?.items.filter((i) => i.blocking && !i.passed).map((i) => i.code) ?? [],
    },
  });
}
