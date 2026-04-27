-- Indexes for the slow dashboard endpoints:
-- - GET /api/users/credits (sum completed session billed_seconds within a period)
-- - GET /api/wellness/challenges?scope=dashboard (active challenges + completed points)
-- Safe to run multiple times (IF NOT EXISTS).

-- Credits: filter by user_id + status + ended_at range
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_status_ended_at_idx"
ON "public"."app_sessions" ("user_id", "status", "ended_at" DESC)
WHERE ended_at IS NOT NULL;

-- Wellness: list active challenges by date window
CREATE INDEX IF NOT EXISTS "wellness_challenges_start_end_idx"
ON "public"."wellness_challenges" ("start_date", "end_date");

-- Wellness points: sum completed participation rows for user quickly
CREATE INDEX IF NOT EXISTS "user_challenge_participation_user_completed_idx"
ON "public"."user_challenge_participation" ("user_id", "is_completed");

