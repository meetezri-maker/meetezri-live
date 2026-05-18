-- Moderation fields for admin community management
ALTER TABLE "public"."community_posts"
  ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "flag_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "public"."community_groups"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
