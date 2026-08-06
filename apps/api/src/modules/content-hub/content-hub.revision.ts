/**
 * Content Hub — revision capture.
 *
 * Kept separate from the CRUD service because three services need it (CRUD, publish, cluster) and
 * a shared import is better than three copies of the numbering logic.
 *
 * REVISIONS ARE APPEND-ONLY. There is no update or delete path here, and the Supabase grants in
 * `0012_content_hub_rls.sql` withhold UPDATE/DELETE from `service_role` so an accidental one
 * fails loudly rather than silently rewriting history.
 */

import type { PrismaClientLike } from '../../lib/prisma';
import type { RevisionTrigger } from '@meetezri/shared';

export interface RevisionCapture {
  contentId: string;
  trigger: RevisionTrigger;
  changeSummary?: string | null;
  actorId: string | null;
  /** Overrides the status recorded on the snapshot — used when capturing during a transition. */
  statusOverride?: string;
}

/**
 * Fields captured in a snapshot.
 *
 * AUTHORED FIELDS ONLY. Identity (`id`, `created_at`), derived values (`word_count`,
 * `reading_time_minutes`), the revision counter and publication timestamps are deliberately
 * excluded, so restoring is a pure application of a field set rather than something that needs
 * per-field exception logic.
 */
const SNAPSHOT_SELECT = {
  title: true,
  slug: true,
  meta_description: true,
  featured_image_url: true,
  featured_image_alt: true,
  body: true,
  type_fields: true,
  editorial: true,
  pillar: true,
  week: true,
  tags: true,
  author_id: true,
  reviewer_id: true,
  reviewed_at: true,
  canonical_url_override: true,
  robots_directive: true,
  status: true,
  founder_approval: true,
  marketing_approval: true,
  seo_approval: true,
} as const;

/**
 * Capture one revision.
 *
 * MUST run inside the same transaction as the change it describes, so a status can never advance
 * without its snapshot.
 *
 * Numbering uses an atomic increment of `current_revision_number` rather than
 * `MAX(revision_number) + 1`, which races under concurrent saves. The unique index on
 * `(content_id, revision_number)` is the backstop if two transactions somehow interleave.
 */
export async function captureRevision(
  tx: PrismaClientLike,
  capture: RevisionCapture
): Promise<{ revisionNumber: number }> {
  const item = await tx.content_items.findUniqueOrThrow({
    where: { id: capture.contentId },
    select: { ...SNAPSHOT_SELECT, current_revision_number: true },
  });

  const { current_revision_number: currentNumber, ...snapshot } = item;
  const revisionNumber = currentNumber + 1;

  await tx.content_items.update({
    where: { id: capture.contentId },
    data: { current_revision_number: revisionNumber },
  });

  await tx.content_revisions.create({
    data: {
      content_id: capture.contentId,
      revision_number: revisionNumber,
      snapshot: snapshot as object,
      trigger: capture.trigger,
      status_at_capture: capture.statusOverride ?? snapshot.status,
      change_summary: capture.changeSummary ?? null,
      created_by: capture.actorId,
    },
  });

  return { revisionNumber };
}
