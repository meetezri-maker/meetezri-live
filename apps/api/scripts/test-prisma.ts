
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing getAllUsers query with ALL fields...');
    const users = await prisma.profiles.findMany({
      take: 1,
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        created_at: true,
        updated_at: true,
        role: true,
        subscriptions: {
          where: { status: 'active' },
          orderBy: { created_at: 'desc' },
          select: {
            plan_type: true
          },
          take: 1
        },
        _count: {
          select: {
            app_sessions: { where: { ended_at: { not: null } } }
          }
        },
        app_sessions: {
          orderBy: { started_at: 'desc' },
          take: 1,
          select: { started_at: true }
        },
        mood_entries: {
          orderBy: { created_at: 'desc' },
          select: {
            mood: true,
            intensity: true
          },
          take: 1
        },
        org_members: {
          include: {
            organizations: {
              select: { name: true }
            }
          }
        }
      }
    });
    console.log('Success!');
    // console.log(JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
