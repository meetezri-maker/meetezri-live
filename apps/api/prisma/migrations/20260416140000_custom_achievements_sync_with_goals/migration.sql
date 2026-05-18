-- Personal achievements (achievement-only streaks) skip the goals API; goal-style rows sync check-ins to personal_goals.
ALTER TABLE "public"."custom_achievements"
ADD COLUMN IF NOT EXISTS "sync_with_goals" BOOLEAN NOT NULL DEFAULT true;

-- Rows created from the "Personal Achievements" tab match: custom goal type, no planner fields, no linked personal goal.
UPDATE "public"."custom_achievements"
SET "sync_with_goals" = false
WHERE "goal_type" = 'custom'
  AND "linked_goal_id" IS NULL
  AND "goal_category" IS NULL;
