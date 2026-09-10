/**
 * Week 4 regression proof — READ ONLY.
 *
 * Shows the full corpus with the fields that would move if anything had been written: status,
 * revision number, approval gates, publication timestamps and `updated_at`. Weeks 1-3 must be
 * byte-identical to their pre-import state, and W4-G001 must not exist at all.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { deleted_at: null },
    select: {
      editorial_ref: true,
      content_type: true,
      status: true,
      slug: true,
      current_revision_number: true,
      founder_approval: true,
      marketing_approval: true,
      seo_approval: true,
      first_published_at: true,
      published_at: true,
      updated_at: true,
      author_id: true,
      reviewer_id: true,
    },
    orderBy: [{ week: 'asc' }, { editorial_ref: 'asc' }],
  });

  console.log('═══ FULL CORPUS ═══\n');
  for (const row of rows) {
    console.log(
      `  ${(row.editorial_ref ?? '(none)').padEnd(9)} ${row.status.padEnd(10)} ` +
        `${row.content_type.padEnd(12)} rev=${row.current_revision_number} ` +
        `gates=${row.founder_approval[0]}/${row.marketing_approval[0]}/${row.seo_approval[0]} ` +
        `firstPub=${row.first_published_at ? row.first_published_at.toISOString().slice(0, 19) : 'null'} ` +
        `updated=${row.updated_at.toISOString().slice(0, 19)}`,
    );
  }

  // W4-G001 was deferred at first ingestion and created later, once its approved reader-facing
  // GEO article arrived. Exactly one row, and it must still be a draft.
  console.log('\n═══ W4-G001 ═══');
  const g001 = await prisma.content_items.findMany({
    where: { editorial_ref: 'W4-G001', deleted_at: null },
    select: { status: true },
  });
  const ok = g001.length === 1 && g001[0].status === 'draft';
  console.log(`  rows: ${g001.length}, status: ${g001[0]?.status ?? '(none)'} — ${ok ? 'PASS' : 'FAIL'}`);

  console.log('\n═══ WEEK 1-3 EXPECTED BASELINE ═══');
  const baseline: Record<string, string> = {
    'W1-A001': '2026-08-10T18:44:37',
    'W1-B001': '2026-08-10T19:12:39',
    'W1-G001': '2026-08-10T18:44:37',
  };
  let drift = 0;
  for (const [ref, expected] of Object.entries(baseline)) {
    const row = rows.find((r) => r.editorial_ref === ref);
    const actual = row?.updated_at.toISOString().slice(0, 19) ?? '(missing)';
    const ok = actual === expected;
    if (!ok) drift += 1;
    console.log(`  ${ref}: updated_at ${actual} ${ok ? '— unchanged' : `— DRIFTED (expected ${expected})`}`);
  }

  // Weeks 2 and 3 have no frozen timestamp to compare against here, so assert the property that
  // matters instead: this import must not have moved them out of `published`.
  const w23 = rows.filter((r) => (r.editorial_ref ?? '').startsWith('W2-') || (r.editorial_ref ?? '').startsWith('W3-'));
  const notPublished = w23.filter((r) => r.status !== 'published');
  console.log(`\n  Week 2/3 rows: ${w23.length}, not published: ${notPublished.length}`);
  for (const row of notPublished) console.log(`    ${row.editorial_ref} is ${row.status}`);

  console.log(`\n${drift === 0 ? 'WEEK 1 UNTOUCHED' : `${drift} WEEK 1 ROW(S) DRIFTED`}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
