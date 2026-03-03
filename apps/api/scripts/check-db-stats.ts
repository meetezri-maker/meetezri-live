import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDbStats() {
  console.log('Checking DB Stats...');
  
  const startCount = performance.now();
  const count = await prisma.profiles.count();
  console.log(`Profiles Count: ${count} (took ${(performance.now() - startCount).toFixed(2)}ms)`);

  const startSimple = performance.now();
  const users = await prisma.profiles.findMany({
    take: 1,
    select: { id: true }
  });
  console.log(`Simple Query (1 user): ${(performance.now() - startSimple).toFixed(2)}ms`);
  
  const start50 = performance.now();
  const users50 = await prisma.profiles.findMany({
    take: 50,
    select: { id: true }
  });
  console.log(`Simple Query (50 users): ${(performance.now() - start50).toFixed(2)}ms`);
}

checkDbStats()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
