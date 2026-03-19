-- Add explicit onboarding completion state.
-- This is nullable to keep backwards-compatibility for existing profiles.

ALTER TABLE public.profiles
ADD COLUMN onboarding_completed BOOLEAN;

ALTER TABLE public.profiles
ADD COLUMN onboarding_completed_at TIMESTAMPTZ(6);

