import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.profiles.findMany({
    select: {
      id: true,
      email: true,
      role: true
    }
  });
  console.log('Current Profiles:', profiles);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
