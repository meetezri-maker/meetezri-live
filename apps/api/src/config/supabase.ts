import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
}

// Service role client - ADMIN ACCESS (Use carefully)
// Use empty strings if env vars are missing to avoid crash on import
// The client will fail when used, which is better than crashing the whole app on startup
export const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder-key', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to create a client for a specific user token (RLS context)
export const createSupabaseUserClient = (jwt: string) => {
  return createClient(supabaseUrl || 'https://placeholder.supabase.co', process.env.SUPABASE_JWT_SECRET || 'placeholder-secret', { // Using JWT secret or anon key if preferred, but usually we just forward the token
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  });
};
