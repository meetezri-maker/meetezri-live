/** READ ONLY — lists admin profiles so the Week 4 import has an attributable actor. */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

async function main() {
  const rows = await prisma.profiles.findMany({
    where: { role: { in: ['super_admin', 'admin'] } },
    select: { id: true, full_name: true, role: true },
    take: 5,
  });
  for (const r of rows) console.log(r.role, r.id, r.full_name ?? '(no name)');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
