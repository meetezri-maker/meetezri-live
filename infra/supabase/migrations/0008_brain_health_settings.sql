-- Brain health preferences (reminders, focus mode, weekly insights) stored per user.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brain_health_settings JSONB;
