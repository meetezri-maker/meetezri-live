/**
 * Month 2 Week 1 read-back verification — READ ONLY.
 *
 * Reads all three records back through the real service/API boundary, runs the real publish
 * checklist, separates HARD (blocking) failures from optional admin fields, audits every link
 * through stored -> serialized -> rendered, and proves the drafts are invisible publicly and that
 * Month 1 is untouched.
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
import { M2W1_ASSETS, EXPECTED_CONTENT_EDGES } from '../../src/modules/content-hub/month2week1/m2w1-content';

const REFS = ['M2-W1-B001', 'M2-W1-G001', 'M2-W1-A001'];
const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

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

  check('all three records exist', rows.length === 3, `found ${rows.length}`);

  for (const asset of M2W1_ASSETS) {
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
    console.log(`   type          : ${row.content_type}   status: ${row.status}`);
    console.log(`   blocks        : ${blocks.length} (${[...counts].map(([t, n]) => `${t}×${n}`).join(', ')})`);
    console.log(`   words         : ${row.word_count}   reading_time=${row.reading_time_minutes}min`);
    console.log(`   meta          : ${row.meta_description ? `${row.meta_description.length} chars` : 'NULL'}`);
    console.log(`   faq items     : ${faq?.items?.length ?? 0}`);
    console.log(`   featured image: ${row.featured_image_url ?? 'none'}`);

    check('editorial_ref matches', row.editorial_ref === asset.editorialRef);
    check('slug matches the plan', row.slug === asset.slug, row.slug);
    check('title matches the plan', row.title === asset.title);
    check('content_type matches', row.content_type === asset.contentType);
    check('status is draft', row.status === 'draft', row.status);
    check('published_at null', row.published_at === null);
    check('first_published_at null', row.first_published_at === null);
    check('scheduled_for null', row.scheduled_for === null);
    check(
      'gates pending',
      row.founder_approval === 'pending' && row.marketing_approval === 'pending' && row.seo_approval === 'pending',
    );
    check('author unset', row.author_id === null);
    check('reviewer unset', row.reviewer_id === null);
    check('revisions 0', row.current_revision_number === 0);
    check('block count matches mapping', blocks.length === asset.body.blocks.length,
      `${blocks.length} vs ${asset.body.blocks.length}`);

    if (row.content_type === 'aeo_answer') {
      check('direct_answer present and first', blocks[0]?.type === 'direct_answer',
        String(blocks[0]?.type));
      check('exactly one direct_answer', (counts.get('direct_answer') ?? 0) === 1);
    }
    if (row.content_type === 'geo_article') {
      const tf = (row.type_fields ?? {}) as Record<string, unknown>;
      check('core_concept present', typeof tf.core_concept === 'string' && tf.core_concept.length > 0);
      check('citation_summary present', typeof tf.citation_summary === 'string' && tf.citation_summary.length > 0);
      check('key_statements is an array', Array.isArray(tf.key_statements));
      check('key_statements has 7 items', (tf.key_statements as unknown[])?.length === 7,
        String((tf.key_statements as unknown[])?.length));
      console.log(`   geo_statement blocks: ${counts.get('geo_statement') ?? 0}`);
    }

    const draft = validateContentBody(row.body, { contentType: row.content_type as ContentType });
    check('body passes draft validation', draft.errors.length === 0, `${draft.errors.length} error(s)`);
    check('admin serializer + schema accept it', adminContentDetailSchema.safeParse(await getContent(row.id)).success);

    // Blocking vs optional, from the checklist's own `blocking` flag.
    const checklist = await evaluateChecklist(prisma, row.id);
    const unmet = checklist.items.filter((i: { passed: boolean }) => !i.passed);
    const hard = unmet.filter((i: { blocking: boolean }) => i.blocking);
    const optional = unmet.filter((i: { blocking: boolean }) => !i.blocking);
    console.log(`   HARD publish blockers (${hard.length}):`);
    for (const i of hard) console.log(`      - ${i.label}${i.details ? ` (${i.details})` : ''}`);
    console.log(`   optional/admin fields (${optional.length}):`);
    for (const i of optional) console.log(`      - ${i.label}`);
  }

  // ── Links ────────────────────────────────────────────────────────────────
  console.log('\n══ LINK AUDIT: stored → serialized → rendered ══');
  for (const asset of M2W1_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    if (!row) continue;
    const stored = await getLinks(row.id);
    const preview = await resolvePreviewContent(row.id);
    const html = preview ? renderResourceDetail({ origin: ORIGIN, detail: preview, assets: NO_ASSETS }) : '';
    const anchors = pageAnchors(html);

    console.log(`\n  ${asset.editorialRef}: stored=${stored.length} serialized=${preview?.links.length ?? 0}`);
    for (const spec of asset.links) {
      const href =
        spec.targetKind === 'content'
          ? `/resources/${byRef.get(spec.targetRef ?? '')?.slug ?? '?'}`
          : ROUTE_REGISTRY[spec.targetRoute as keyof typeof ROUTE_REGISTRY]?.href ?? '?';
      const inDb = stored.some((l: { targetRoute?: string | null; targetContentId?: string | null }) =>
        spec.targetKind === 'route'
          ? l.targetRoute === spec.targetRoute
          : idToRef.get(l.targetContentId ?? '') === spec.targetRef);
      const serialized = preview?.links.some((l) => l.href === href) ?? false;
      const rendered = anchors.includes(href);
      const what = spec.targetKind === 'content' ? `content:${spec.targetRef}` : `route:${spec.targetRoute}`;
      console.log(`     ${what.padEnd(26)} DB=${inDb ? 'yes' : 'NO '} API=${serialized ? 'yes' : 'NO '} ` +
        `HTML=${rendered ? 'yes' : 'NO '}  → ${href}`);
    }
    const inline = anchors.filter((h) => h === '/how-it-works').length;
    console.log(`     /how-it-works anchors in rendered HTML: ${inline}`);
  }

  console.log('\n  cluster edges:');
  for (const [from, to] of EXPECTED_CONTENT_EDGES) {
    const src = byRef.get(from);
    const dst = byRef.get(to);
    const n = src && dst
      ? await prisma.content_links.count({
          where: { source_id: src.id, target_content_id: dst.id, relation: 'related_content' },
        })
      : 0;
    check(`${from} → ${to} stored`, n === 1, `${n} row(s)`);
  }

  // ── Public invisibility ──────────────────────────────────────────────────
  console.log('\n══ PUBLIC INVISIBILITY (drafts) ══');
  const list = await resolvePublishedList({ page: 1, pageSize: 100 } as never);
  const listed = new Set(list.items.map((i: { slug: string }) => i.slug));
  const sitemap = new Set((await resolveSitemapEntries()).map((e: { slug: string }) => e.slug));
  for (const asset of M2W1_ASSETS) {
    check(`${asset.editorialRef} not resolvable at /resources/${asset.slug}`,
      (await resolvePublishedContent(asset.slug)) === null);
    check(`${asset.editorialRef} absent from /resources index`, !listed.has(asset.slug));
    check(`${asset.editorialRef} absent from sitemap.xml`, !sitemap.has(asset.slug));
  }

  // ── Month 1 regression ───────────────────────────────────────────────────
  console.log('\n══ MONTH 1 UNCHANGED ══');
  const month1 = await prisma.content_items.findMany({
    where: { editorial_ref: { startsWith: 'W' } },
    select: { editorial_ref: true, status: true, current_revision_number: true, updated_at: true },
    orderBy: { editorial_ref: 'asc' },
  });
  const BASELINE: Record<string, string> = {
    'W1-A001': '2026-08-10T18:44:37.045Z', 'W1-B001': '2026-08-10T19:12:39.148Z',
    'W1-G001': '2026-08-10T18:44:37.045Z', 'W2-A001': '2026-08-18T18:47:08.833Z',
    'W2-B001': '2026-08-18T18:47:08.833Z', 'W2-G001': '2026-08-18T18:47:08.833Z',
    'W3-A001': '2026-08-27T20:25:37.650Z', 'W3-B001': '2026-08-24T20:10:22.110Z',
    'W3-G001': '2026-08-24T21:03:25.901Z', 'W4-A001': '2026-09-01T09:04:05.656Z',
    'W4-B001': '2026-08-29T09:19:38.811Z', 'W4-G001': '2026-09-03T19:54:15.271Z',
  };
  for (const row of month1) {
    const expected = BASELINE[row.editorial_ref as string];
    if (!expected) continue;
    check(`${row.editorial_ref} unchanged`, row.updated_at.toISOString() === expected && row.status === 'published',
      `${row.status} updated=${row.updated_at.toISOString()}`);
  }

  console.log(`\n══ ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ══`);
  await prisma.$disconnect();
  if (failures) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
