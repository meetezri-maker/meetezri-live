-- Speed up lifetime usage aggregates used by GET /api/users/me and credits calculations.
-- Safe to run multiple times (IF NOT EXISTS).

-- This matches queries filtering:
--   WHERE user_id = ? AND status = 'completed' AND ended_at IS NOT NULL
-- and supports ordering/constraints on ended_at when needed.
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_completed_ended_at_idx"
ON "public"."app_sessions" ("user_id", "ended_at" DESC)
WHERE status = 'completed' AND ended_at IS NOT NULL;

