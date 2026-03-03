import { supabaseAdmin } from '../src/config/supabase';

const userId = 'b53646f9-8d29-46e5-8fd6-c580f0740e42';
const newPassword = 'Password123!';

async function main() {
  console.log(`Setting password for user ${userId}...`);
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log('Password updated successfully for user:', data.user.email);
    console.log(`New password: ${newPassword}`);
  }
}

main();
