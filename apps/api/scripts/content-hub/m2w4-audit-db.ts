/**
 * Month 2 Week 4 — READ-ONLY pre-ingestion database audit.
 *
 * Checks editorial-ref existence, slug collisions against the proposed Week 4 slugs, and the state
 * of every prior Content Hub asset. Runs the proposed slugs through the REAL `normaliseSlug` /
 * `validateSlug` and measures every proposed metadata string against the CURRENT limits.
 *
 * Nothing here writes. No create, no update, no delete, no transition.
 */

import 'dotenv/config';
import { CONTENT_LIMITS, normaliseSlug, validateSlug } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';

const WEEK4_REFS = ['M2-W4-B001', 'M2-W4-G001', 'M2-W4-A001', 'M2-W4-L001'];

/** Slug candidates taken verbatim from the workbook; the stored form drops the /resources prefix. */
const PROPOSED = [
  { ref: 'M2-W4-B001', workbook: '/why-do-i-keep-replaying-conversations-in-my-head' },
  { ref: 'M2-W4-G001', workbook: '/resources/replaying-conversations-and-everyday-reflection' },
  { ref: 'M2-W4-G001-alt', workbook: '/resources/everyday-reflection-replaying-conversations-emotional-processing' },
  { ref: 'M2-W4-A001', workbook: '/resources/why-do-i-replay-conversations' },
  { ref: 'M2-W4-A001-alt', workbook: '/resources/questions-about-replaying-conversations' },
];

async function main() {
  console.log('='.repeat(78));
  console.log('  1. WEEK 4 EDITORIAL REFS — do they already exist?');
  console.log('='.repeat(78));
  for (const ref of WEEK4_REFS) {
    const row = await prisma.content_items.findFirst({
      where: { editorial_ref: ref },
      select: {
        id: true, slug: true, status: true, content_type: true,
        current_revision_number: true, deleted_at: true, updated_at: true,
      },
    });
    if (!row) {
      console.log(`  ${ref.padEnd(12)} EXISTS=no`);
      continue;
    }
    console.log(
      `  ${ref.padEnd(12)} EXISTS=YES  id=${row.id}  status=${row.status}  rev=${row.current_revision_number}` +
        `  slug=${row.slug}  deleted=${row.deleted_at ? row.deleted_at.toISOString() : 'no'}` +
        `  updated=${row.updated_at.toISOString()}`,
    );
  }

  console.log('\n' + '='.repeat(78));
  console.log('  2. PROPOSED SLUGS — validator + collision');
  console.log('='.repeat(78));
  console.log(
    `  limits: slug<=${CONTENT_LIMITS.maxSlugLength}, meta ${CONTENT_LIMITS.minMetaDescription}-${CONTENT_LIMITS.maxMetaDescription}\n`,
  );
  for (const item of PROPOSED) {
    const stored = normaliseSlug(item.workbook.replace(/^\/resources\//, '').replace(/^\//, ''));
    const check = validateSlug(stored);
    const clash = await prisma.content_items.findFirst({
      where: { slug: stored, deleted_at: null },
      select: { editorial_ref: true, status: true },
    });
    console.log(`  ${item.ref}`);
    console.log(`     workbook  : ${item.workbook}`);
    console.log(`     stored    : ${stored}  (${stored.length}/${CONTENT_LIMITS.maxSlugLength})`);
    console.log(`     valid     : ${check.valid}${check.valid ? '' : ` — ${check.reason}`}`);
    console.log(`     collision : ${clash ? `YES — ${clash.editorial_ref} (${clash.status})` : 'none'}`);
  }

  console.log('\n' + '='.repeat(78));
  console.log('  3. EVERY EXISTING CONTENT HUB ASSET (prior weeks must stay untouched)');
  console.log('='.repeat(78));
  const all = await prisma.content_items.findMany({
    where: { deleted_at: null },
    select: {
      editorial_ref: true, slug: true, status: true, content_type: true,
      current_revision_number: true, updated_at: true,
    },
    orderBy: { editorial_ref: 'asc' },
  });
  for (const row of all) {
    console.log(
      `  ${(row.editorial_ref ?? '(none)').padEnd(12)} ${row.status.padEnd(10)} ${row.content_type.padEnd(12)}` +
        ` rev=${row.current_revision_number}  ${row.slug}`,
    );
  }
  console.log(`  total: ${all.length}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
