/**
 * Week 2 import preflight — READ ONLY.
 *
 * Confirms the target is the same live Supabase project Week 1 was imported into, reads the three
 * Week 1 records back untouched, and proves the three Week 2 editorial refs and their proposed
 * slugs do not already exist. Nothing here writes.
 *
 * Run:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/w2-preflight.ts
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

const W1_REFS = ['W1-A001', 'W1-G001', 'W1-B001'];
const W2_REFS = ['W2-A001', 'W2-G001', 'W2-B001'];
const W2_SLUGS = [
  'why-do-we-keep-things-to-ourselves',
  'why-do-people-keep-things-to-themselves',
  'questions-about-everyday-conversations',
];

/** Host, database and Supabase project ref only — never credentials. */
function describeTarget() {
  const raw = process.env.DATABASE_URL ?? '';
  const match = raw.match(/^\w+:\/\/([^:@/]+)(?::[^@]*)?@([^/?]+)\/([^?]*)/);
  if (!match) return { host: '(unparseable)', database: '(unknown)', project: '(unknown)' };
  const [, user, host, database] = match;
  const fromUser = user.includes('.') ? user.split('.').slice(1).join('.') : '';
  const fromHost = host.startsWith('db.') ? host.split('.')[1] : '';
  return { host, database, project: fromUser || fromHost || '(unknown)' };
}

async function main() {
  const target = describeTarget();
  console.log('=== TARGET ===');
  console.log('  host         :', target.host);
  console.log('  database     :', target.database);
  console.log('  supabase ref :', target.project);

  const week1 = await prisma.content_items.findMany({
    where: { editorial_ref: { in: W1_REFS } },
    select: {
      id: true,
      editorial_ref: true,
      slug: true,
      status: true,
      content_type: true,
      current_revision_number: true,
      published_at: true,
      updated_at: true,
      deleted_at: true,
    },
    orderBy: { editorial_ref: 'asc' },
  });

  console.log('\n=== WEEK 1 (read-only, must remain untouched) ===');
  for (const row of week1) {
    console.log(
      `  ${row.editorial_ref}  ${row.status.padEnd(10)} ${row.content_type.padEnd(12)}` +
        ` rev=${row.current_revision_number}  /resources/${row.slug}  updated=${row.updated_at.toISOString()}`,
    );
  }

  const week2 = await prisma.content_items.findMany({
    where: { editorial_ref: { in: W2_REFS } },
    select: { id: true, editorial_ref: true, slug: true, status: true, deleted_at: true },
  });
  console.log('\n=== WEEK 2 editorial refs already present ===');
  console.log('  count:', week2.length);
  for (const row of week2) {
    console.log(`  ${row.editorial_ref}  ${row.status}  ${row.slug}  deleted_at=${row.deleted_at}`);
  }

  const collisions = await prisma.content_items.findMany({
    where: { slug: { in: W2_SLUGS } },
    select: { id: true, slug: true, editorial_ref: true, status: true, deleted_at: true },
  });
  console.log('\n=== PROPOSED SLUG COLLISIONS ===');
  console.log('  count:', collisions.length);
  for (const row of collisions) {
    console.log(`  ${row.slug}  ref=${row.editorial_ref}  ${row.status}`);
  }

  const total = await prisma.content_items.count({ where: { deleted_at: null } });
  const published = await prisma.content_items.count({ where: { deleted_at: null, status: 'published' } });
  console.log('\n=== CORPUS ===');
  console.log('  live content_items :', total);
  console.log('  published          :', published);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
