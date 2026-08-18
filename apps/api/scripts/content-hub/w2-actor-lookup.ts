/**
 * Who can run the Week 2 import — READ ONLY.
 *
 * Lists the admin profiles eligible to be the import ACTOR (the person the audit log will
 * attribute the writes to), and shows who the Week 1 import used, so Week 2 can follow the same
 * precedent rather than inventing one.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

async function main() {
  const admins = await prisma.profiles.findMany({
    where: { role: { in: ['super_admin', 'org_admin'] } },
    select: { id: true, full_name: true, role: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });

  console.log('=== ELIGIBLE IMPORT ACTORS ===');
  for (const person of admins) {
    console.log(`  ${person.id}  ${person.role.padEnd(12)} ${person.full_name ?? '(no name)'}`);
  }

  const week1 = await prisma.content_items.findMany({
    where: { editorial_ref: { in: ['W1-A001', 'W1-G001', 'W1-B001'] } },
    select: { editorial_ref: true, created_by: true, author_id: true, reviewer_id: true },
    orderBy: { editorial_ref: 'asc' },
  });

  console.log('\n=== WEEK 1 PRECEDENT (created_by = the import actor) ===');
  for (const row of week1) {
    console.log(
      `  ${row.editorial_ref}  created_by=${row.created_by}  author_id=${row.author_id}  reviewer_id=${row.reviewer_id}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
