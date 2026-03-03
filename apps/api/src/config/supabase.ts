import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
}

// Service role client - ADMIN ACCESS (Use carefully)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to create a client for a specific user token (RLS context)
export const createSupabaseUserClient = (jwt: string) => {
  return createClient(supabaseUrl, process.env.SUPABASE_JWT_SECRET || '', { // Using JWT secret or anon key if preferred, but usually we just forward the token
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  });
};
