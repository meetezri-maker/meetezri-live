/**
 * W4-G001 preflight — READ ONLY.
 *
 * Derives the slug with the REAL `normaliseSlug`/`validateSlug` the Content Hub uses, checks it
 * against the length limit and against every existing row, and confirms the editorial ref is free.
 */

import 'dotenv/config';
import { CONTENT_LIMITS, normaliseSlug, validateSlug } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';

const TITLE = 'Small Steps Create Lasting Change: How Daily Habits Build Consistency Over Time';

async function main() {
  const slug = normaliseSlug(TITLE);
  const check = validateSlug(slug);

  console.log('=== SLUG DERIVATION ===');
  console.log(`  title  : ${TITLE}`);
  console.log(`  slug   : ${slug}`);
  console.log(`  length : ${slug.length} / ${CONTENT_LIMITS.maxSlugLength}`);
  console.log(`  valid  : ${check.valid}${check.valid ? '' : ` — ${check.reason}`}`);

  const clash = await prisma.content_items.findFirst({
    where: { slug, deleted_at: null },
    select: { id: true, editorial_ref: true, status: true },
  });
  console.log(`  collision : ${clash ? `YES — ${clash.editorial_ref} (${clash.status})` : 'none'}`);

  const existing = await prisma.content_items.findFirst({
    where: { editorial_ref: 'W4-G001' },
    select: { id: true, status: true, current_revision_number: true, deleted_at: true },
  });
  console.log(`\n=== W4-G001 EXISTS? ===`);
  console.log(`  ${existing ? `YES — ${existing.id} (${existing.status})` : 'no — safe to create'}`);

  console.log('\n=== WEEK 4 SIBLINGS (must not change) ===');
  const week4 = await prisma.content_items.findMany({
    where: { editorial_ref: { in: ['W4-B001', 'W4-A001'] } },
    select: { editorial_ref: true, id: true, status: true, updated_at: true, current_revision_number: true },
    orderBy: { editorial_ref: 'asc' },
  });
  for (const row of week4) {
    console.log(
      `  ${row.editorial_ref} ${row.status} rev=${row.current_revision_number} ` +
        `updated=${row.updated_at.toISOString()} ${row.id}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
