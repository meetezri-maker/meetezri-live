/**
 * Week 1 import — pure decision logic.
 *
 * Lives in `src` rather than beside the CLI so it is compiled and type-checked by the production
 * build, and so the tests can exercise it without dragging `scripts/` into the API's TypeScript
 * project. `scripts/content-hub/import-week1.ts` is the thin executable wrapper: it owns the
 * argument parsing, the database calls and the printing. Everything that decides *what should
 * happen* is here, and is pure.
 */

import {
  isRouteKey,
  normaliseSlug,
  normaliseTags,
  validateContentBody,
  validateSlug,
  type ContentType,
} from '@meetezri/shared';
import type { Week1Asset } from './week1-content';

export interface AssetValidation {
  /** Blocks the import outright — a malformed record must never be written. */
  errors: string[];
  warnings: string[];
  /** Does NOT block the import. A draft is allowed to be incomplete. */
  publishBlockers: string[];
}

/**
 * Validate an asset BEFORE any write (Phase 5B Task 12).
 *
 * Uses the same shared validators the admin API uses, so nothing can be imported that the editor
 * would reject. Publish-only problems are reported separately, because a draft is legitimately
 * allowed to be incomplete — a malformed one is not.
 */
export function validateAsset(asset: Week1Asset): AssetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const normalised = normaliseSlug(asset.slug);
  if (normalised !== asset.slug) {
    errors.push(`slug "${asset.slug}" is not in normalised form (would become "${normalised}")`);
  }
  const slugCheck = validateSlug(normalised);
  if (!slugCheck.valid) errors.push(`slug is ${slugCheck.reason}`);

  if (normaliseTags(asset.tags).length !== asset.tags.length) {
    errors.push('tags are not in normalised form');
  }

  const draft = validateContentBody(asset.body, { contentType: asset.contentType as ContentType });
  const publish = validateContentBody(asset.body, {
    contentType: asset.contentType as ContentType,
    forPublish: true,
  });

  for (const issue of draft.errors) errors.push(`body: ${issue.code} — ${issue.message}`);
  for (const issue of draft.warnings) warnings.push(`body: ${issue.code} — ${issue.message}`);

  const draftCodes = new Set(draft.errors.map((e) => `${e.code}:${e.blockId ?? ''}`));
  const publishBlockers = publish.errors
    .filter((e) => !draftCodes.has(`${e.code}:${e.blockId ?? ''}`))
    .map((e) => `body: ${e.code} — ${e.message}`);

  for (const link of asset.links) {
    if (link.targetKind === 'route' && !isRouteKey(link.targetRoute ?? '')) {
      errors.push(`link route key "${link.targetRoute}" is not in the route registry`);
    }
  }

  // A publish blocker, never a reason to refuse the draft — see W1-B001.
  if (!asset.metaDescription) {
    publishBlockers.push('meta_description is missing (workbook supplies none)');
  }

  // Internal/public separation: the internal GEO fields must exist only on `geo_statement`
  // blocks, which is the one place the serializer strips them.
  for (const block of asset.body.blocks as unknown as Array<Record<string, unknown>>) {
    for (const field of ['coreMessage', 'citationGoal']) {
      if (field in block && block.type !== 'geo_statement') {
        errors.push(`block ${String(block.id)} carries internal field "${field}" outside a geo_statement`);
      }
    }
  }

  return { errors, warnings, publishBlockers };
}

export type ImportAction = 'create' | 'update' | 'skip-conflict' | 'blocked-validation';

export interface ExistingRow {
  id: string;
  status: string;
  title: string;
  slug: string;
  content_type: string;
  current_revision_number: number;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * Decide what to do with an existing row (Phase 5B Task 2).
 *
 * Identity is `editorial_ref` ONLY — never the title, which an editor may legitimately change and
 * which an unrelated record could coincidentally share. A published record, or a draft carrying
 * revisions (evidence someone saved it through the editor), is REFUSED rather than overwritten:
 * silently replacing a colleague's edits with a re-import is the failure this prevents.
 */
export function decideAction(existing: ExistingRow | null): { action: ImportAction; reason?: string } {
  if (!existing) return { action: 'create' };

  if (existing.deleted_at) {
    return { action: 'skip-conflict', reason: 'a soft-deleted record holds this editorial ref' };
  }
  if (existing.status !== 'draft') {
    return {
      action: 'skip-conflict',
      reason: `record is "${existing.status}", not draft — refusing to overwrite`,
    };
  }
  if (existing.current_revision_number > 0) {
    return {
      action: 'skip-conflict',
      reason: `record has ${existing.current_revision_number} revision(s), so it has been edited in the CMS — refusing to overwrite`,
    };
  }

  return { action: 'update' };
}
