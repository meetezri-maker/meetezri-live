/**
 * Month 2 Week 1 preflight — READ ONLY.
 *
 * Confirms the target project, reports the state of the three M2-W1 editorial refs, derives and
 * validates the proposed slugs with the REAL Content Hub slug rules, and checks every slug against
 * existing rows. Nothing here writes.
 */

import 'dotenv/config';
import { CONTENT_LIMITS, normaliseSlug, validateSlug } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';

const REFS = ['M2-W1-B001', 'M2-W1-G001', 'M2-W1-A001'];

/** Slug the workbook asks for, plus the two derived from the approved titles. */
const CANDIDATES: Array<[string, string]> = [
  ['M2-W1-B001 (workbook-supplied)', 'manage-everyday-stress-before-overwhelm'],
  ['M2-W1-G001 (derived from title)', 'Why Everyday Stress Can Build Quietly Before It Feels Overwhelming'],
  [
    'M2-W1-A001 (derived from title)',
    'Everyday Stress, Mental Load & Emotional Resilience: Direct Answers to Common Questions',
  ],
];

function describeTarget() {
  const raw = process.env.DATABASE_URL ?? '';
  const match = raw.match(/^\w+:\/\/([^:@/]+)(?::[^@]*)?@([^/?]+)\/([^?]*)/);
  if (!match) return { host: '(unparseable)', project: '(unknown)' };
  const [, user, host] = match;
  return { host, project: user.includes('.') ? user.split('.').slice(1).join('.') : '(unknown)' };
}

async function main() {
  const target = describeTarget();
  console.log('=== TARGET ===');
  console.log(`  host         : ${target.host}`);
  console.log(`  supabase ref : ${target.project}`);

  console.log('\n=== M2-W1 EDITORIAL REFS ===');
  for (const ref of REFS) {
    const row = await prisma.content_items.findFirst({
      where: { editorial_ref: ref },
      select: {
        id: true,
        status: true,
        slug: true,
        current_revision_number: true,
        deleted_at: true,
        scheduled_for: true,
      },
    });
    console.log(
      row
        ? `  ${ref}: EXISTS — ${row.status}, rev=${row.current_revision_number}, slug=${row.slug}` +
            `${row.scheduled_for ? `, scheduled=${row.scheduled_for.toISOString()}` : ''}` +
            `${row.deleted_at ? ', SOFT-DELETED' : ''}`
        : `  ${ref}: absent`,
    );
  }

  console.log('\n=== SLUGS ===');
  for (const [label, input] of CANDIDATES) {
    const slug = normaliseSlug(input);
    const check = validateSlug(slug);
    const clash = await prisma.content_items.findFirst({
      where: { slug, deleted_at: null },
      select: { editorial_ref: true, status: true },
    });
    console.log(`  ${label}`);
    console.log(`     slug      : ${slug}`);
    console.log(
      `     length    : ${slug.length} / ${CONTENT_LIMITS.maxSlugLength}` +
        `${slug.length > CONTENT_LIMITS.maxSlugLength ? '  ← OVER LIMIT' : ''}`,
    );
    console.log(`     valid     : ${check.valid}${check.valid ? '' : ` — ${check.reason}`}`);
    console.log(`     collision : ${clash ? `YES — ${clash.editorial_ref} (${clash.status})` : 'none'}`);
  }

  console.log('\n=== CORPUS (Month 1, must remain untouched) ===');
  const corpus = await prisma.content_items.findMany({
    where: { deleted_at: null },
    select: { editorial_ref: true, status: true, content_type: true, updated_at: true },
    orderBy: [{ week: 'asc' }, { editorial_ref: 'asc' }],
  });
  for (const row of corpus) {
    console.log(
      `  ${(row.editorial_ref ?? '(none)').padEnd(11)} ${row.status.padEnd(10)} ${row.content_type.padEnd(12)} ` +
        `updated=${row.updated_at.toISOString()}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
