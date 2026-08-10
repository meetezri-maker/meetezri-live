/**
 * Diagnose the empty Author/Reviewer dropdowns and the Reviewed-on round trip. READ ONLY.
 *
 * The picker calls `GET /api/admin/users?page=1&limit=100`, which returns the 100 most recently
 * created profiles, and then filters for admin roles CLIENT-SIDE. If the admins were created
 * early and the user base has since grown past 100, none of them are in that window and the
 * dropdown is empty even though the profiles exist. This measures exactly that.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

const ADMIN_ROLES = ['super_admin', 'org_admin', 'team_admin'];

async function main() {
  console.log('═══ PROFILES ═══');
  const total = await prisma.profiles.count();
  console.log(`  total profiles: ${total}`);

  const byRole = await prisma.profiles.groupBy({ by: ['role'], _count: { _all: true } });
  for (const group of byRole) {
    console.log(`    role=${String(group.role ?? 'null').padEnd(14)} ${group._count._all}`);
  }

  console.log('\n═══ WHAT THE PICKER ACTUALLY RECEIVES ═══');
  // Exactly what `getAllUsers(1, 100)` returns: newest 100 by created_at.
  const page1 = await prisma.profiles.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    select: { id: true, full_name: true, role: true, created_at: true },
  });
  const adminsInPage = page1.filter((p) => ADMIN_ROLES.includes(String(p.role ?? '')));
  console.log(`  rows returned for page=1&limit=100 : ${page1.length}`);
  console.log(`  of those, admin-role rows          : ${adminsInPage.length}`);
  console.log(`  >>> dropdown options the UI builds : ${adminsInPage.length}`);

  console.log('\n═══ ALL ADMIN PROFILES AND THEIR POSITION ═══');
  const admins = await prisma.profiles.findMany({
    where: { role: { in: ADMIN_ROLES } },
    select: { id: true, full_name: true, role: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  for (const admin of admins) {
    const newer = await prisma.profiles.count({ where: { created_at: { gt: admin.created_at! } } });
    console.log(
      `  ${String(admin.role).padEnd(12)} ${String(admin.full_name).padEnd(22)} ` +
        `created=${admin.created_at?.toISOString().slice(0, 10)}  position=${newer + 1}` +
        `${newer + 1 > 100 ? '   <<< OUTSIDE THE 100-ROW WINDOW' : ''}`
    );
  }

  console.log('\n═══ CONTENT HUB AUTHOR / REVIEWER / REVIEWED_AT ═══');
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: ['W1-A001', 'W1-G001', 'W1-B001'] }, deleted_at: null },
    orderBy: { editorial_ref: 'asc' },
    select: {
      editorial_ref: true,
      author_id: true,
      reviewer_id: true,
      reviewed_at: true,
      updated_at: true,
    },
  });
  for (const row of rows) {
    console.log(
      `  ${row.editorial_ref}  author=${row.author_id ?? 'null'}  reviewer=${row.reviewer_id ?? 'null'}  ` +
        `reviewed_at=${row.reviewed_at ? row.reviewed_at.toISOString() : 'null'}`
    );
  }

  console.log('\n═══ COLUMN TYPES ═══');
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='content_items'
        AND column_name IN ('author_id','reviewer_id','reviewed_at')
      ORDER BY column_name`
  );
  for (const c of cols) {
    console.log(`  ${c.column_name.padEnd(14)} ${c.data_type.padEnd(28)} nullable=${c.is_nullable}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
