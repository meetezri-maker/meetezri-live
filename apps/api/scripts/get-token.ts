
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://slouwhrnkzkkjyysjgvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb3V3aHJua3pra2p5eXNqZ3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzM4NzMsImV4cCI6MjA4NTcwOTg3M30.W62sDxsFK1W3z-hGrJwbdTsmttZEvsylC4TzSNy4mpg';

const supabase = createClient(supabaseUrl, supabaseKey);

const email = 'saifali87154@gmail.com';
const password = 'Password123!';

export async function getToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }
  return data.session.access_token;
}

if (require.main === module) {
  getToken()
    .then((token) => console.log(token))
    .catch((error) => {
      console.error('Sign in failed:', error);
      process.exit(1);
    });
}
