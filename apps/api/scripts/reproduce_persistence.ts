
import { PrismaClient } from '@prisma/client';
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const API_URL = 'http://localhost:3001/api';
// Using the secret from verify-endpoints.ts
const JWT_SECRET_B64 = 'BNf04hL8JjnrbSHH7nHn1cYBVA2Dh6ahgaljbJKXSd7+5qTEu7EL/7AvexZ0iz+5Ql/CgLRH7nql2Y1rcIYuhA==';
const JWT_SECRET = Buffer.from(JWT_SECRET_B64, 'base64');

async function main() {
  console.log('Starting persistence verification...');

  try {
    // 1. Get a user profile
    const profile = await prisma.profiles.findFirst();
    if (!profile) {
      console.error('No profiles found. Run seed first.');
      return;
    }
    const userId = profile.id;
    console.log(`Using user: ${userId}`);

    // 2. Generate Token
    const payload = {
      sub: userId,
      email: 'test@example.com',
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + (60 * 60)
    };

    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // --- SESSIONS PERSISTENCE ---
    console.log('\n--- Testing Session Persistence ---');
    // Create session
    const sessionRes = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'instant', duration_minutes: 5 })
    });
    
    if (!sessionRes.ok) throw new Error(`Failed to create session: ${await sessionRes.text()}`);
    const session = await sessionRes.json();
    console.log(`Created session: ${session.id}`);

    // Toggle Favorite ON
    console.log('Toggling favorite ON...');
    await fetch(`${API_URL}/sessions/${session.id}/favorite`, { method: 'POST', headers });

    // Verify persistence via GET /sessions
    console.log('Fetching sessions list...');
    const listRes = await fetch(`${API_URL}/sessions`, { headers });
    const sessions = await listRes.json();
    const mySession = sessions.find((s: any) => s.id === session.id);
    
    if (mySession && mySession.is_favorite === true) {
      console.log('✅ Session favorite persisted correctly (is_favorite: true)');
    } else {
      console.error('❌ Session favorite FAILED to persist', mySession);
    }

    // Toggle Favorite OFF
    console.log('Toggling favorite OFF...');
    await fetch(`${API_URL}/sessions/${session.id}/favorite`, { method: 'POST', headers });

    // Verify persistence
    const listRes2 = await fetch(`${API_URL}/sessions`, { headers });
    const sessions2 = await listRes2.json();
    const mySession2 = sessions2.find((s: any) => s.id === session.id);

    if (mySession2 && mySession2.is_favorite === false) {
      console.log('✅ Session favorite persisted correctly (is_favorite: false)');
    } else {
      console.error('❌ Session favorite FAILED to persist OFF', mySession2);
    }

    // --- HABITS PERSISTENCE ---
    console.log('\n--- Testing Habit Persistence ---');
    // Create habit
    const habitRes = await fetch(`${API_URL}/habits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Persistence Test Habit', frequency: 'daily' })
    });
    if (!habitRes.ok) throw new Error(`Failed to create habit: ${await habitRes.text()}`);
    const habit = await habitRes.json();
    console.log(`Created habit: ${habit.id}`);

    // Complete for TODAY (mimic frontend)
    // Frontend sends: format(targetDate, 'yyyy-MM-dd') -> ISO string
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // "yyyy-MM-dd"
    const isoDate = new Date(dateStr).toISOString(); // "yyyy-MM-ddT00:00:00.000Z"
    
    console.log(`Completing habit for date: ${dateStr} (ISO: ${isoDate})`);
    
    const completeRes = await fetch(`${API_URL}/habits/${habit.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ completed_at: isoDate })
    });
    if (!completeRes.ok) console.error(`Failed to complete: ${await completeRes.text()}`);

    // Verify persistence via GET /habits
    console.log('Fetching habits list...');
    const habitsRes = await fetch(`${API_URL}/habits`, { headers });
    const habits = await habitsRes.json();
    const myHabit = habits.find((h: any) => h.id === habit.id);
    
    // Check logs
    const logs = myHabit.habit_logs || [];
    console.log(`Found ${logs.length} logs for habit.`);
    
    const hasLog = logs.some((log: any) => log.completed_at.startsWith(dateStr));
    if (hasLog) {
      console.log(`✅ Habit completion persisted correctly for ${dateStr}`);
    } else {
      console.error(`❌ Habit completion FAILED to persist for ${dateStr}`);
      console.log('Logs:', logs);
    }

    // Clean up
    await fetch(`${API_URL}/sessions/${session.id}/end`, { 
        method: 'POST', 
        headers,
        body: JSON.stringify({ duration_seconds: 60 }) 
    });
    await fetch(`${API_URL}/habits/${habit.id}`, { method: 'DELETE', headers });

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
