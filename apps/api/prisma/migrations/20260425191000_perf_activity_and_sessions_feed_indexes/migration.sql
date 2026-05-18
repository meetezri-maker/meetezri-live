-- Performance indexes for GET /api/users/activity (recent activity feed).
-- Safe to run multiple times (IF NOT EXISTS).

-- activity_events: filter by user_id, order by timestamp desc
CREATE INDEX IF NOT EXISTS "activity_events_user_id_timestamp_idx"
ON "public"."activity_events" ("user_id", "timestamp" DESC);

-- app_sessions: activity feed lists sessions by user_id ordered by created_at desc
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_created_at_idx"
ON "public"."app_sessions" ("user_id", "created_at" DESC);

