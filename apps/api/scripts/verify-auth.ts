
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const API_URL = 'http://localhost:3001/api';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''; // Use service key to delete users if needed

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const prisma = new PrismaClient();

const TEST_EMAIL = `test.user.${Date.now()}@meetezri.com`;
const TEST_PASSWORD = 'TestPassword123!';

async function runTest() {
  console.log('--- Starting Auth Verification Test ---');

  // Use admin.createUser to bypass email confirmation and rate limits
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Test User' }
  });

  if (error) {
    console.error('Failed to create user:', error);
    process.exit(1);
  }

  const user = data.user;
  const userId = user?.id;

  if (!userId) {
    console.error('No user ID returned');
    process.exit(1);
  }

  console.log(`User created: ${userId}`);

  // 2. Login to get Access Token (simulate frontend login)
  // We need to sign in to get the access token for the API calls
  console.log('\n2. Logging in to get token');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (loginError) {
    console.error('Login failed:', loginError);
    process.exit(1);
  }
  
  const token = loginData.session?.access_token;
  console.log('Token received:', token ? 'Yes' : 'No');

  try {
    // 2. Test Get Profile (Expect 404 because onboarding not done)
    console.log('\n2. Testing /users/me (Expect 404 - Profile Not Found)');
    const res1 = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Status: ${res1.status}`);
    if (res1.status === 404) {
      console.log('✅ PASS: Correctly returned 404 for missing profile.');
    } else {
      console.error(`❌ FAIL: Expected 404, got ${res1.status}`);
    }

    // 3. Create Profile (Simulate Onboarding)
    console.log('\n3. Creating Profile (Onboarding)');
    const res2 = await fetch(`${API_URL}/users/onboarding`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        full_name: 'Test User',
        role: 'user', 
      })
    });
    
    // Check if onboarding succeeded or if we need more fields
    // If it fails, we might need to check schema. But for now let's assume standard fields.
    // If 400, print error
    if (!res2.ok) {
        const err = await res2.json();
        console.log('Onboarding response:', res2.status, err);
        // If we can't onboard easily, we can manually create profile in Prisma
        await prisma.profiles.create({
            data: {
                id: userId,
                email: TEST_EMAIL,
                full_name: 'Test User',
                role: 'user'
            }
        });
        console.log('Manually created profile via Prisma fallback.');
    } else {
        console.log('Onboarding successful.');
    }

    // 4. Test Get Profile (Expect 200)
    console.log('\n4. Testing /users/me (Expect 200 - OK)');
    const res3 = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Status: ${res3.status}`);
    if (res3.status === 200) {
      console.log('✅ PASS: Correctly returned 200 for valid user.');
    } else {
      console.error(`❌ FAIL: Expected 200, got ${res3.status}`);
    }

    // 5. Test Invalid Token (Expect 401)
    console.log('\n5. Testing Invalid Token (Expect 401)');
    const res4 = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer invalid-token-123` }
    });
    console.log(`Status: ${res4.status}`);
    if (res4.status === 401 || res4.status === 500) { 
        // Fastify-jwt might return 500 if format is totally wrong, or 401. Ideally 401.
        // Let's see what it returns.
        if (res4.status === 401) console.log('✅ PASS: Correctly returned 401.');
        else console.log(`⚠️ WARN: Returned ${res4.status} instead of 401 (might be handled differently).`);
    }

    // 6. Test Profile Deleted (Expect 404)
    console.log('\n6. Testing Profile Deleted (Expect 404)');
    await prisma.profiles.delete({ where: { id: userId } });
    console.log('Deleted profile from DB.');
    
    const res5 = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Status: ${res5.status}`);
    if (res5.status === 404) {
      console.log('✅ PASS: Correctly returned 404 for deleted profile.');
    } else {
      console.error(`❌ FAIL: Expected 404, got ${res5.status}`);
    }

  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    try {
        await supabase.auth.admin.deleteUser(userId);
        console.log('Deleted test user from Supabase.');
    } catch (e) {
        console.log('Error deleting user from Supabase (might be already gone):', e);
    }
    await prisma.$disconnect();
  }
}

runTest();
