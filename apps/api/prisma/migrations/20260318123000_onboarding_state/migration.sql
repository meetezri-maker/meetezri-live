-- Add explicit onboarding completion state.
-- This is nullable to keep backwards-compatibility for existing profiles.
-- IF NOT EXISTS: safe when columns were added manually (e.g. Supabase) before migrate.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ(6);
