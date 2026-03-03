
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const userId = 'b53646f9-8d29-46e5-8fd6-c580f0740e42';
const newPassword = 'Password123!';

async function main() {
  console.log(`Updating app_metadata for user ${userId}...`);
  
  // 1. Update app_metadata to include 'email' provider
  const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      provider: 'google', // Primary provider can stay google
      providers: ['google', 'email'] // Add email to providers list
    }
  });

  if (updateError) {
    console.error('Error updating app_metadata:', updateError);
    return;
  }

  console.log('App metadata updated:', updateData.user.app_metadata);

  // 2. Set password again to ensure it's hashed and ready
  console.log('Setting password...');
  const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (passwordError) {
    console.error('Error setting password:', passwordError);
  } else {
    console.log('Password set successfully.');
  }
}

main();
