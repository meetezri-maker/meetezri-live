-- Core performance indexes for the most common API patterns.
-- Safe to run multiple times (IF NOT EXISTS).

-- Notifications: list + unread count
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
ON "public"."notifications" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx"
ON "public"."notifications" ("user_id", "is_read", "created_at" DESC);

-- Habits: list active (not archived) ordered by created_at
CREATE INDEX IF NOT EXISTS "habits_user_id_is_archived_created_at_idx"
ON "public"."habits" ("user_id", "is_archived", "created_at" ASC);

-- Habit logs: common lookups by habit + date range
CREATE INDEX IF NOT EXISTS "habit_logs_habit_id_completed_at_idx"
ON "public"."habit_logs" ("habit_id", "completed_at" DESC);

-- Community posts: feed lists non-deleted, newest first
CREATE INDEX IF NOT EXISTS "community_posts_deleted_at_created_at_idx"
ON "public"."community_posts" ("deleted_at", "created_at" DESC);

-- Community comments: per-post thread ordered by created_at
CREATE INDEX IF NOT EXISTS "community_comments_post_id_created_at_idx"
ON "public"."community_comments" ("post_id", "created_at" ASC);

