
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://slouwhrnkzkkjyysjgvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb3V3aHJua3pra2p5eXNqZ3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzM4NzMsImV4cCI6MjA4NTcwOTg3M30.W62sDxsFK1W3z-hGrJwbdTsmttZEvsylC4TzSNy4mpg';

const supabase = createClient(supabaseUrl, supabaseKey);

const email = 'saifali87154@gmail.com';
const password = 'Password123!';

async function main() {
  console.log(`Attempting to sign in with email: ${email}...`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in failed:', error);
    return;
  }

  const token = data.session.access_token;
  console.log('Sign in successful! Token obtained.');

  console.log('Calling /api/billing/admin/subscriptions...');
  const start = performance.now();
  try {
    const response = await fetch('http://localhost:3001/api/billing/admin/subscriptions?page=1&limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const end = performance.now();
    console.log('Status:', response.status);
    console.log(`Time: ${(end - start).toFixed(2)}ms`);

    if (response.status !== 200) {
      const text = await response.text();
      console.log('Response body:', text);
    } else {
      const json = await response.json();
      console.log('Success! Items count:', json.length);
      if (json.length > 0) {
        console.log('First item sample:', JSON.stringify(json[0], null, 2));
      }
    }
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

main();
