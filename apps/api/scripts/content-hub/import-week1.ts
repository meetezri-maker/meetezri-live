/**
 * Week 1 Content Hub import — a ONE-TIME, CONTROLLED migration utility.
 *
 * Not a generic DOCX importer, not a seeder, and not wired into deploy or app startup. It must be
 * invoked explicitly.
 *
 *   Dry run (default, no writes):
 *     npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/import-week1.ts
 *
 *   Apply:
 *     … scripts/content-hub/import-week1.ts --apply --confirm-production
 *
 * DESIGN NOTES
 *
 * TWO PASSES, because the Week 1 link graph is cyclic: A→B, G→A, G→B, B→A, B→G. No single-pass
 * import can resolve `editorial_ref → id` for a target that does not exist yet.
 *   Pass 1 — create/update the three items, no content links.
 *   Pass 2 — resolve refs to ids, then replace each item's link set.
 *
 * EVERYTHING GOES THROUGH THE SERVICE LAYER (`createContent`, `updateContent`, `replaceLinks`),
 * so the same slug rules, shared body validators, revision behaviour, audit logging and link
 * validation apply as when an admin uses the UI. Nothing writes `content_items` directly and
 * nothing touches `status` — the state machine is not bypassed.
 *
 * IDEMPOTENT, keyed on `editorial_ref` (never on title). A re-run updates the same three rows.
 * A record that is published, or that looks hand-edited, is REFUSED rather than overwritten.
 *
 * NEVER approves and NEVER publishes. Items land as `draft` with all gates pending.
 */

import 'dotenv/config';
import { ROUTE_REGISTRY } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';
import {
  createContent,
  replaceLinks,
  updateContent,
  type Actor,
} from '../../src/modules/content-hub/content-hub.service';
import {
  WEEK1_ASSETS,
  EXPECTED_CONTENT_EDGES,
  type Week1Asset,
} from '../../src/modules/content-hub/week1/week1-content';
import {
  decideAction,
  validateAsset,
  type ExistingRow,
} from '../../src/modules/content-hub/week1/week1-import.helpers';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRM_PRODUCTION = argv.includes('--confirm-production');
/** Who is running the import — required for any write, lands in the audit log. */
const ACTOR_ID = argv.find((a) => a.startsWith('--actor='))?.split('=')[1];
/** The published byline. Separate from the actor, and unset by default. */
const AUTHOR_ID = argv.find((a) => a.startsWith('--author='))?.split('=')[1];

interface Target {
  host: string;
  database: string;
  project: string;
  looksProduction: boolean;
}

/** Host and database only — never credentials. */
function describeTarget(): Target {
  const raw = process.env.DATABASE_URL ?? '';
  const match = raw.match(/^\w+:\/\/([^:@/]+)(?::[^@]*)?@([^/?]+)\/([^?]*)/);
  if (!match) return { host: '(unparseable)', database: '(unknown)', project: '(unknown)', looksProduction: false };
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

// ─── Report accumulation ─────────────────────────────────────────────────────

export interface AssetOutcome {
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

function countFaqItems(asset: Week1Asset): number {
  const faq = asset.body.blocks.find((b) => b.type === 'faq') as { items?: unknown[] } | undefined;
  return faq?.items?.length ?? 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const target = describeTarget();
  const mode = APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)';

  line('═'.repeat(78));
  line('  SOLACE CONTENT HUB — WEEK 1 IMPORT');
  line('═'.repeat(78));
  line(`  mode          : ${mode}`);
  line(`  host          : ${target.host}`);
  line(`  database      : ${target.database}`);
  line(`  supabase ref  : ${target.project}`);
  line(`  source        : Blog for fisrt week ai.docx (W1-A001, W1-G001, W1-B001)`);
  line('═'.repeat(78));

  if (APPLY && target.looksProduction && !CONFIRM_PRODUCTION) {
    line('');
    line('REFUSED: this target is not a local database and --confirm-production was not supplied.');
    line('Re-run with --apply --confirm-production once the target above is confirmed correct.');
    await prisma.$disconnect();
    process.exit(2);
  }

  /**
   * ACTOR and AUTHOR are two different people, and conflating them would be a factual claim.
   *
   * `--actor` is WHO RAN THE IMPORT. It drives the service layer's role checks and lands in the
   * audit log, so it must be a real admin and is required before any write.
   *
   * `--author` is the CONTENT'S BYLINE, published on the page. The workbook names no author, so
   * it defaults to unresolved and the publish checklist reports it as a blocker (Task 6). It is
   * never inferred from `--actor`: running an import is not authorship.
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
    line('\nREFUSED: --apply requires --actor=<profile-id> so writes are attributable in the audit log.');
    await prisma.$disconnect();
    process.exit(2);
  }

  // ── Validation pass (Task 12) ──────────────────────────────────────────────
  line('\n─── VALIDATION (before any write) ───');
  const validated = new Map<string, ReturnType<typeof validateAsset>>();
  for (const asset of WEEK1_ASSETS) {
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

  for (const asset of WEEK1_ASSETS) {
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
          (existing ? ` (existing id ${existing.id})` : '')
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
        actor!
      );
      const fresh = await prisma.content_items.findUniqueOrThrow({ where: { id: created.id } });
      await updateContent(
        created.id,
        {
          ...fields,
          expectedUpdatedAt: fresh.updated_at.toISOString(),
          createRevision: false,
          changeSummary: 'Week 1 workbook import',
        } as never,
        actor!
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
          changeSummary: 'Week 1 workbook re-import',
        } as never,
        actor!
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

  for (const asset of WEEK1_ASSETS) {
    const sourceId = idByRef.get(asset.editorialRef);
    if (!sourceId) {
      line(`  ${asset.editorialRef}: skipped (no id — asset was not imported)`);
      continue;
    }

    const resolved: Array<Record<string, unknown>> = [];
    let unresolved = 0;

    asset.links.forEach((link, index) => {
      if (link.targetKind === 'content') {
        const targetId = idByRef.get(link.targetRef!);
        if (!targetId) {
          unresolved += 1;
          line(`  ${asset.editorialRef}: UNRESOLVED content target ${link.targetRef}`);
          return;
        }
        resolved.push({
          targetKind: 'content',
          targetContentId: targetId,
          targetRoute: null,
          anchorText: link.anchorText,
          relation: link.relation,
          sortOrder: index,
        });
      } else {
        resolved.push({
          targetKind: 'route',
          targetContentId: null,
          targetRoute: link.targetRoute,
          anchorText: link.anchorText,
          relation: link.relation,
          sortOrder: index,
        });
      }
    });

    if (!APPLY) {
      line(
        `  ${asset.editorialRef}: would replace ${resolved.length} link(s)` +
          (unresolved ? ` (${unresolved} unresolved in dry run — targets not yet created)` : '')
      );
      for (const link of resolved) {
        const where =
          link.targetKind === 'content'
            ? `content:${link.targetContentId}`
            : `route:${link.targetRoute} -> ${ROUTE_REGISTRY[link.targetRoute as keyof typeof ROUTE_REGISTRY]?.href}`;
        line(`      ${String(link.relation).padEnd(16)} ${where}  anchor=${link.anchorText ?? '(null → target title)'}`);
      }
      continue;
    }

    await replaceLinks(sourceId, resolved as never, actor!);
    line(`  ${asset.editorialRef}: replaced ${resolved.length} link(s)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  line('\n─── SUMMARY ───');
  for (const outcome of outcomes) {
    line(
      `  ${outcome.editorialRef}: ${outcome.action}` +
        (outcome.id ? ` id=${outcome.id}` : '') +
        ` blocks=${outcome.blockCount} faq=${outcome.faqCount} links=${outcome.linkCount}` +
        (outcome.wordCount ? ` words=${outcome.wordCount}` : '') +
        (outcome.reason ? `\n      reason: ${outcome.reason}` : '')
    );
    for (const blocker of outcome.publishBlockers) line(`      publish-blocker: ${blocker}`);
  }

  line('\n  Expected content→content edges:');
  for (const [from, to] of EXPECTED_CONTENT_EDGES) line(`    ${from} → ${to}`);

  line('\n  Authored outside the workbook:');
  for (const asset of WEEK1_ASSETS) {
    for (const field of asset.authoredOutsideWorkbook) line(`    ${asset.editorialRef}: ${field}`);
  }

  line('\n  Missing from the workbook:');
  for (const asset of WEEK1_ASSETS) {
    for (const field of asset.missingFields) line(`    ${asset.editorialRef}: ${field}`);
  }

  line('');
  line(APPLY ? 'APPLY COMPLETE. Nothing was approved and nothing was published.' : 'DRY RUN COMPLETE. No writes were made.');

  await prisma.$disconnect();
}

/**
 * Only runs when invoked directly.
 *
 * Without this guard, importing the module from a test would execute the whole import — which is
 * an unusually bad failure mode for a script that writes to production.
 */
if (require.main === module) {
  main().catch(async (error) => {
    console.error('\nimport-week1 FAILED:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
