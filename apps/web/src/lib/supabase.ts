import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials in environment variables');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// Dev-only debug helpers (do not affect auth behavior).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__MEETEZRI_SUPABASE_URL__ = supabaseUrl || '';
  (window as any).__MEETEZRI_SUPABASE_PROJECT_REF__ = (supabaseUrl || '')
    .replace(/^https?:\/\//, '')
    .split('.supabase.co')[0] || '';
}
