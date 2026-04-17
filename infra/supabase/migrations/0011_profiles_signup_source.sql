-- Distinguish self-serve signups from admin-provisioned invites (trial/plan still in signup_type + subscriptions).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_source TEXT;

COMMENT ON COLUMN public.profiles.signup_source IS
  'app | admin_user | admin_companion | admin_org — where the account was created';
