create extension if not exists "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.custom_achievements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 1,
  unlocked boolean NOT NULL DEFAULT false,
  points integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  goal_type text,
  last_check_in_date text,
  check_in_history text[] NOT NULL DEFAULT ARRAY[]::text[],
  check_in_entries jsonb,
  goal_category text,
  why_it_matters text,
  target_outcome text,
  start_date text,
  target_date text,
  priority text,
  progress_status text,
  check_in_frequency text,
  reminder_enabled boolean,
  action_steps text,
  mood_tag text,
  support_type text,
  notes text,
  linked_goal_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS custom_achievements_user_id_created_at_idx
  ON public.custom_achievements (user_id, created_at DESC);

ALTER TABLE public.custom_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own custom achievements" ON public.custom_achievements;
CREATE POLICY "Users can manage own custom achievements" ON public.custom_achievements
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all custom achievements" ON public.custom_achievements;
CREATE POLICY "Admins can read all custom achievements" ON public.custom_achievements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'team_admin', 'admin')
    )
  );
