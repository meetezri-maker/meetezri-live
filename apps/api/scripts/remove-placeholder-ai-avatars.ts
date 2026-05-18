/**
 * One-off cleanup: remove junk AI avatar rows (e.g. name "test") from `ai_avatars`.
 * Run from apps/api: pnpm run db:remove-placeholder-avatars
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isPlaceholderName(name: string): boolean {
  const t = name.trim().toLowerCase();
  if (!t) return true;
  if (["test", "dummy", "placeholder", "demo", "sample"].includes(t)) return true;
  if (/^test\s*\d*$/i.test(t)) return true;
  return false;
}

async function main() {
  const rows = await prisma.ai_avatars.findMany({ select: { id: true, name: true } });
  const ids = rows.filter((r) => isPlaceholderName(r.name)).map((r) => r.id);
  if (ids.length === 0) {
    console.log("No placeholder AI avatars to remove.");
    return;
  }
  const result = await prisma.ai_avatars.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${result.count} placeholder row(s):`, ids.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
