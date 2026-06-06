import { createClient } from '@supabase/supabase-js';

/** Supabase demo anon key (valid JWT shape) — dev-only fallback so the app can boot without .env */
const DEV_FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function resolveSupabaseConfig(): { url: string; anonKey: string; usingFallback: boolean } {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';
  const looksLikePlaceholder =
    !url ||
    !anonKey ||
    url.includes('your_supabase') ||
    anonKey.includes('your_supabase');

  if (!looksLikePlaceholder) {
    return { url, anonKey, usingFallback: false };
  }

  if (import.meta.env.DEV) {
    console.warn(
      '[meetezri] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy apps/web/.env.example to apps/web/.env. Auth will not work until real credentials are set.'
    );
    return {
      url: 'https://placeholder.supabase.co',
      anonKey: DEV_FALLBACK_ANON_KEY,
      usingFallback: true,
    };
  }

  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required. See apps/web/.env.example.'
  );
}

const { url: supabaseUrl, anonKey: supabaseAnonKey, usingFallback } = resolveSupabaseConfig();

export const supabaseConfig = { url: supabaseUrl, usingFallback };

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dev-only debug helpers (do not affect auth behavior).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__MEETEZRI_SUPABASE_URL__ = supabaseUrl || '';
  (window as any).__MEETEZRI_SUPABASE_PROJECT_REF__ = (supabaseUrl || '')
    .replace(/^https?:\/\//, '')
    .split('.supabase.co')[0] || '';
}
