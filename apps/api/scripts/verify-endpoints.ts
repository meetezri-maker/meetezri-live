
import { PrismaClient } from '@prisma/client';
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const API_URL = 'http://localhost:3001/api';
const JWT_SECRET_B64 = 'BNf04hL8JjnrbSHH7nHn1cYBVA2Dh6ahgaljbJKXSd7+5qTEu7EL/7AvexZ0iz+5Ql/CgLRH7nql2Y1rcIYuhA==';
const JWT_SECRET = Buffer.from(JWT_SECRET_B64, 'base64');

async function main() {
  console.log('Starting verification...');

  try {
    // 1. Get a user profile
    const profile = await prisma.profiles.findFirst();
    if (!profile) {
      console.error('No profiles found in database. Please seed profiles first.');
      return;
    }
    const userId = profile.id;
    const email = 'test@example.com'; // We don't need real email for JWT validation usually, or we can fetch from users if needed.
    console.log(`Using user: ${userId}`);

    // 2. Generate Token
    const payload = {
      sub: userId,
      email: email,
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };

    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 3. Test Wellness Favorite
    console.log('\n--- Testing Wellness Favorite ---');
    const wellnessToolsRes = await fetch(`${API_URL}/wellness`, { headers });
    if (wellnessToolsRes.ok) {
        const wellnessTools = await wellnessToolsRes.json();
        if (Array.isArray(wellnessTools) && wellnessTools.length > 0) {
        const toolId = wellnessTools[0].id;
        console.log(`Toggling favorite for wellness tool: ${toolId}`);
        const toggleRes = await fetch(`${API_URL}/wellness/${toolId}/favorite`, {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });
        console.log(`Status: ${toggleRes.status}`);
        const toggleData = await toggleRes.json();
        console.log('Response:', toggleData);
        } else {
        console.log('No wellness tools found to test.');
        }
    } else {
        console.log(`Failed to fetch wellness tools: ${wellnessToolsRes.status}`);
    }

    // 4. Test Journal Favorite
    console.log('\n--- Testing Journal Favorite ---');
    // Create a dummy journal entry first
    const createJournalRes = await fetch(`${API_URL}/journal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Test Entry', content: 'Testing favorites', mood: 'Neutral' })
    });
    
    if (createJournalRes.ok) {
        const journalEntry = await createJournalRes.json();
        if (journalEntry.id) {
            console.log(`Created journal entry: ${journalEntry.id}`);
            console.log(`Toggling favorite for journal entry: ${journalEntry.id}`);
            const toggleRes = await fetch(`${API_URL}/journal/${journalEntry.id}/favorite`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            console.log(`Status: ${toggleRes.status}`);
            const toggleData = await toggleRes.json();
            console.log('Response:', toggleData);
            
            // Cleanup
            await fetch(`${API_URL}/journal/${journalEntry.id}`, { method: 'DELETE', headers });
        }
    } else {
        console.log(`Failed to create journal entry: ${createJournalRes.status} ${await createJournalRes.text()}`);
    }

    // 5. Test Session Favorite
    console.log('\n--- Testing Session Favorite ---');
    // Create a dummy session
    // Note: sessions/ route expects specific body. Let's try to find an existing one or create one correctly.
    // Based on schemas, it needs type, duration_minutes.
    const createSessionRes = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'instant', duration_minutes: 5 })
    });
    
    if (createSessionRes.ok) {
        const session = await createSessionRes.json();
        if (session.id) {
            console.log(`Created session: ${session.id}`);
            console.log(`Toggling favorite for session: ${session.id}`);
            const toggleRes = await fetch(`${API_URL}/sessions/${session.id}/favorite`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            console.log(`Status: ${toggleRes.status}`);
            const toggleData = await toggleRes.json();
            console.log('Response:', toggleData);
        }
    } else {
        console.log(`Failed to create session: ${createSessionRes.status} ${await createSessionRes.text()}`);
    }

    // 6. Test Habit Check/Uncheck
    console.log('\n--- Testing Habit Tracker ---');
    // Create a habit
    const createHabitRes = await fetch(`${API_URL}/habits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Habit', frequency: 'daily' })
    });
    
    if (createHabitRes.ok) {
        const habit = await createHabitRes.json();
        if (habit.id) {
            console.log(`Created habit: ${habit.id}`);
            
            // Complete for today
            const today = new Date().toISOString().split('T')[0];
            console.log(`Completing habit for date: ${today}`);
            const completeRes = await fetch(`${API_URL}/habits/${habit.id}/complete`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ completed_at: new Date().toISOString() })
            });
            console.log(`Complete Status: ${completeRes.status}`);
            console.log('Complete Response:', await completeRes.json());

            // Uncomplete
            console.log(`Uncompleting habit for date: ${today}`);
            const uncompleteRes = await fetch(`${API_URL}/habits/${habit.id}/complete?date=${today}`, {
                method: 'DELETE',
                headers
            });
            console.log(`Uncomplete Status: ${uncompleteRes.status}`);
            // Note: DELETE usually returns 200 or 204.
            if (uncompleteRes.status === 204) {
                 console.log('Uncomplete Response: 204 No Content');
            } else {
                 console.log('Uncomplete Response:', await uncompleteRes.json());
            }

            // Cleanup
            await fetch(`${API_URL}/habits/${habit.id}`, { method: 'DELETE', headers });
        }
    } else {
        console.log(`Failed to create habit: ${createHabitRes.status} ${await createHabitRes.text()}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
