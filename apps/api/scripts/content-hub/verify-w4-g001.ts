/**
 * W4-G001 draft verification + Week 4 sibling regression — READ ONLY.
 *
 * `verify-week4.ts` was written when all three Week 4 assets were drafts. W4-B001 and W4-A001 have
 * since been approved and published, so its draft-and-invisible assertions no longer describe
 * reality for them. This checks what is actually true now:
 *
 *   - W4-G001 is a draft, complete, and invisible to every public surface;
 *   - W4-B001 and W4-A001 are untouched, still published, at the revision and timestamp they held
 *     before this ingestion.
 */

import 'dotenv/config';
import { validateContentBody, type ContentType } from '@meetezri/shared';
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

const SLUG = 'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time';
const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

/** Captured from the preflight run BEFORE W4-G001 was written. */
const SIBLING_BASELINE: Record<string, { status: string; rev: number; updated: string }> = {
  'W4-B001': { status: 'published', rev: 3, updated: '2026-08-29T09:19:38.811Z' },
  'W4-A001': { status: 'published', rev: 3, updated: '2026-09-01T09:04:05.656Z' },
};

let failures = 0;
function check(label: string, pass: boolean, detail = '') {
  if (!pass) failures += 1;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const row = await prisma.content_items.findFirstOrThrow({
    where: { editorial_ref: 'W4-G001', deleted_at: null },
  });

  console.log('═══ W4-G001 ═══');
  console.log(`  id     : ${row.id}`);
  console.log(`  title  : ${row.title}`);
  console.log(`  slug   : ${row.slug}`);
  console.log(`  words  : ${row.word_count}  reading_time=${row.reading_time_minutes}min`);

  const blocks = (row.body as { blocks?: Array<{ type?: string }> })?.blocks ?? [];
  const counts = new Map<string, number>();
  for (const b of blocks) counts.set(b.type ?? '?', (counts.get(b.type ?? '?') ?? 0) + 1);
  console.log(`  blocks : ${blocks.length} (${[...counts].map(([t, n]) => `${t}×${n}`).join(', ')})`);

  check('content_type is geo_article', row.content_type === 'geo_article');
  check('slug as derived', row.slug === SLUG);
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
  check('meta description null', row.meta_description === null);
  check('featured image unset', row.featured_image_url === null);
  check('canonical override unset', row.canonical_url_override === null);
  check('revisions 0', row.current_revision_number === 0, String(row.current_revision_number));
  check('block count is 234', blocks.length === 234, String(blocks.length));

  const tf = (row.type_fields ?? {}) as Record<string, unknown>;
  check('core_concept set', typeof tf.core_concept === 'string' && tf.core_concept.length > 0);
  check('citation_summary set', typeof tf.citation_summary === 'string' && tf.citation_summary.length > 0);
  check(
    'key_statements is a non-empty array',
    Array.isArray(tf.key_statements) && (tf.key_statements as unknown[]).length > 0,
    `${Array.isArray(tf.key_statements) ? (tf.key_statements as unknown[]).length : 0} item(s)`,
  );
  console.log(`     core_concept     : ${tf.core_concept}`);
  console.log(`     citation_summary : ${tf.citation_summary}`);
  for (const statement of (tf.key_statements as string[]) ?? []) console.log(`     key statement    : ${statement}`);

  const draft = validateContentBody(row.body, { contentType: row.content_type as ContentType });
  check('body passes draft validation', draft.errors.length === 0, `${draft.errors.length} error(s)`);

  const detail = await getContent(row.id);
  check('admin serializer + schema accept it', adminContentDetailSchema.safeParse(detail).success);

  const links = await getLinks(row.id);
  console.log(`\n  links stored: ${links.length}`);
  console.log(JSON.stringify(links, null, 2).split('\n').map((l) => `     ${l}`).join('\n'));

  const preview = await resolvePreviewContent(row.id);
  const html = preview ? renderResourceDetail({ origin: ORIGIN, detail: preview, assets: NO_ASSETS }) : '';
  const start = html.indexOf('<div class="sol-page">');
  const end = html.indexOf('<footer class="sol-site-footer">');
  const anchors = start === -1 ? [] : Array.from(
    html.slice(start, end === -1 ? undefined : end).matchAll(/<a\b[^>]*href="([^"]*)"/g),
  ).map((m) => m[1]);
  console.log(`\n  rendered anchors (non-fragment): ${anchors.filter((h) => !h.startsWith('#')).join(', ')}`);
  check('the Talk It Out CTA renders as a real anchor', anchors.includes('/how-it-works'));

  const checklist = await evaluateChecklist(prisma, row.id);
  console.log('\n  publish blockers:');
  for (const item of checklist.items.filter((i: { passed: boolean }) => !i.passed)) {
    console.log(`     - ${item.label}${item.details ? ` (${item.details})` : ''}`);
  }

  console.log('\n═══ PUBLIC INVISIBILITY (draft) ═══');
  check('not resolvable at /resources/:slug', (await resolvePublishedContent(SLUG)) === null);
  const list = await resolvePublishedList({ page: 1, pageSize: 50 } as never);
  check('absent from /resources index', !list.items.some((i: { slug: string }) => i.slug === SLUG));
  const sitemap = await resolveSitemapEntries();
  check('absent from sitemap.xml', !sitemap.some((e: { slug: string }) => e.slug === SLUG));

  console.log('\n═══ WEEK 4 SIBLINGS UNTOUCHED ═══');
  for (const [ref, expected] of Object.entries(SIBLING_BASELINE)) {
    const sibling = await prisma.content_items.findFirstOrThrow({ where: { editorial_ref: ref } });
    const updated = sibling.updated_at.toISOString();
    check(
      `${ref} unchanged`,
      sibling.status === expected.status &&
        sibling.current_revision_number === expected.rev &&
        updated === expected.updated,
      `${sibling.status} rev=${sibling.current_revision_number} updated=${updated}`,
    );
  }

  const dupes = await prisma.content_items.groupBy({
    by: ['editorial_ref'],
    where: { editorial_ref: { startsWith: 'W4-' }, deleted_at: null },
    _count: { editorial_ref: true },
  });
  for (const d of dupes) {
    check(`${d.editorial_ref} has exactly one row`, d._count.editorial_ref === 1, String(d._count.editorial_ref));
  }

  console.log(`\n═══ ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ═══`);
  await prisma.$disconnect();
  if (failures) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
