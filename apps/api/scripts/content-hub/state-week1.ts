/**
 * Week 1 — final state and public-visibility check. READ ONLY.
 *
 * Confirms what the three records actually are after import and submission, and proves they are
 * still invisible to the public read seam, the `/resources` index and the sitemap.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import {
  resolvePublishedContent,
  resolvePublishedList,
  resolveSitemapEntries,
} from '../../src/modules/content-hub/content-hub.read.service';
import { WEEK1_ASSETS } from '../../src/modules/content-hub/week1/week1-content';

const REFS = ['W1-A001', 'W1-G001', 'W1-B001'];

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
    orderBy: { editorial_ref: 'asc' },
    select: {
      id: true,
      editorial_ref: true,
      status: true,
      founder_approval: true,
      marketing_approval: true,
      seo_approval: true,
      author_id: true,
      reviewer_id: true,
      slug: true,
      word_count: true,
      reading_time_minutes: true,
      published_at: true,
    },
  });

  console.log('=== FINAL STATE ===');
  for (const row of rows) {
    const revisions = await prisma.content_revisions.count({ where: { content_id: row.id } });
    const links = await prisma.content_links.count({ where: { source_id: row.id } });
    console.log(
      `  ${row.editorial_ref}  status=${row.status}  revisions=${revisions}  links=${links}` +
        `  gates=[${row.founder_approval}/${row.marketing_approval}/${row.seo_approval}]` +
        `  author=${row.author_id ?? 'unresolved'}  published_at=${row.published_at ?? 'null'}`
    );
  }

  console.log('\n=== PUBLIC VISIBILITY (must be none) ===');
  for (const asset of WEEK1_ASSETS) {
    const detail = await resolvePublishedContent(asset.slug);
    console.log(`  /resources/${asset.slug}: ${detail ? 'VISIBLE — FAIL' : '404 — PASS'}`);
  }

  const list = await resolvePublishedList({ page: 1, pageSize: 24 });
  const sitemap = await resolveSitemapEntries();
  const inIndex = list.items.filter((i) => WEEK1_ASSETS.some((a) => a.slug === i.slug));
  const inSitemap = sitemap.filter((i) => WEEK1_ASSETS.some((a) => a.slug === i.slug));

  console.log(`  /resources index : ${inIndex.length === 0 ? 'excluded — PASS' : 'LEAKED — FAIL'} (${list.total} published item(s))`);
  console.log(`  /sitemap.xml     : ${inSitemap.length === 0 ? 'excluded — PASS' : 'LEAKED — FAIL'} (${sitemap.length} entr(ies))`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
