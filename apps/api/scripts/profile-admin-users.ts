import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function profileAdminUsers() {
  console.log('Profiling Optimized getAllUsers Query...');
  
  // Warm up
  await prisma.profiles.findFirst();

  const page = 1;
  const limit = 50;
  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100);

  const startQuery = performance.now();
  
  const users = await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      created_at: true,
      updated_at: true,
      role: true,
      // Get session stats
      _count: {
        select: { 
          app_sessions: { 
            where: { ended_at: { not: null } } 
          } 
        }
      },
      app_sessions: {
        orderBy: { started_at: 'desc' },
        take: 1,
        select: { started_at: true }
      },
      // Get active subscription
      subscriptions: {
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { plan_type: true }
      },
      // Get organization
      org_members: {
        take: 1,
        select: {
          organizations: { select: { name: true } }
        }
      },
      // Get latest mood
      mood_entries: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { mood: true, intensity: true }
      }
    }
  });

  const endQuery = performance.now();
  console.log(`Query Time: ${(endQuery - startQuery).toFixed(2)}ms`);
  console.log(`Fetched ${users.length} users.`);
}

profileAdminUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
