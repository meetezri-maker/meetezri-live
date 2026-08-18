/**
 * Week 2 post-import verification — READ ONLY.
 *
 * Reads the three records back FROM THE DATABASE rather than trusting the importer's in-memory
 * objects, runs them through the real admin service and the real response schema, proves they are
 * invisible to every public surface, and audits each intended link through all three stages:
 * stored → serialized → rendered as an actual anchor.
 *
 * Nothing here writes, submits, approves or publishes.
 *
 * Run:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/verify-week2.ts
 */

import 'dotenv/config';
import { ROUTE_REGISTRY, validateContentBody, type ContentType } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';
import { getContent, getLinks } from '../../src/modules/content-hub/content-hub.service';
import { adminContentDetailSchema } from '../../src/modules/content-hub/content-hub.schema';
import { evaluateChecklist } from '../../src/modules/content-hub/content-hub.publish.service';
import {
  resolvePreviewContent,
  resolvePublishedContent,
  resolvePublishedList,
  resolveSitemapEntries,
} from '../../src/modules/content-hub/content-hub.read.service';
import { renderResourceDetail } from '../../src/modules/render/renderResourceDetail';
import { WEEK2_ASSETS, EXPECTED_CONTENT_EDGES } from '../../src/modules/content-hub/week2/week2-content';

const REFS = ['W2-B001', 'W2-G001', 'W2-A001'];
const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

const ok = (pass: boolean) => (pass ? 'PASS' : 'FAIL');
let failures = 0;
function check(label: string, pass: boolean, detail = '') {
  if (!pass) failures += 1;
  console.log(`  [${ok(pass)}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Anchors inside the rendered page region (article + breadcrumbs + related), not the site shell. */
function pageAnchors(html: string): string[] {
  const start = html.indexOf('<div class="sol-page">');
  const end = html.indexOf('<footer class="sol-site-footer">');
  if (start === -1) return [];
  const region = html.slice(start, end === -1 ? undefined : end);
  return Array.from(region.matchAll(/<a\b[^>]*href="([^"]*)"/g)).map((m) => m[1]);
}

/** Structural equality, insensitive to object key order. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Top-level keys present in the mapping but absent from what the database kept. */
function droppedKeys(sent: unknown, stored: unknown): string[] {
  const from = (sent ?? {}) as Record<string, unknown>;
  const to = (stored ?? {}) as Record<string, unknown>;
  return Object.keys(from).filter((key) => !(key in to));
}

function faqCount(body: unknown): number {
  const blocks = (body as { blocks?: Array<{ type?: string; items?: unknown[] }> })?.blocks ?? [];
  const faq = blocks.find((b) => b.type === 'faq');
  return faq?.items?.length ?? 0;
}

function blockSummary(body: unknown): string {
  const blocks = (body as { blocks?: Array<{ type?: string }> })?.blocks ?? [];
  const counts = new Map<string, number>();
  for (const block of blocks) counts.set(block.type ?? '?', (counts.get(block.type ?? '?') ?? 0) + 1);
  return [...counts.entries()].map(([type, n]) => `${type}×${n}`).join(', ');
}

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
    orderBy: { editorial_ref: 'asc' },
  });
  const byRef = new Map(rows.map((row) => [row.editorial_ref as string, row]));
  const idToRef = new Map(rows.map((row) => [row.id, row.editorial_ref as string]));

  // ── Phase 8: records ──────────────────────────────────────────────────────
  console.log('═══ PHASE 8 — READ-BACK VERIFICATION ═══');
  check('all three records exist', rows.length === 3, `found ${rows.length}`);

  for (const asset of WEEK2_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    console.log(`\n  ── ${asset.editorialRef} ──`);
    if (!row) {
      check('record present', false);
      continue;
    }

    console.log(`     id            : ${row.id}`);
    console.log(`     slug          : ${row.slug}`);
    console.log(`     title         : ${row.title}`);
    console.log(`     content_type  : ${row.content_type}`);
    console.log(`     blocks        : ${blockSummary(row.body)}`);
    console.log(`     word_count    : ${row.word_count}  reading_time=${row.reading_time_minutes}min`);

    check('editorial_ref matches', row.editorial_ref === asset.editorialRef);
    check('slug matches the workbook', row.slug === asset.slug, row.slug);
    check('title matches the workbook', row.title === asset.title);
    check('content_type matches', row.content_type === asset.contentType, row.content_type);
    check('status is draft', row.status === 'draft', row.status);
    check('published_at is null', row.published_at === null);
    check('first_published_at is null', row.first_published_at === null);
    check('scheduled_for is null', row.scheduled_for === null);
    check(
      'all approval gates pending',
      row.founder_approval === 'pending' &&
        row.marketing_approval === 'pending' &&
        row.seo_approval === 'pending',
      `founder=${row.founder_approval} marketing=${row.marketing_approval} seo=${row.seo_approval}`,
    );
    check('author unassigned', row.author_id === null, String(row.author_id));
    check('reviewer unassigned', row.reviewer_id === null, String(row.reviewer_id));
    check('reviewed_at unset', row.reviewed_at === null);
    check('canonical override unset', row.canonical_url_override === null);
    check('meta description stored verbatim', row.meta_description === asset.metaDescription);
    check('pillar stored', row.pillar === asset.pillar, String(row.pillar));
    check('week is 2', row.week === 2, String(row.week));
    check('tags stored', JSON.stringify(row.tags) === JSON.stringify(asset.tags), JSON.stringify(row.tags));
    check(
      'block count matches the mapping',
      ((row.body as { blocks?: unknown[] }).blocks ?? []).length === asset.body.blocks.length,
      `${((row.body as { blocks?: unknown[] }).blocks ?? []).length} vs ${asset.body.blocks.length}`,
    );
    check('faq item count matches', faqCount(row.body) === faqCount(asset.body), String(faqCount(row.body)));
    /**
     * Compared by VALUE, not by serialised string: the API parses these through
     * `typeFieldsSchemaFor` / `editorialMetadataSchema`, which rebuild the object in schema
     * declaration order. A key-order difference is not a data difference. Any key the schema
     * actually dropped is reported by name.
     */
    const tfDropped = droppedKeys(asset.typeFields, row.type_fields);
    check('every type_fields key survived', tfDropped.length === 0, tfDropped.join(', '));
    check('type_fields values match', deepEqual(asset.typeFields, row.type_fields));

    const edDropped = droppedKeys(asset.editorial, row.editorial);
    check('every editorial key survived', edDropped.length === 0, edDropped.join(', '));
    check('editorial values match', deepEqual(asset.editorial, row.editorial));

    // Revisions: the importer passes createRevision:false, so a fresh import has none.
    const revisions = await prisma.content_revisions.count({ where: { content_id: row.id } });
    check('revision count is 0', revisions === 0, String(revisions));

    // The body must satisfy the same validators the editor uses.
    const draft = validateContentBody(row.body, { contentType: row.content_type as ContentType });
    check('body passes draft validation', draft.errors.length === 0, `${draft.errors.length} error(s)`);

    // The real admin read path + the real response schema.
    const detail = await getContent(row.id);
    const parsed = adminContentDetailSchema.safeParse(detail);
    check('admin serializer + response schema accept it', parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3)));

    // The publish checklist — reported, never acted on.
    const checklist = await evaluateChecklist(prisma, row.id);
    const unmet = (checklist.items ?? []).filter((item: { passed: boolean }) => !item.passed);
    console.log(`     publish blockers (${unmet.length}):`);
    for (const item of unmet) console.log(`       - ${item.label ?? item.key}`);
  }

  // ── Phase 5: link audit ───────────────────────────────────────────────────
  console.log('\n═══ PHASE 5 — LINK AUDIT: STORED → SERIALIZED → RENDERED ═══');

  for (const asset of WEEK2_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    if (!row) continue;

    const stored = await getLinks(row.id);
    // Drafts have no public payload, so the PREVIEW seam is used — it runs the same serializer
    // and the same renderer the published page will, without publishing anything.
    const preview = await resolvePreviewContent(row.id);
    const html = preview ? renderResourceDetail({ origin: ORIGIN, detail: preview, assets: NO_ASSETS }) : '';
    const anchors = preview ? pageAnchors(html) : [];

    console.log(`\n  ── ${asset.editorialRef} ──`);
    console.log(`     A. stored in content_links : ${stored.length}`);
    console.log(`     B. serialized publicly     : ${preview ? preview.links.length : 'n/a'}`);
    console.log(`     C. anchors in rendered HTML: ${anchors.length}`);

    for (const spec of asset.links) {
      const wanted =
        spec.targetKind === 'content'
          ? `content:${spec.targetRef}`
          : `route:${spec.targetRoute}`;

      const storedRow = stored.find((link: { targetKind?: string; target_kind?: string; targetContentId?: string | null; target_content_id?: string | null; targetRoute?: string | null; target_route?: string | null }) => {
        const kind = link.targetKind ?? link.target_kind;
        const contentId = link.targetContentId ?? link.target_content_id;
        const route = link.targetRoute ?? link.target_route;
        return spec.targetKind === 'content'
          ? kind === 'content' && idToRef.get(contentId ?? '') === spec.targetRef
          : kind === 'route' && route === spec.targetRoute;
      });

      const href =
        spec.targetKind === 'content'
          ? `/resources/${byRef.get(spec.targetRef ?? '')?.slug ?? '?'}`
          : ROUTE_REGISTRY[spec.targetRoute as keyof typeof ROUTE_REGISTRY]?.href ?? '?';

      const serialized = preview?.links.some((link) => link.href === href) ?? false;
      const rendered = anchors.includes(href);

      console.log(
        `     ${wanted.padEnd(24)} A=${storedRow ? 'yes' : 'NO '} B=${serialized ? 'yes' : 'NO '} ` +
          `C=${rendered ? 'yes' : 'NO '}  → ${href}`,
      );
    }

    if (preview) {
      console.log(`     related cards rendered: ${preview.related.map((card) => card.slug).join(', ') || '(none)'}`);
    }
  }

  console.log('\n  content-to-content edges expected by the workbook:');
  for (const [from, to] of EXPECTED_CONTENT_EDGES) {
    const source = byRef.get(from);
    const target = byRef.get(to);
    const stored = source && target
      ? await prisma.content_links.count({
          where: { source_id: source.id, target_content_id: target.id, relation: 'related_content' },
        })
      : 0;
    check(`${from} → ${to} stored`, stored === 1, `${stored} row(s)`);
  }

  // ── Phase 9: public leak test ─────────────────────────────────────────────
  console.log('\n═══ PHASE 9 — PUBLIC LEAK TEST ═══');

  for (const asset of WEEK2_ASSETS) {
    const published = await resolvePublishedContent(asset.slug);
    check(`/resources/${asset.slug} is not publicly resolvable`, published === null);
  }

  const list = await resolvePublishedList({ page: 1, pageSize: 50 } as never);
  const listedSlugs = new Set(list.items.map((item: { slug: string }) => item.slug));
  for (const asset of WEEK2_ASSETS) {
    check(`${asset.editorialRef} absent from the public index`, !listedSlugs.has(asset.slug));
  }
  console.log(`     public index currently lists: ${[...listedSlugs].join(', ')}`);

  const sitemap = await resolveSitemapEntries();
  const sitemapSlugs = new Set(sitemap.map((entry: { slug: string }) => entry.slug));
  for (const asset of WEEK2_ASSETS) {
    check(`${asset.editorialRef} absent from sitemap.xml`, !sitemapSlugs.has(asset.slug));
  }

  // ── Week 1 untouched ──────────────────────────────────────────────────────
  console.log('\n═══ WEEK 1 UNCHANGED ═══');
  const week1 = await prisma.content_items.findMany({
    where: { editorial_ref: { in: ['W1-A001', 'W1-G001', 'W1-B001'] } },
    select: { editorial_ref: true, status: true, slug: true, updated_at: true, current_revision_number: true },
    orderBy: { editorial_ref: 'asc' },
  });
  for (const row of week1) {
    console.log(
      `  ${row.editorial_ref}  ${row.status}  rev=${row.current_revision_number}  updated=${row.updated_at.toISOString()}  /resources/${row.slug}`,
    );
    check(`${row.editorial_ref} still published`, row.status === 'published');
  }

  console.log(`\n═══ ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ═══`);
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
