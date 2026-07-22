-- Achievement daily check-ins: a proper database-backed table (no longer only
-- JSON blobs on the custom_achievements row), with the same one-per-user-
-- calendar-day guarantee as goal_check_ins.

CREATE TABLE IF NOT EXISTS "public"."achievement_check_ins" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "achievement_id" uuid NOT NULL,
  "user_id"        uuid NOT NULL,
  "check_in_date"  date NOT NULL,
  "value_added"    numeric,
  "milestone"      text,
  "progress_before" integer,
  "progress_after"  integer,
  "note"           text,
  "created_at"     timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "achievement_check_ins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "achievement_check_ins_achievement_id_fkey" FOREIGN KEY ("achievement_id")
    REFERENCES "public"."custom_achievements"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "achievement_check_ins_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- One achievement progress check-in per user per calendar day.
CREATE UNIQUE INDEX IF NOT EXISTS "achievement_check_ins_user_ach_day_key"
  ON "public"."achievement_check_ins" ("user_id", "achievement_id", "check_in_date");
CREATE INDEX IF NOT EXISTS "achievement_check_ins_ach_created_at_idx"
  ON "public"."achievement_check_ins" ("achievement_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "achievement_check_ins_user_created_at_idx"
  ON "public"."achievement_check_ins" ("user_id", "created_at" DESC);

-- Legacy-record compatibility: flag rows created before tracking was introduced
-- so the app can treat unconfigured items as manual-only without inventing targets.
ALTER TABLE "public"."custom_achievements"
  ADD COLUMN IF NOT EXISTS "legacy_tracking" boolean NOT NULL DEFAULT false;
ALTER TABLE "public"."personal_goals"
  ADD COLUMN IF NOT EXISTS "legacy_tracking" boolean NOT NULL DEFAULT false;
