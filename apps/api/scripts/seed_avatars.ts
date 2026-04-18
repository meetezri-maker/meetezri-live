/**
 * Inserts the four canonical companions into `public.ai_avatars`.
 * Replaces all existing rows (deleteMany) — use only when that is acceptable.
 *
 * Run from repo root or `apps/api` (DATABASE_URL must point at your Postgres):
 *   pnpm --filter @meetezri/api run db:seed-avatars
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_AI_COMPANIONS } from "@meetezri/shared";

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AI Avatars (canonical defaults from @meetezri/shared)...');

  await prisma.ai_avatars.deleteMany({});
  console.log('Cleared existing avatars.');

  for (const c of DEFAULT_AI_COMPANIONS) {
    await prisma.ai_avatars.create({
      data: {
        name: c.name,
        gender: c.gender,
        age_range: c.age_range,
        personality: c.personality,
        specialties: [...c.specialties],
        description: c.description,
        image_url: null,
        voice_type: c.voice_type,
        accent_type: c.accent_type,
        rating: c.rating,
        is_active: true,
      },
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
