import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function profileBreakdown() {
  console.log('Profiling Breakdown...');
  
  // Warm up
  await prisma.profiles.findFirst();

  const page = 1;
  const limit = 50;
  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100);

  // 1. Base Query
  const startBase = performance.now();
  await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: { id: true }
  });
  console.log(`Base Query: ${(performance.now() - startBase).toFixed(2)}ms`);

  // 2. Base + Count
  const startCount = performance.now();
  await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      _count: {
        select: { 
          app_sessions: { 
            where: { ended_at: { not: null } } 
          } 
        }
      }
    }
  });
  console.log(`Base + Count: ${(performance.now() - startCount).toFixed(2)}ms`);

  // 3. Base + Latest Session
  const startSession = performance.now();
  await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      app_sessions: {
        orderBy: { started_at: 'desc' },
        take: 1,
        select: { started_at: true }
      }
    }
  });
  console.log(`Base + Latest Session: ${(performance.now() - startSession).toFixed(2)}ms`);

  // 4. Base + Subscription
  const startSub = performance.now();
  await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      subscriptions: {
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { plan_type: true }
      }
    }
  });
  console.log(`Base + Subscription: ${(performance.now() - startSub).toFixed(2)}ms`);

  // 5. Base + Org
  const startOrg = performance.now();
  await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      org_members: {
        take: 1,
        select: {
          organizations: { select: { name: true } }
        }
      }
    }
  });
  console.log(`Base + Org: ${(performance.now() - startOrg).toFixed(2)}ms`);

  // 6. Base + Mood
  const startMood = performance.now();
  await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      mood_entries: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { mood: true, intensity: true }
      }
    }
  });
  console.log(`Base + Mood: ${(performance.now() - startMood).toFixed(2)}ms`);
}

profileBreakdown()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
