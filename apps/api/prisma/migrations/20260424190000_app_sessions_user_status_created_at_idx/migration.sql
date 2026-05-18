-- Improve performance for common list queries like:
-- GET /api/sessions?status=scheduled (filter by user_id + status, order by created_at desc)
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_status_created_at_idx"
ON "public"."app_sessions" ("user_id", "status", "created_at" DESC);

