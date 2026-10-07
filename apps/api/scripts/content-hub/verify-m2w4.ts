/**
 * Month 2 Week 4 read-back verification — READ ONLY.
 *
 * Reads all three records back through the real service/API boundary, runs the real publish
 * checklist both alone and with cluster context, audits every link stored -> serialized ->
 * rendered, and proves the drafts are invisible publicly and that every prior asset is untouched.
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
import { M2W4_ASSETS, EXPECTED_CONTENT_EDGES } from '../../src/modules/content-hub/month2week4/m2w4-content';

const REFS = ['M2-W4-B001', 'M2-W4-G001', 'M2-W4-A001'];
const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

/**
 * Every Content Hub asset that existed BEFORE this import, with the state captured from the
 * database immediately before the Week 4 write. A ref missing from this map fails loudly rather
 * than being skipped.
 */
const BASELINE: Record<string, string> = {
  'W1-A001': 'published', 'W1-B001': 'published', 'W1-G001': 'published',
  'W2-A001': 'published', 'W2-B001': 'published', 'W2-G001': 'published',
  'W3-A001': 'published', 'W3-B001': 'published', 'W3-G001': 'published',
  'W4-A001': 'published', 'W4-B001': 'published', 'W4-G001': 'published',
  'M2-W1-A001': 'published', 'M2-W1-B001': 'published', 'M2-W1-G001': 'published',
  'M2-W2-A001': 'published', 'M2-W2-B001': 'published', 'M2-W2-G001': 'published',
  'M2-W3-A001': 'published', 'M2-W3-B001': 'published', 'M2-W3-G001': 'published',
};
const BASELINE_REVISION: Record<string, number> = {
  'W1-A001': 3, 'W1-B001': 4, 'W1-G001': 3,
  'W2-A001': 5, 'W2-B001': 3, 'W2-G001': 3,
  'W3-A001': 3, 'W3-B001': 3, 'W3-G001': 4,
  'W4-A001': 3, 'W4-B001': 3, 'W4-G001': 3,
  'M2-W1-A001': 3, 'M2-W1-B001': 3, 'M2-W1-G001': 3,
  'M2-W2-A001': 3, 'M2-W2-B001': 3, 'M2-W2-G001': 3,
  'M2-W3-A001': 3, 'M2-W3-B001': 3, 'M2-W3-G001': 4,
};

let failures = 0;
function check(label: string, pass: boolean, detail = '') {
  if (!pass) failures += 1;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function pageAnchors(html: string): string[] {
  const start = html.indexOf('<div class="sol-page">');
  const end = html.indexOf('<footer class="sol-site-footer">');
  if (start === -1) return [];
  const region = html.slice(start, end === -1 ? undefined : end);
  return Array.from(region.matchAll(/<a\b[^>]*href="([^"]*)"/g)).map((m) => m[1]);
}

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
  });
  const byRef = new Map(rows.map((r) => [r.editorial_ref as string, r]));
  const idToRef = new Map(rows.map((r) => [r.id, r.editorial_ref as string]));
  const clusterIds = rows.map((r) => r.id);

  check('all three records exist', rows.length === 3, `found ${rows.length}`);

  for (const asset of M2W4_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    console.log(`\n══ ${asset.editorialRef} ══`);
    if (!row) {
      check('record present', false);
      continue;
    }

    const blocks = (row.body as { blocks?: Array<{ type?: string }> })?.blocks ?? [];
    const counts = new Map<string, number>();
    for (const b of blocks) counts.set(b.type ?? '?', (counts.get(b.type ?? '?') ?? 0) + 1);
    const faq = blocks.find((b) => b.type === 'faq') as { items?: unknown[] } | undefined;

    console.log(`   id            : ${row.id}`);
    console.log(`   title         : ${row.title}`);
    console.log(`   slug          : ${row.slug}`);
    console.log(`   type          : ${row.content_type}   status: ${row.status}   revision: ${row.current_revision_number}`);
    console.log(`   blocks        : ${blocks.length} (${[...counts].map(([t, n]) => `${t}×${n}`).join(', ')})`);
    console.log(`   words         : ${row.word_count}   reading_time=${row.reading_time_minutes}min`);
    console.log(`   meta          : ${row.meta_description ? `${row.meta_description.length} chars` : 'NULL'}`);
    console.log(`   faq items     : ${faq?.items?.length ?? 0}`);
    console.log(`   cta blocks    : ${counts.get('cta') ?? 0}   safety_notice: ${counts.get('safety_notice') ?? 0}`);
    console.log(`   featured image: ${row.featured_image_url ?? 'none'}   alt: ${row.featured_image_alt ?? 'none'}`);
    console.log(`   author        : ${row.author_id ?? 'unset'}   reviewer: ${row.reviewer_id ?? 'unset'}`);
    console.log(`   gates         : founder=${row.founder_approval} marketing=${row.marketing_approval} seo=${row.seo_approval}`);
    console.log(`   type_fields   : ${JSON.stringify(row.type_fields)}`);
    // The column is `editorial` (schema.prisma:1759), not `editorial_metadata`.
    const editorialKeys = Object.keys((row.editorial ?? {}) as object);
    console.log(`   editorial     : ${editorialKeys.join(', ') || '(none)'}`);
    check('editorial metadata persisted', editorialKeys.length > 0, `${editorialKeys.length} key(s)`);

    check('editorial_ref matches', row.editorial_ref === asset.editorialRef);
    check('slug matches the plan', row.slug === asset.slug, row.slug);
    check('title matches the plan', row.title === asset.title);
    check('content_type matches', row.content_type === asset.contentType);
    check('status is draft', row.status === 'draft', row.status);
    check('published_at null', row.published_at === null);
    check('first_published_at null', row.first_published_at === null);
    check('scheduled_for null', row.scheduled_for === null);
    check('gates pending',
      row.founder_approval === 'pending' && row.marketing_approval === 'pending' && row.seo_approval === 'pending');
    check('author unset', row.author_id === null);
    check('reviewer unset', row.reviewer_id === null);
    check('featured image unset', row.featured_image_url === null);
    check('no safety_notice manufactured', (counts.get('safety_notice') ?? 0) === 0);
    check('revisions 0', row.current_revision_number === 0);
    check('block count matches mapping', blocks.length === asset.body.blocks.length,
      `${blocks.length} vs ${asset.body.blocks.length}`);

    if (row.content_type === 'aeo_answer') {
      const tf = (row.type_fields ?? {}) as Record<string, unknown>;
      const headings = blocks.filter((b) => b.type === 'heading');
      check('direct_answer present and first', blocks[0]?.type === 'direct_answer', String(blocks[0]?.type));
      check('exactly one direct_answer', (counts.get('direct_answer') ?? 0) === 1);
      check('primary_question present', typeof tf.primary_question === 'string' && tf.primary_question.length > 0);
      check('snippet_answer present', typeof tf.snippet_answer === 'string' && tf.snippet_answer.length > 0);
      check('faq items == 7', (faq?.items?.length ?? 0) === 7);
      console.log(`   heading blocks: ${headings.length} (30 question H2s + section headings)`);
      console.log(`   primary_question: ${tf.primary_question}`);
      console.log(`   snippet_answer  : ${String(tf.snippet_answer).slice(0, 110)}…`);
    }
    if (row.content_type === 'geo_article') {
      const tf = (row.type_fields ?? {}) as Record<string, unknown>;
      check('core_concept present', typeof tf.core_concept === 'string' && tf.core_concept.length > 0);
      check('citation_summary present', typeof tf.citation_summary === 'string' && tf.citation_summary.length > 0);
      // The workbook has no Key Statements section anywhere, so the field stays unset and remains
      // a deliberate publish blocker rather than something invented at import time.
      check('key_statements intentionally absent', tf.key_statements === undefined, JSON.stringify(tf.key_statements));
      check('meta_description null (172-char source over limit)', row.meta_description === null);
      check('key_takeaway block present', (counts.get('key_takeaway') ?? 0) === 1);
      check('table block present', (counts.get('table') ?? 0) === 1);
      check('one geo_statement', (counts.get('geo_statement') ?? 0) === 1);
      check('faq items == 8', (faq?.items?.length ?? 0) === 8);
      console.log(`   core_concept    : ${tf.core_concept}`);
      console.log(`   citation_summary: ${String(tf.citation_summary).slice(0, 110)}…`);
      console.log(`   key_statements  : ${JSON.stringify(tf.key_statements)}`);
    }

    const draft = validateContentBody(row.body, { contentType: row.content_type as ContentType });
    check('body passes draft validation', draft.errors.length === 0, `${draft.errors.length} error(s)`);
    check('admin serializer + schema accept it', adminContentDetailSchema.safeParse(await getContent(row.id)).success);

    // Evaluated twice: alone, and as the cluster service would. Rule 11 accepts a sibling target
    // that is publishing in the same cluster, so reporting only the solo run invents a blocker.
    const checklist = await evaluateChecklist(prisma, row.id);
    const clustered = await evaluateChecklist(prisma, row.id, { clusterIds });
    const unmet = checklist.items.filter((i: { passed: boolean }) => !i.passed);
    const hard = unmet.filter((i: { blocking: boolean }) => i.blocking);
    const optional = unmet.filter((i: { blocking: boolean }) => !i.blocking);
    const clusterHard = clustered.items.filter((i: { passed: boolean; blocking: boolean }) => !i.passed && i.blocking);
    console.log(`   HARD blockers, evaluated alone (${hard.length}):`);
    for (const i of hard) console.log(`      - ${i.label}${i.details ? ` (${i.details})` : ''}`);
    console.log(`   HARD blockers, evaluated as a 3-item cluster (${clusterHard.length}):`);
    for (const i of clusterHard) console.log(`      - ${i.label}${i.details ? ` (${i.details})` : ''}`);
    console.log(`   NON-BLOCKING (${optional.length}):`);
    for (const i of optional) console.log(`      - ${i.label}${i.details ? ` (${i.details})` : ''}`);
    check('not publishable yet', !checklist.passed && !clustered.passed);
  }

  // ── Links ────────────────────────────────────────────────────────────────
  console.log('\n══ LINK AUDIT: stored → serialized → rendered ══');
  for (const asset of M2W4_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    if (!row) continue;
    const stored = await getLinks(row.id);
    const preview = await resolvePreviewContent(row.id);
    const html = preview ? renderResourceDetail({ origin: ORIGIN, detail: preview, assets: NO_ASSETS }) : '';
    const anchors = pageAnchors(html);

    console.log(`\n  ${asset.editorialRef}: stored=${stored.length} serialized=${preview?.links.length ?? 0}`);
    for (const spec of asset.links) {
      let href = '?';
      if (spec.targetKind === 'route') {
        href = ROUTE_REGISTRY[spec.targetRoute as keyof typeof ROUTE_REGISTRY]?.href ?? '?';
      } else {
        const local = byRef.get(spec.targetRef ?? '');
        const remote = local
          ? null
          : await prisma.content_items.findFirst({
              where: { editorial_ref: spec.targetRef ?? '', deleted_at: null },
              select: { slug: true },
            });
        href = `/resources/${local?.slug ?? remote?.slug ?? '?'}`;
      }
      const inDb = stored.some((l: { targetRoute?: string | null; targetContentId?: string | null }) =>
        spec.targetKind === 'route' ? l.targetRoute === spec.targetRoute : !!l.targetContentId);
      const serialized = preview?.links.some((l) => l.href === href) ?? false;
      const rendered = anchors.includes(href);
      const what = spec.targetKind === 'content' ? `content:${spec.targetRef}` : `route:${spec.targetRoute}`;
      console.log(`     ${what.padEnd(26)} DB=${inDb ? 'yes' : 'NO '} API=${serialized ? 'yes' : 'NO '} ` +
        `HTML=${rendered ? 'yes' : 'NO '}  → ${href}`);
    }
    const talk = anchors.filter((h) => h === '/how-it-works').length;
    const res = anchors.filter((h) => h === '/resources').length;
    console.log(`     rendered article anchors: /how-it-works ×${talk}, /resources ×${res}`);
    console.log(`     /app/* anchors in whole page: ${Array.from(html.matchAll(/href="(\/app[^"]*)"/g)).length}`);
  }

  console.log('\n  cluster edges:');
  for (const [from, to] of EXPECTED_CONTENT_EDGES) {
    const src = byRef.get(from);
    const dst =
      byRef.get(to) ??
      (await prisma.content_items.findFirst({ where: { editorial_ref: to, deleted_at: null }, select: { id: true } }));
    const n = src && dst
      ? await prisma.content_links.count({
          where: { source_id: src.id, target_content_id: dst.id, relation: 'related_content' },
        })
      : 0;
    check(`${from} → ${to} stored`, n === 1, `${n} row(s)`);
  }
  const l001 = await prisma.content_links.count({
    where: { source_id: { in: clusterIds }, target_content_id: null, target_kind: 'content' },
  });
  check('no dangling M2-W4-L001 content link', l001 === 0, `${l001} row(s)`);

  // ── Public invisibility ──────────────────────────────────────────────────
  console.log('\n══ PUBLIC INVISIBILITY (drafts) ══');
  const list = await resolvePublishedList({ page: 1, pageSize: 100 } as never);
  const listed = new Set(list.items.map((i: { slug: string }) => i.slug));
  const sitemap = new Set((await resolveSitemapEntries()).map((e: { slug: string }) => e.slug));
  for (const asset of M2W4_ASSETS) {
    check(`${asset.editorialRef} not resolvable at /resources/${asset.slug}`,
      (await resolvePublishedContent(asset.slug)) === null);
    check(`${asset.editorialRef} absent from /resources index`, !listed.has(asset.slug));
    check(`${asset.editorialRef} absent from sitemap.xml`, !sitemap.has(asset.slug));
  }

  // ── Regression ───────────────────────────────────────────────────────────
  console.log('\n══ EVERY PRIOR ASSET UNCHANGED ══');
  const prior = await prisma.content_items.findMany({
    where: { editorial_ref: { notIn: REFS }, deleted_at: null, NOT: { editorial_ref: null } },
    select: { editorial_ref: true, status: true, current_revision_number: true },
    orderBy: { editorial_ref: 'asc' },
  });
  const tracked = prior.filter((r) => BASELINE[r.editorial_ref as string]);
  check('every baselined asset still present', tracked.length === Object.keys(BASELINE).length,
    `${tracked.length} of ${Object.keys(BASELINE).length}`);
  for (const row of tracked) {
    const ref = row.editorial_ref as string;
    check(`${ref} unchanged`,
      row.status === BASELINE[ref] && row.current_revision_number === BASELINE_REVISION[ref],
      `${row.status} rev=${row.current_revision_number}`);
  }
  const untracked = prior.filter((r) => !BASELINE[r.editorial_ref as string]).map((r) => r.editorial_ref);
  if (untracked.length) console.log(`  (not baselined, ignored: ${untracked.join(', ')})`);

  console.log(`\n══ ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ══`);
  await prisma.$disconnect();
  if (failures) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
