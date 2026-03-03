
import { PrismaClient } from '@prisma/client';
import { toggleSessionFavorite, createSession, getSessionById } from '../src/modules/sessions/sessions.service';
import { createHabit, logHabitCompletion, getHabits } from '../src/modules/habits/habits.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting debug persistence...');
  
  try {
    // 1. Setup User
    const profile = await prisma.profiles.findFirst();
    if (!profile) {
      console.error('No profile found');
      return;
    }
    console.log(`Using profile: ${profile.id}`);

    // 2. Debug Session Favorite
    console.log('\n--- Debugging Session Favorite ---');
    const session = await createSession(profile.id, {
      type: 'instant',
      duration_minutes: 5,
    });
    console.log(`Created session: ${session.id}, is_favorite: ${session.is_favorite}`);

    const toggled = await toggleSessionFavorite(profile.id, session.id);
    console.log(`Toggled session: ${toggled.id}, is_favorite: ${toggled.is_favorite}`);

    const fetched = await getSessionById(profile.id, session.id);
    console.log(`Fetched session: ${fetched?.id}, is_favorite: ${fetched?.is_favorite}`);

    if (fetched?.is_favorite === true) {
      console.log('✅ Session persistence WORKS at Service layer');
    } else {
      console.error('❌ Session persistence FAILS at Service layer');
    }

    // 3. Debug Habit Persistence
    console.log('\n--- Debugging Habit Persistence ---');
    const habit = await createHabit(profile.id, {
      name: 'Debug Habit ' + Date.now(),
      frequency: 'daily'
    });
    console.log(`Created habit: ${habit.id}`);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const completedAt = new Date(todayStr).toISOString(); // UTC Midnight
    console.log(`Logging completion for: ${completedAt}`);

    await logHabitCompletion(profile.id, habit.id, {
      completed_at: completedAt
    });

    const habits = await getHabits(profile.id);
    const myHabit = habits.find(h => h.id === habit.id);
    const logs = myHabit?.habit_logs || [];
    
    console.log(`Fetched habit logs count: ${logs.length}`);
    if (logs.length > 0) {
      console.log(`Log 0 completed_at: ${logs[0].completed_at.toISOString()}`);
      // Compare only YYYY-MM-DD
      if (logs[0].completed_at.toISOString().startsWith(todayStr)) {
         console.log('✅ Habit log persistence WORKS at Service layer (Date Match)');
      } else {
         console.log('⚠️ Habit log persistence WORKS but dates might differ (Timezone?)');
      }
    } else {
      console.error('❌ Habit log persistence FAILS at Service layer');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
