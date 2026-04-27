-- Performance indexes for GET /api/habits (habits list + recent logs per habit).
-- Safe to run multiple times (IF NOT EXISTS).

-- Habits: list active habits for a user ordered by created_at asc
CREATE INDEX IF NOT EXISTS "habits_user_id_is_archived_created_at_idx"
ON "public"."habits" ("user_id", "is_archived", "created_at" ASC);

-- Habit logs: per-habit recent completion history ordered by completed_at desc
CREATE INDEX IF NOT EXISTS "habit_logs_habit_id_completed_at_idx"
ON "public"."habit_logs" ("habit_id", "completed_at" DESC);

