/**
 * Week 2 Content Hub import — a ONE-TIME, CONTROLLED migration utility.
 *
 * The Week 1 importer's twin, and deliberately so: same two passes, same service layer, same
 * idempotency key, same refusal rules. It reuses `validateAsset` and `decideAction` from
 * `week1-import.helpers` rather than reimplementing them, so the two imports cannot drift.
 *
 *   Dry run (default, no writes):
 *     npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/import-week2.ts
 *
 *   Apply:
 *     … scripts/content-hub/import-week2.ts --apply --confirm-production --actor=<profile-id>
 *
 * TWO PASSES, because the Week 2 link graph is cyclic (B↔G, B↔A, G↔A). No single-pass import can
 * resolve `editorial_ref → id` for a target that does not exist yet.
 *   Pass 1 — create/update the three items, no content links.
 *   Pass 2 — resolve refs to ids, then replace each item's link set.
 *
 * EVERYTHING GOES THROUGH THE SERVICE LAYER (`createContent`, `updateContent`, `replaceLinks`), so
 * the same slug rules, shared body validators, revision behaviour, audit logging and link
 * validation apply as when an admin uses the UI. Nothing writes `content_items` directly and
 * nothing touches `status`.
 *
 * IDEMPOTENT, keyed on `editorial_ref`. A re-run updates the same three rows. A record that is
 * published, or that looks hand-edited, is REFUSED rather than overwritten.
 *
 * NEVER submits, approves, schedules or publishes. Items land as `draft` with all gates pending.
 */

import 'dotenv/config';
import { CONTENT_LIMITS, ROUTE_REGISTRY } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';
import {
  createContent,
  replaceLinks,
  updateContent,
  type Actor,
} from '../../src/modules/content-hub/content-hub.service';
import {
  WEEK2_ASSETS,
  EXPECTED_CONTENT_EDGES,
  type Week2Asset,
} from '../../src/modules/content-hub/week2/week2-content';
import {
  decideAction,
  validateAsset,
  type ExistingRow,
} from '../../src/modules/content-hub/week1/week1-import.helpers';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRM_PRODUCTION = argv.includes('--confirm-production');
/** Who is running the import — required for any write, lands in the audit log. */
const ACTOR_ID = argv.find((a) => a.startsWith('--actor='))?.split('=')[1];
/** The published byline. Separate from the actor, and unset by default. */
const AUTHOR_ID = argv.find((a) => a.startsWith('--author='))?.split('=')[1];

/** Host and database only — never credentials. */
function describeTarget() {
  const raw = process.env.DATABASE_URL ?? '';
  const match = raw.match(/^\w+:\/\/([^:@/]+)(?::[^@]*)?@([^/?]+)\/([^?]*)/);
  if (!match) {
    return { host: '(unparseable)', database: '(unknown)', project: '(unknown)', looksProduction: false };
  }
  const [, user, host, database] = match;
  const fromUser = user.includes('.') ? user.split('.').slice(1).join('.') : '';
  const fromHost = host.startsWith('db.') ? host.split('.')[1] : '';
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])/.test(host);
  return {
    host,
    database,
    project: fromUser || fromHost || '(unknown)',
    looksProduction: !isLocal,
  };
}

interface AssetOutcome {
  editorialRef: string;
  action: 'create' | 'update' | 'skip-conflict' | 'blocked-validation';
  reason?: string;
  id?: string;
  blockCount: number;
  faqCount: number;
  linkCount: number;
  wordCount?: number;
  validationErrors: string[];
  validationWarnings: string[];
  publishBlockers: string[];
}

const outcomes: AssetOutcome[] = [];

function line(text = '') {
  console.log(text);
}

function countFaqItems(asset: Week2Asset): number {
  const faq = asset.body.blocks.find((b) => b.type === 'faq') as { items?: unknown[] } | undefined;
  return faq?.items?.length ?? 0;
}

/** Words in the body, counted the same way the service derives `word_count`. */
function countWords(asset: Week2Asset): number {
  const text: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const span = node as { text?: unknown };
    if (typeof span.text === 'string') text.push(span.text);
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === 'object') walk(value);
    }
  };
  walk(asset.body.blocks);
  return text.join(' ').split(/\s+/).filter(Boolean).length;
}

function blockTypeSummary(asset: Week2Asset): string {
  const counts = new Map<string, number>();
  for (const block of asset.body.blocks) {
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, n]) => `${type}×${n}`).join(', ');
}

async function main() {
  const target = describeTarget();
  const mode = APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)';

  line('═'.repeat(78));
  line('  SOLACE CONTENT HUB — WEEK 2 IMPORT');
  line('═'.repeat(78));
  line(`  mode          : ${mode}`);
  line(`  host          : ${target.host}`);
  line(`  database      : ${target.database}`);
  line(`  supabase ref  : ${target.project}`);
  line('  source        : SOLACE  Week 2nd Operational Workbook.docx (W2-B001, W2-G001, W2-A001)');
  line('═'.repeat(78));

  if (APPLY && target.looksProduction && !CONFIRM_PRODUCTION) {
    line('');
    line('REFUSED: this target is not a local database and --confirm-production was not supplied.');
    await prisma.$disconnect();
    process.exit(2);
  }

  /**
   * ACTOR and AUTHOR are two different people, and conflating them would be a factual claim.
   * `--actor` is WHO RAN THE IMPORT. `--author` is the CONTENT'S BYLINE. The Week 2 workbook
   * names no author, so the byline stays unresolved and the publish checklist reports it.
   */
  let actor: Actor | null = null;
  if (ACTOR_ID) {
    const profile = await prisma.profiles.findUnique({
      where: { id: ACTOR_ID },
      select: { id: true, full_name: true, role: true },
    });
    if (!profile) {
      line(`\nREFUSED: --actor=${ACTOR_ID} does not match any profile.`);
      await prisma.$disconnect();
      process.exit(2);
    }
    actor = { id: profile.id, role: 'super_admin' };
    line(`\n  import actor  : ${profile.full_name ?? '(no name)'} (${profile.role})`);
  } else {
    line('\n  import actor  : NOT SUPPLIED (required for --apply)');
  }

  let authorId: string | null = null;
  if (AUTHOR_ID) {
    const profile = await prisma.profiles.findUnique({
      where: { id: AUTHOR_ID },
      select: { id: true, full_name: true },
    });
    if (!profile) {
      line(`\nREFUSED: --author=${AUTHOR_ID} does not match any profile.`);
      await prisma.$disconnect();
      process.exit(2);
    }
    authorId = profile.id;
    line(`  content author: ${profile.full_name ?? '(no name)'}`);
  } else {
    line('  content author: UNRESOLVED — the workbook names none (publish blocker, by design).');
  }

  if (APPLY && !actor) {
    line('\nREFUSED: --apply requires --actor=<profile-id> so writes are attributable.');
    await prisma.$disconnect();
    process.exit(2);
  }

  // ── Asset summary ─────────────────────────────────────────────────────────
  line('\n─── ASSETS ───');
  for (const asset of WEEK2_ASSETS) {
    line(`\n  ${asset.editorialRef} → ${asset.contentType} (public label "${asset.publicLabel}")`);
    line(`    title      : ${asset.title}`);
    line(`    slug       : /resources/${asset.slug}`);
    /**
     * The publish checklist requires 50-160 characters. A workbook description outside that range
     * is reported, never trimmed: shortening approved copy is an editor's decision, not an
     * importer's. It does not block the import — the column accepts it and the item is a draft.
     */
    const meta = asset.metaDescription ?? '';
    const metaInRange =
      meta.length >= CONTENT_LIMITS.minMetaDescription && meta.length <= CONTENT_LIMITS.maxMetaDescription;
    line(
      `    meta       : ${meta ? `${meta.length} chars` : 'MISSING'}` +
        (meta && !metaInRange
          ? ` — OUTSIDE the ${CONTENT_LIMITS.minMetaDescription}-${CONTENT_LIMITS.maxMetaDescription} publish range (publish blocker)`
          : ''),
    );
    line(`    blocks     : ${asset.body.blocks.length}  (${blockTypeSummary(asset)})`);
    line(`    faq items  : ${countFaqItems(asset)}`);
    line(`    words      : ${countWords(asset)}`);
    line(`    links      : ${asset.links.length}`);
    line(`    tags       : ${asset.tags.join(', ')}`);
    if (asset.authoredOutsideWorkbook.length) {
      line(`    authored outside workbook: ${asset.authoredOutsideWorkbook.join('; ')}`);
    }
    if (asset.missingFields.length) {
      line(`    missing from workbook    : ${asset.missingFields.join('; ')}`);
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  line('\n─── VALIDATION (before any write) ───');
  const validated = new Map<string, ReturnType<typeof validateAsset>>();
  for (const asset of WEEK2_ASSETS) {
    const result = validateAsset(asset);
    validated.set(asset.editorialRef, result);
    const status = result.errors.length === 0 ? 'OK' : `${result.errors.length} ERROR(S)`;
    line(`  ${asset.editorialRef} ${asset.contentType.padEnd(12)} ${status}`);
    for (const error of result.errors) line(`      ERROR   ${error}`);
    for (const warning of result.warnings) line(`      warning ${warning}`);
    for (const blocker of result.publishBlockers) line(`      publish-blocker ${blocker}`);
  }

  // ── Pass 1 ────────────────────────────────────────────────────────────────
  line('\n─── PASS 1: content items ───');
  const idByRef = new Map<string, string>();

  for (const asset of WEEK2_ASSETS) {
    const check = validated.get(asset.editorialRef)!;
    const outcome: AssetOutcome = {
      editorialRef: asset.editorialRef,
      action: 'create',
      blockCount: asset.body.blocks.length,
      faqCount: countFaqItems(asset),
      linkCount: asset.links.length,
      validationErrors: check.errors,
      validationWarnings: check.warnings,
      publishBlockers: check.publishBlockers,
    };

    if (check.errors.length > 0) {
      outcome.action = 'blocked-validation';
      outcome.reason = 'structural validation failed; nothing written for this asset';
      outcomes.push(outcome);
      line(`  ${asset.editorialRef}: BLOCKED — ${outcome.reason}`);
      continue;
    }

    const existing = (await prisma.content_items.findFirst({
      where: { editorial_ref: asset.editorialRef },
      select: {
        id: true,
        status: true,
        title: true,
        slug: true,
        content_type: true,
        current_revision_number: true,
        updated_at: true,
        deleted_at: true,
      },
    })) as ExistingRow | null;

    const decision = decideAction(existing);
    outcome.action = decision.action;
    outcome.reason = decision.reason;
    if (existing) outcome.id = existing.id;

    if (decision.action === 'skip-conflict') {
      outcomes.push(outcome);
      line(`  ${asset.editorialRef}: CONFLICT — ${decision.reason}`);
      continue;
    }

    if (!APPLY) {
      line(
        `  ${asset.editorialRef}: would ${decision.action.toUpperCase()} — ` +
          `${asset.contentType}, slug=${asset.slug}, blocks=${outcome.blockCount}, ` +
          `faq=${outcome.faqCount}, links=${outcome.linkCount}` +
          (existing ? ` (existing id ${existing.id})` : ''),
      );
      if (existing) idByRef.set(asset.editorialRef, existing.id);
      outcomes.push(outcome);
      continue;
    }

    // Shared field payload. `status` is deliberately absent — the state machine owns it.
    const fields = {
      title: asset.title,
      slug: asset.slug,
      metaDescription: asset.metaDescription,
      pillar: asset.pillar,
      week: asset.week,
      tags: asset.tags,
      editorialRef: asset.editorialRef,
      authorId,
      reviewerId: null,
      featuredImageUrl: null,
      featuredImageAlt: null,
      body: asset.body,
      typeFields: asset.typeFields,
      editorial: asset.editorial,
      robotsDirective: 'index,follow',
    };

    if (decision.action === 'create') {
      const created = await createContent(
        { contentType: asset.contentType, title: asset.title, slug: asset.slug } as never,
        actor!,
      );
      const fresh = await prisma.content_items.findUniqueOrThrow({ where: { id: created.id } });
      await updateContent(
        created.id,
        {
          ...fields,
          expectedUpdatedAt: fresh.updated_at.toISOString(),
          createRevision: false,
          changeSummary: 'Week 2 workbook import',
        } as never,
        actor!,
      );
      idByRef.set(asset.editorialRef, created.id);
      outcome.id = created.id;
      line(`  ${asset.editorialRef}: CREATED id=${created.id}`);
    } else {
      const fresh = await prisma.content_items.findUniqueOrThrow({ where: { id: existing!.id } });
      await updateContent(
        existing!.id,
        {
          ...fields,
          expectedUpdatedAt: fresh.updated_at.toISOString(),
          createRevision: false,
          changeSummary: 'Week 2 workbook re-import',
        } as never,
        actor!,
      );
      idByRef.set(asset.editorialRef, existing!.id);
      line(`  ${asset.editorialRef}: UPDATED id=${existing!.id}`);
    }

    const after = await prisma.content_items.findUniqueOrThrow({
      where: { id: idByRef.get(asset.editorialRef)! },
      select: { word_count: true },
    });
    outcome.wordCount = after.word_count ?? undefined;
    outcomes.push(outcome);
  }

  // ── Pass 2 ────────────────────────────────────────────────────────────────
  line('\n─── PASS 2: links (editorial_ref → id) ───');

  for (const asset of WEEK2_ASSETS) {
    const sourceId = idByRef.get(asset.editorialRef);
    if (!sourceId) {
      line(`  ${asset.editorialRef}: skipped (no id — asset was not imported)`);
      continue;
    }

    const resolved: Array<{
      targetKind: 'content' | 'route';
      targetContentId?: string;
      targetRoute?: string;
      anchorText: string | null;
      relation: string;
    }> = [];
    let unresolved = 0;

    for (const link of asset.links) {
      if (link.targetKind === 'content') {
        const targetId = idByRef.get(link.targetRef ?? '');
        if (!targetId) {
          unresolved += 1;
          line(`  ${asset.editorialRef}: cannot resolve content target ${link.targetRef}`);
          continue;
        }
        resolved.push({
          targetKind: 'content',
          targetContentId: targetId,
          anchorText: link.anchorText,
          relation: link.relation,
        });
      } else {
        resolved.push({
          targetKind: 'route',
          targetRoute: link.targetRoute,
          anchorText: link.anchorText,
          relation: link.relation,
        });
      }
    }

    if (!APPLY) {
      line(
        `  ${asset.editorialRef}: would replace links with ${resolved.length}` +
          (unresolved ? ` (${unresolved} unresolved)` : ''),
      );
      for (const link of asset.links) {
        const destination =
          link.targetKind === 'content'
            ? `content:${link.targetRef}`
            : `route:${link.targetRoute} → ${ROUTE_REGISTRY[link.targetRoute as keyof typeof ROUTE_REGISTRY]?.href ?? '(unmapped)'}`;
        line(`      ${link.relation.padEnd(16)} ${destination}  anchor=${JSON.stringify(link.anchorText)}`);
      }
      continue;
    }

    await replaceLinks(sourceId, resolved as never, actor!);
    line(`  ${asset.editorialRef}: ${resolved.length} link(s) written`);
  }

  // ── Content graph ─────────────────────────────────────────────────────────
  line('\n─── CONTENT-TO-CONTENT GRAPH (from the workbook) ───');
  for (const [from, to] of EXPECTED_CONTENT_EDGES) {
    line(`  ${from} → ${to}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  line('\n─── SUMMARY ───');
  for (const outcome of outcomes) {
    line(
      `  ${outcome.editorialRef}  ${outcome.action.padEnd(18)}` +
        `blocks=${outcome.blockCount} faq=${outcome.faqCount} links=${outcome.linkCount}` +
        (outcome.wordCount ? ` words=${outcome.wordCount}` : '') +
        (outcome.id ? ` id=${outcome.id}` : ''),
    );
    if (outcome.reason) line(`      ${outcome.reason}`);
    for (const blocker of outcome.publishBlockers) line(`      publish-blocker ${blocker}`);
  }

  const blocked = outcomes.filter((o) => o.action === 'blocked-validation' || o.action === 'skip-conflict');
  line(
    `\n  ${APPLY ? 'APPLIED' : 'DRY RUN'} — ${outcomes.length - blocked.length} asset(s) ready, ${blocked.length} refused.`,
  );
  line('  Status stays DRAFT. Nothing was submitted, approved, scheduled or published.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
