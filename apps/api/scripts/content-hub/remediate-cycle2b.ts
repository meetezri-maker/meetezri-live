import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../../src/lib/prisma';
import { writeAuditLog } from '../../src/lib/auditLog';
import { captureRevision } from '../../src/modules/content-hub/content-hub.revision';
import {
  CYCLE_2B_CONTEXTUAL_LINKS,
  CYCLE_2B_REPLACEMENTS,
  CYCLE_2B_TRANSACTION_OPTIONS,
  planExactReplacements,
} from '../../src/modules/content-hub/cycle2b-remediation';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const confirmed = args.has('--confirm-production');
const actorArg = process.argv.find((arg) => arg.startsWith('--actor='));
const actorId = actorArg?.slice('--actor='.length) ?? null;
const expectedSlugs = new Set([
  ...CYCLE_2B_REPLACEMENTS.map((item) => item.slug),
  ...Object.keys(CYCLE_2B_CONTEXTUAL_LINKS),
  ...Object.values(CYCLE_2B_CONTEXTUAL_LINKS).flatMap((items) => items.map((item) => item.targetSlug)),
]);

const replacementsBySlug = new Map<string, typeof CYCLE_2B_REPLACEMENTS[number][]>();
for (const replacement of CYCLE_2B_REPLACEMENTS) {
  replacementsBySlug.set(replacement.slug, [
    ...(replacementsBySlug.get(replacement.slug) ?? []),
    replacement,
  ]);
}

function planFieldChanges(bySlug: Map<string, any>) {
  return [...replacementsBySlug].map(([slug, replacements]) => {
    const row = bySlug.get(slug);
    if (!row) throw new Error(`missing exact slug: ${slug}`);
    return {
      row,
      plan: planExactReplacements({
        body: row.body,
        type_fields: row.type_fields,
        meta_description: row.meta_description,
      }, replacements),
    };
  });
}

async function validateContextualState(client: typeof prisma, bySlug: Map<string, any>) {
  const sourceIds = Object.keys(CYCLE_2B_CONTEXTUAL_LINKS).map((slug) => bySlug.get(slug).id);
  const existing = await client.content_links.findMany({
    where: { source_id: { in: sourceIds }, relation: 'contextual' },
    select: { source_id: true, target_content_id: true, anchor_text: true, sort_order: true },
    orderBy: [{ source_id: 'asc' }, { sort_order: 'asc' }],
  });
  const changes = new Set<string>();
  for (const [sourceSlug, specs] of Object.entries(CYCLE_2B_CONTEXTUAL_LINKS)) {
    const sourceId = bySlug.get(sourceSlug).id;
    const actual = existing
      .filter((link) => link.source_id === sourceId)
      .map((link) => ({
        target_content_id: link.target_content_id,
        anchor_text: link.anchor_text,
        sort_order: link.sort_order,
      }));
    const expected = specs.map((spec, index) => ({
      target_content_id: bySlug.get(spec.targetSlug).id,
      anchor_text: spec.anchorText,
      sort_order: 100 + index,
    }));
    if (actual.length === 0) changes.add(sourceSlug);
    else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`baseline mismatch: ${sourceSlug}.contextual-links`);
    }
  }
  return changes;
}

async function loadBaseline(client: typeof prisma) {
  const rows = await client.content_items.findMany({
    where: { slug: { in: [...expectedSlugs] }, deleted_at: null },
    select: {
      id: true,
      slug: true,
      status: true,
      robots_directive: true,
      body: true,
      type_fields: true,
      meta_description: true,
    },
  });
  if (rows.length !== expectedSlugs.size) {
    const found = new Set(rows.map((row) => row.slug));
    throw new Error(`missing exact slugs: ${[...expectedSlugs].filter((slug) => !found.has(slug)).join(', ')}`);
  }
  for (const row of rows) {
    if (row.status !== 'published' || row.robots_directive.toLowerCase().includes('noindex')) {
      throw new Error(`target is not published/indexable: ${row.slug}`);
    }
  }
  return rows;
}

async function main() {
  if (apply && (!confirmed || !actorId)) {
    throw new Error('apply requires --confirm-production and --actor=<approved-super-admin-profile-id>');
  }

  const rows = await loadBaseline(prisma);
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const plannedFields = planFieldChanges(bySlug);
  const contextualSources = await validateContextualState(prisma, bySlug);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    recordsChecked: rows.length,
    fieldChanges: plannedFields
      .filter(({ plan }) => plan.changedFields.length > 0)
      .map(({ row, plan }) => ({ slug: row.slug, fields: plan.changedFields })),
    contextualSources: contextualSources.size,
    contextualEdges: Object.values(CYCLE_2B_CONTEXTUAL_LINKS).reduce((sum, items) => sum + items.length, 0),
  }, null, 2));

  if (!apply) return;

  const actor = await prisma.profiles.findUnique({
    where: { id: actorId! },
    select: { id: true, role: true },
  });
  if (!actor || actor.role !== 'super_admin') {
    throw new Error('actor must be an existing super_admin profile');
  }

  await prisma.$transaction(async (tx) => {
    const lockedRows = await loadBaseline(tx as typeof prisma);
    const lockedBySlug = new Map(lockedRows.map((row) => [row.slug, row]));

    const lockedPlans = planFieldChanges(lockedBySlug);
    const lockedContextualSources = await validateContextualState(tx as typeof prisma, lockedBySlug);

    for (const { row, plan } of lockedPlans) {
      if (plan.changedFields.length === 0) continue;
      await tx.content_items.update({
        where: { id: row.id },
        data: {
          ...Object.fromEntries(plan.changedFields.map((field) => [field, plan.values[field]])),
          updated_by: actor.id,
          updated_at: new Date(),
        },
      });
      await captureRevision(tx, {
        contentId: row.id,
        trigger: 'manual_save',
        changeSummary: 'Cycle 2B approved reader-facing cleanup',
        actorId: actor.id,
      });
      await writeAuditLog({
        actorId: actor.id,
        action: 'content.cycle_2b_remediated',
        details: { contentId: row.id, slug: row.slug, changedFields: plan.changedFields },
      }, { tx });
    }

    for (const [sourceSlug, specs] of Object.entries(CYCLE_2B_CONTEXTUAL_LINKS)) {
      if (!lockedContextualSources.has(sourceSlug)) continue;
      const source = lockedBySlug.get(sourceSlug)!;
      await tx.content_links.deleteMany({ where: { source_id: source.id, relation: 'contextual' } });
      await tx.content_links.createMany({
        data: specs.map((spec, index) => ({
          source_id: source.id,
          target_kind: 'content',
          target_content_id: lockedBySlug.get(spec.targetSlug)!.id,
          target_route: null,
          anchor_text: spec.anchorText,
          relation: 'contextual',
          sort_order: 100 + index,
        })),
      });
      await writeAuditLog({
        actorId: actor.id,
        action: 'content.contextual_links_updated',
        details: {
          contentId: source.id,
          targetContentIds: specs.map((spec) => lockedBySlug.get(spec.targetSlug)!.id),
        },
      }, { tx });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: CYCLE_2B_TRANSACTION_OPTIONS.maxWait,
    timeout: CYCLE_2B_TRANSACTION_OPTIONS.timeout,
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unknown remediation failure');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

