import { supabaseAdmin } from '../src/config/supabase';

const email = 'saifali87154@gmail.com';

async function main() {
  console.log(`Searching for user with email: ${email}`);
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  const user = users.find(u => u.email === email);
  if (user) {
    console.log('Found user in auth.users:', user);
  } else {
    console.log('User NOT found in auth.users with email:', email);
    console.log('All users:', users.map(u => ({ id: u.id, email: u.email })));
  }
}

main();
