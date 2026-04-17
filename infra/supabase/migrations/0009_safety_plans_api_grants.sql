-- PostgREST / Supabase REST returns 42501 "permission denied for schema public" when API
-- roles lack USAGE on schema public or lack table privileges. RLS still enforces row access.
--
-- Run this migration against your Supabase project (Dashboard → SQL → New query).

-- Schema: required so anon/authenticated can resolve objects in public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Table: required in addition to RLS policies on public.safety_plans
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.safety_plans TO authenticated;
GRANT ALL ON TABLE public.safety_plans TO service_role;
