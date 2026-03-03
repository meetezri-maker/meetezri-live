
import { supabaseAdmin } from '../src/config/supabase';

const email = 'saifali87154@gmail.com';

async function main() {
  console.log(`Checking status for user with email: ${email}`);
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  const user = users.find(u => u.email === email);
  if (user) {
    console.log('User found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Email Confirmed At:', user.email_confirmed_at);
    console.log('Confirmed At:', user.confirmed_at);
    console.log('Last Sign In:', user.last_sign_in_at);
    console.log('App Metadata:', user.app_metadata);
    console.log('User Metadata:', user.user_metadata);
  } else {
    console.log('User NOT found.');
  }
}

main();
