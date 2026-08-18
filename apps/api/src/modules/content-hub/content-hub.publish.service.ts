/**
 * Content Hub — publish checklist, state machine and approval workflow.
 *
 * ONE CHECKLIST IMPLEMENTATION, reused by the checklist endpoint, single publish, re-publish,
 * cluster validation and (later) the scheduled-publish cron. A previous checklist result is
 * NEVER trusted: it is re-run inside every publish transaction, because a schedule set three days
 * ago proves nothing about the item's state now.
 */

import {
  APPROVAL_GATES,
  CONTENT_LIMITS,
  isRouteKey,
  validateContentBody,
  type ApprovalGate,
  type ApprovalState,
  type ContentStatus,
  type ContentType,
} from '@meetezri/shared';
import prisma, { type PrismaClientLike } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/auditLog';
import { validateSlug } from '../../lib/slug';
import {
  checklistFailed,
  contentNotFound,
  forbiddenAction,
  illegalTransition,
} from './content-hub.errors';
import { captureRevision } from './content-hub.revision';
import type { Actor } from './content-hub.service';
import type { ChecklistItem } from './content-hub.schema';

// ─── Checklist ───────────────────────────────────────────────────────────────

export interface ChecklistContext {
  /** Ids publishing together in this transaction. Rule 11 accepts targets inside the set. */
  clusterIds?: string[];
}

function item(
  code: string,
  label: string,
  passed: boolean,
  blocking: boolean,
  details?: string
): ChecklistItem {
  return details ? { code, label, passed, blocking, details } : { code, label, passed, blocking };
}

/**
 * Evaluate every publish rule for one item.
 *
 * Uses the supplied client so it can run inside a publish transaction against the same snapshot
 * the write will use.
 */
export async function evaluateChecklist(
  client: PrismaClientLike,
  contentId: string,
  ctx: ChecklistContext = {}
): Promise<{ passed: boolean; items: ChecklistItem[] }> {
  const row = await client.content_items.findFirst({ where: { id: contentId, deleted_at: null } });
  if (!row) throw contentNotFound(contentId);

  const items: ChecklistItem[] = [];

  // 1 — slug valid, unique, not reserved.
  const slugCheck = validateSlug(row.slug);
  let slugUnique = true;
  if (slugCheck.valid) {
    const clash = await client.content_items.findFirst({
      where: { slug: row.slug, deleted_at: null, id: { not: contentId } },
      select: { id: true },
    });
    slugUnique = !clash;
  }
  items.push(
    item(
      'slug',
      'Slug is valid, unique and not reserved',
      slugCheck.valid && slugUnique,
      true,
      slugCheck.valid ? (slugUnique ? undefined : 'Another item already uses this slug.') : `Slug is ${slugCheck.reason}.`
    )
  );

  // 2 — meta description present and the right length.
  const meta = row.meta_description?.trim() ?? '';
  const metaOk =
    meta.length >= CONTENT_LIMITS.minMetaDescription && meta.length <= CONTENT_LIMITS.maxMetaDescription;
  items.push(
    item(
      'meta_description',
      `Meta description is ${CONTENT_LIMITS.minMetaDescription}–${CONTENT_LIMITS.maxMetaDescription} characters`,
      metaOk,
      true,
      meta.length === 0 ? 'Missing.' : `Currently ${meta.length} characters.`
    )
  );

  // 3 — title.
  items.push(item('title', 'Title is present', (row.title?.trim().length ?? 0) > 0, true));

  // 4 — author.
  items.push(item('author', 'Author is set', !!row.author_id, true));

  // 5/6/10 — body rules, from the shared validator so the editor and API agree exactly.
  const bodyResult = validateContentBody(row.body, {
    contentType: row.content_type as ContentType,
    forPublish: true,
  });
  const blocks = ((row.body as { blocks?: unknown[] } | null)?.blocks ?? []) as Array<{ type?: string }>;

  items.push(item('body', 'Body is not empty', blocks.length > 0, true));

  const safetyError = bodyResult.errors.find((e) => e.code === 'safety_notice.required');
  items.push(
    item('safety_notice', 'Contains a safety notice', !safetyError, true, safetyError?.message)
  );

  if (row.content_type === 'aeo_answer') {
    const directAnswerError = bodyResult.errors.find((e) => e.code.startsWith('direct_answer.'));
    const hasDirectAnswer = blocks.some((b) => b?.type === 'direct_answer');
    items.push(
      item(
        'direct_answer',
        'Direct answer is present exactly once and first',
        hasDirectAnswer && !directAnswerError,
        true,
        directAnswerError?.message ?? (hasDirectAnswer ? undefined : 'No direct answer block.')
      )
    );
  }

  const otherBodyErrors = bodyResult.errors.filter(
    (e) => e.code !== 'safety_notice.required' && !e.code.startsWith('direct_answer.')
  );
  if (otherBodyErrors.length > 0) {
    items.push(
      item('body_valid', 'Body passes validation', false, true, otherBodyErrors[0].message)
    );
  }

  // 7 — alt text whenever a featured image exists.
  const altOk = !row.featured_image_url || !!row.featured_image_alt?.trim();
  items.push(item('featured_image_alt', 'Featured image has alt text', altOk, true));

  // 8 — every CURRENT gate approved. Reading from shared constants means adding the safety gate
  // later extends this check automatically.
  const gateStates = APPROVAL_GATES.map((gate) => ({
    gate,
    state: (row as unknown as Record<string, ApprovalState>)[`${gate}_approval`],
  }));
  const gatesOk = gateStates.every((g) => g.state === 'approved');
  items.push(
    item(
      'approvals',
      'All approval gates are approved',
      gatesOk,
      true,
      gatesOk ? undefined : `Outstanding: ${gateStates.filter((g) => g.state !== 'approved').map((g) => g.gate).join(', ')}`
    )
  );

  // 9 — required type fields.
  const typeFields = (row.type_fields ?? {}) as Record<string, unknown>;
  let typeFieldsOk = true;
  let typeFieldsDetail: string | undefined;
  if (row.content_type === 'aeo_answer') {
    const missing = ['primary_question', 'snippet_answer'].filter((k) => !typeFields[k]);
    typeFieldsOk = missing.length === 0;
    if (!typeFieldsOk) typeFieldsDetail = `Missing: ${missing.join(', ')}`;
  } else if (row.content_type === 'geo_article') {
    const missing: string[] = [];
    if (!typeFields.core_concept) missing.push('core_concept');
    if (!typeFields.citation_summary) missing.push('citation_summary');
    if (!Array.isArray(typeFields.key_statements) || typeFields.key_statements.length === 0) {
      missing.push('key_statements');
    }
    typeFieldsOk = missing.length === 0;
    if (!typeFieldsOk) typeFieldsDetail = `Missing: ${missing.join(', ')}`;
  }
  items.push(item('type_fields', 'Required type-specific fields are present', typeFieldsOk, true, typeFieldsDetail));

  // 11/12 — link targets and route keys.
  const links = await client.content_links.findMany({
    where: { source_id: contentId },
    select: { target_kind: true, target_content_id: true, target_route: true },
  });

  const clusterSet = new Set(ctx.clusterIds ?? [contentId]);
  const contentTargets = links
    .filter((l) => l.target_kind === 'content' && l.target_content_id)
    .map((l) => l.target_content_id as string);

  let unresolvedTargets: string[] = [];
  if (contentTargets.length > 0) {
    const publishedTargets = await client.content_items.findMany({
      where: { id: { in: contentTargets }, status: 'published', deleted_at: null },
      select: { id: true },
    });
    const publishedIds = new Set(publishedTargets.map((t) => t.id));
    // Rule 11 accepts a target that is already published OR is publishing in this same cluster —
    // without that, the cyclic Week 1 graph could never be published in any order.
    unresolvedTargets = contentTargets.filter((id) => !publishedIds.has(id) && !clusterSet.has(id));
  }
  items.push(
    item(
      'link_targets',
      'Internal link targets are published or in this cluster',
      unresolvedTargets.length === 0,
      true,
      unresolvedTargets.length > 0 ? `${unresolvedTargets.length} unresolved target(s).` : undefined
    )
  );

  const badRoutes = links
    .filter((l) => l.target_kind === 'route')
    .map((l) => l.target_route)
    .filter((route): route is string => !!route && !isRouteKey(route));
  items.push(
    item(
      'route_keys',
      'All route keys resolve',
      badRoutes.length === 0,
      true,
      badRoutes.length > 0 ? `Unmapped: ${badRoutes.join(', ')}` : undefined
    )
  );

  // Warnings — never block.
  items.push(item('featured_image', 'Featured image is set', !!row.featured_image_url, false));

  if (row.content_type === 'seo_blog') {
    const target = (typeFields.word_count_target as string | undefined) ?? '';
    const bounds = target.match(/(\d[\d,]*)\D+(\d[\d,]*)/);
    let withinTarget = true;
    if (bounds && row.word_count) {
      const min = Number(bounds[1].replace(/,/g, ''));
      const max = Number(bounds[2].replace(/,/g, ''));
      withinTarget = row.word_count >= min && row.word_count <= max;
    }
    items.push(
      item('word_count', 'Word count is within target', withinTarget, false, `Currently ${row.word_count ?? 0} words.`)
    );
  }

  items.push(item('internal_links', 'Has at least one outbound internal link', links.length > 0, false));

  return { passed: items.every((i) => !i.blocking || i.passed), items };
}

// ─── State machine ───────────────────────────────────────────────────────────

export type TransitionAction = 'submit' | 'withdraw' | 'publish' | 'unpublish' | 'archive' | 'restore';

const LEGAL: Record<TransitionAction, { from: ContentStatus[]; to: ContentStatus }> = {
  submit: { from: ['draft', 'changes_requested'], to: 'in_review' },
  withdraw: { from: ['in_review', 'approved'], to: 'draft' },
  publish: { from: ['approved', 'unpublished'], to: 'published' },
  unpublish: { from: ['published'], to: 'unpublished' },
  archive: { from: ['draft', 'in_review', 'changes_requested', 'approved', 'unpublished'], to: 'archived' },
  restore: { from: ['archived'], to: 'draft' },
};

/** Actions only `super_admin` may perform. Re-checked in the service, not just the route. */
const SUPER_ADMIN_ONLY: TransitionAction[] = ['publish', 'unpublish', 'archive'];

const AUDIT_ACTION: Record<TransitionAction, string> = {
  submit: 'content.submitted_for_review',
  withdraw: 'content.updated',
  publish: 'content.published',
  unpublish: 'content.unpublished',
  archive: 'content.archived',
  restore: 'content.restored',
};

export interface TransitionResult {
  status: ContentStatus;
  revisionNumber: number;
  /**
   * Phase 7 hook: paths whose cache should be purged. Returned rather than acted on, so cache
   * invalidation can be added later without touching this service.
   */
  invalidatePaths: string[];
}

/** How long the transition transaction may RUN once it holds a connection. */
const TRANSACTION_TIMEOUT_MS = 20_000;

/**
 * How long to wait for a connection before giving up on STARTING the transaction.
 *
 * Prisma's default is 2 000 ms, and leaving it there is what produced the intermittent 500s on
 * draft → in_review (P2028, "Unable to start a transaction in the given time"). In production the
 * API runs serverless against Supabase's PgBouncer transaction pooler with `connection_limit=1`,
 * so whenever another query in the same instance holds that one connection, acquisition takes
 * longer than two seconds and the request fails BEFORE any work happens — while the execution
 * budget above sat unused at twenty seconds.
 *
 * Nothing is written when this expires, so raising it cannot corrupt anything: the choice is only
 * between waiting for the connection and rejecting a transition that would have succeeded. Ten
 * seconds matches the pool timeout the runtime already uses elsewhere and stays well inside the
 * execution budget.
 */
const TRANSACTION_MAX_WAIT_MS = 10_000;

export async function transitionContent(
  contentId: string,
  action: TransitionAction,
  actor: Actor,
  reason?: string
): Promise<TransitionResult> {
  if (SUPER_ADMIN_ONLY.includes(action) && actor.role !== 'super_admin') {
    throw forbiddenAction(`${action} content`);
  }

  const existing = await prisma.content_items.findFirst({ where: { id: contentId, deleted_at: null } });
  if (!existing) throw contentNotFound(contentId);

  const rule = LEGAL[action];
  if (!rule.from.includes(existing.status as ContentStatus)) {
    throw illegalTransition(existing.status, rule.to);
  }

  const isPublish = action === 'publish';

  return prisma.$transaction(
    async (tx) => {
      // Re-fetch inside the transaction — the row may have moved since the pre-check.
      const row = await tx.content_items.findFirstOrThrow({ where: { id: contentId, deleted_at: null } });
      if (!rule.from.includes(row.status as ContentStatus)) {
        throw illegalTransition(row.status, rule.to);
      }

      if (isPublish) {
        const checklist = await evaluateChecklist(tx, contentId);
        if (!checklist.passed) throw checklistFailed(checklist.items.filter((i) => i.blocking && !i.passed));
      }

      const now = new Date();
      const data: Record<string, unknown> = {
        status: rule.to,
        updated_by: actor.id,
        updated_at: now,
      };

      if (isPublish) {
        data.published_at = now;
        // Set once and never moved, so republishing does not reset the page's age signal.
        if (!row.first_published_at) data.first_published_at = now;
        // Publishing supersedes any planned date.
        data.scheduled_for = null;
      }

      // Any move out of `approved` clears the schedule — a schedule that survives is a queued
      // publish of content that is no longer approved.
      if (row.status === 'approved' && rule.to !== 'published') {
        data.scheduled_for = null;
      }

      // Restoring from the archive returns gates to pending: the content is a draft again.
      if (action === 'restore' || action === 'withdraw') {
        for (const gate of APPROVAL_GATES) data[`${gate}_approval`] = 'pending';
        data.scheduled_for = null;
      }

      await tx.content_items.update({ where: { id: contentId }, data });

      const revision = await captureRevision(tx, {
        contentId,
        trigger: 'transition',
        changeSummary: reason ?? `${action} → ${rule.to}`,
        actorId: actor.id,
        statusOverride: rule.to,
      });

      await writeAuditLog(
        {
          actorId: actor.id,
          action: AUDIT_ACTION[action],
          details: {
            contentId,
            from: row.status,
            to: rule.to,
            revisionNumber: revision.revisionNumber,
            ...(isPublish ? { firstPublish: !row.first_published_at } : {}),
            ...(reason ? { reason } : {}),
          },
        },
        { tx }
      );

      if (row.status === 'approved' && row.scheduled_for && rule.to !== 'published') {
        await writeAuditLog(
          {
            actorId: actor.id,
            action: 'content.schedule_cleared',
            details: { contentId, from: row.scheduled_for.toISOString(), reason: 'status_changed', to: rule.to },
          },
          { tx }
        );
      }

      return {
        status: rule.to,
        revisionNumber: revision.revisionNumber,
        invalidatePaths: [`/resources/${row.slug}`, '/resources', '/sitemap.xml'],
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS }
  );
}

// ─── Approval gates ──────────────────────────────────────────────────────────

export async function setApprovalGate(
  contentId: string,
  gate: ApprovalGate,
  state: ApprovalState,
  actor: Actor,
  note?: string
) {
  if (actor.role !== 'super_admin' && actor.role !== 'org_admin') {
    throw forbiddenAction('set approval gates');
  }

  const existing = await prisma.content_items.findFirst({ where: { id: contentId, deleted_at: null } });
  if (!existing) throw contentNotFound(contentId);

  return prisma.$transaction(async (tx) => {
    const row = await tx.content_items.findFirstOrThrow({ where: { id: contentId, deleted_at: null } });
    const previous = (row as unknown as Record<string, ApprovalState>)[`${gate}_approval`];

    const data: Record<string, unknown> = {
      [`${gate}_approval`]: state,
      updated_by: actor.id,
      updated_at: new Date(),
    };

    const gates = APPROVAL_GATES.map((g) =>
      g === gate ? state : (row as unknown as Record<string, ApprovalState>)[`${g}_approval`]
    );

    let newStatus: ContentStatus | null = null;
    let scheduleCleared = false;

    if (state === 'changes_requested') {
      newStatus = 'changes_requested';
      if (row.scheduled_for) scheduleCleared = true;
      data.scheduled_for = null;
    } else if (gates.every((g) => g === 'approved') && row.status === 'in_review') {
      // The ONLY automatic transition: gates are the input, `approved` is the consequence.
      newStatus = 'approved';
    } else if (previous === 'approved' && state !== 'approved' && row.status === 'approved') {
      // Withdrawing an approval sends the item back for review and cancels any schedule.
      newStatus = 'in_review';
      if (row.scheduled_for) scheduleCleared = true;
      data.scheduled_for = null;
    }

    if (newStatus) data.status = newStatus;

    await tx.content_items.update({ where: { id: contentId }, data });

    // The gate change itself never creates a revision — no content changed.
    await writeAuditLog(
      {
        actorId: actor.id,
        action: 'content.approval_set',
        details: { contentId, gate, from: previous, to: state, ...(note ? { note } : {}) },
      },
      { tx }
    );

    if (scheduleCleared) {
      await writeAuditLog(
        {
          actorId: actor.id,
          action: 'content.schedule_cleared',
          details: {
            contentId,
            from: row.scheduled_for?.toISOString() ?? null,
            reason: 'approval_withdrawn',
            gate,
          },
        },
        { tx }
      );
    }

    if (newStatus === 'approved') {
      await captureRevision(tx, {
        contentId,
        trigger: 'transition',
        changeSummary: 'All gates approved',
        actorId: actor.id,
        statusOverride: 'approved',
      });
      await writeAuditLog(
        { actorId: actor.id, action: 'content.approved', details: { contentId } },
        { tx }
      );
    }

    return {
      gates: APPROVAL_GATES.reduce(
        (acc, g) => ({ ...acc, [g]: g === gate ? state : (row as unknown as Record<string, ApprovalState>)[`${g}_approval`] }),
        {} as Record<ApprovalGate, ApprovalState>
      ),
      status: newStatus ?? (row.status as ContentStatus),
    };
  });
}
