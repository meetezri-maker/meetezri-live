-- Personal goals + check-ins (public schema)
-- Depends on public.profiles from earlier migrations.

create extension if not exists "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.personal_goals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_title text NOT NULL,
  goal_category text NOT NULL,
  goal_description text NOT NULL,
  why_this_goal_matters text NOT NULL,
  target_outcome text NOT NULL,
  priority_level text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  start_date text NOT NULL,
  target_date text,
  progress_percentage integer NOT NULL DEFAULT 0,
  check_in_frequency text NOT NULL DEFAULT 'daily',
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_time text,
  small_action_steps text[] NOT NULL DEFAULT ARRAY[]::text[],
  emotion_tag text,
  support_type_needed text,
  notes text,
  last_check_in_date text,
  streak_count integer NOT NULL DEFAULT 0,
  ai_suggestions text[] NOT NULL DEFAULT ARRAY[]::text[],
  partner_visibility boolean NOT NULL DEFAULT false,
  partner_comment_enabled boolean NOT NULL DEFAULT false,
  completion_note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.goal_check_ins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id uuid NOT NULL REFERENCES public.personal_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_percentage integer NOT NULL,
  mood text,
  reflection text,
  challenges_faced text,
  wins text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS personal_goals_user_id_idx
  ON public.personal_goals (user_id);
CREATE INDEX IF NOT EXISTS personal_goals_user_id_created_at_idx
  ON public.personal_goals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS personal_goals_user_id_status_idx
  ON public.personal_goals (user_id, status);
CREATE INDEX IF NOT EXISTS goal_check_ins_goal_id_created_at_idx
  ON public.goal_check_ins (goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS goal_check_ins_user_id_created_at_idx
  ON public.goal_check_ins (user_id, created_at DESC);

ALTER TABLE public.personal_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own personal goals" ON public.personal_goals;
CREATE POLICY "Users can manage own personal goals" ON public.personal_goals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own goal check-ins" ON public.goal_check_ins;
CREATE POLICY "Users can manage own goal check-ins" ON public.goal_check_ins
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.personal_goals g
      WHERE g.id = goal_check_ins.goal_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read all personal goals" ON public.personal_goals;
CREATE POLICY "Admins can read all personal goals" ON public.personal_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'team_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can read all goal check-ins" ON public.goal_check_ins;
CREATE POLICY "Admins can read all goal check-ins" ON public.goal_check_ins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'team_admin', 'admin')
    )
  );
