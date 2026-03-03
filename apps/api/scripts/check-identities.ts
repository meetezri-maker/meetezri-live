
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

async function main() {
  console.log(`Checking identities for user: ${userId}`);
  
  // We can't query auth.identities directly via client usually, but listUsers returns identities?
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    console.error('Error getting user:', error);
    return;
  }

  console.log('User Identities:', user.identities);
  console.log('App Metadata:', user.app_metadata);
}

main();
