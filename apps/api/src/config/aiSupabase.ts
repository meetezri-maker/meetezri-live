import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let cachedClient: SupabaseClient | null = null;

function readAiSupabaseEnv() {
  const url = process.env.AI_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.AI_SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  return { url, serviceRoleKey };
}

export function isAiSupabaseConfigured(): boolean {
  const { url, serviceRoleKey } = readAiSupabaseEnv();
  return Boolean(url && serviceRoleKey);
}

export function getAiSupabaseAdmin(): SupabaseClient | null {
  const { url, serviceRoleKey } = readAiSupabaseEnv();
  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedClient;
}

export function resetAiSupabaseClientForTests() {
  cachedClient = null;
}
