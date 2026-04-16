-- Achievement-only items (sync_with_goals = false) do not write to personal_goals / goal_check_ins.
ALTER TABLE public.custom_achievements
ADD COLUMN IF NOT EXISTS sync_with_goals boolean NOT NULL DEFAULT true;

UPDATE public.custom_achievements
SET sync_with_goals = false
WHERE goal_type = 'custom'
  AND linked_goal_id IS NULL
  AND goal_category IS NULL;
