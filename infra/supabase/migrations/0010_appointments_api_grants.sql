-- The policy "Companions can view patient safety plans" on public.safety_plans uses
-- EXISTS (SELECT 1 FROM public.appointments ...). Evaluating RLS requires the
-- querying role to have table privileges on appointments, or Postgres returns
-- 42501 "permission denied for table appointments".

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointments TO authenticated;
GRANT ALL ON TABLE public.appointments TO service_role;
