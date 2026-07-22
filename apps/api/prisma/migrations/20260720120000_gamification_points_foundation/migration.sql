-- Gamification points foundation:
--   * single point-transaction ledger (source of truth for points)
--   * completion/reward tracking columns on goals + achievements
--   * progress tracking-model columns
--   * per-user-calendar-day check-in dedup on goal_check_ins

-- ---------------------------------------------------------------------------
-- 1. Point transaction ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "user_id"        uuid NOT NULL,
  "source_type"    text NOT NULL,
  "source_item_id" uuid NOT NULL,
  "points"         integer NOT NULL,
  "reason"         text,
  "created_at"     timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Idempotency: one item can only ever award a given reward once.
CREATE UNIQUE INDEX IF NOT EXISTS "point_transactions_user_source_item_key"
  ON "public"."point_transactions" ("user_id", "source_type", "source_item_id");
CREATE INDEX IF NOT EXISTS "point_transactions_user_id_created_at_idx"
  ON "public"."point_transactions" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "point_transactions_source_idx"
  ON "public"."point_transactions" ("source_type", "source_item_id");

-- ---------------------------------------------------------------------------
-- 2. Completion + tracking columns on personal_goals
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."personal_goals"
  ADD COLUMN IF NOT EXISTS "completed_at"   timestamptz(6),
  ADD COLUMN IF NOT EXISTS "reward_awarded" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tracking_type"  text NOT NULL DEFAULT 'manual_milestone',
  ADD COLUMN IF NOT EXISTS "target_value"   numeric,
  ADD COLUMN IF NOT EXISTS "current_value"  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tracking_unit"  text;

-- ---------------------------------------------------------------------------
-- 3. Completion + tracking columns on custom_achievements
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."custom_achievements"
  ADD COLUMN IF NOT EXISTS "completed_at"   timestamptz(6),
  ADD COLUMN IF NOT EXISTS "reward_awarded" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tracking_type"  text NOT NULL DEFAULT 'count',
  ADD COLUMN IF NOT EXISTS "tracking_unit"  text;

-- ---------------------------------------------------------------------------
-- 4. Per-day check-in dedup + progress snapshot on goal_check_ins
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."goal_check_ins"
  ADD COLUMN IF NOT EXISTS "check_in_date"   date,
  ADD COLUMN IF NOT EXISTS "value_added"     numeric,
  ADD COLUMN IF NOT EXISTS "milestone"       text,
  ADD COLUMN IF NOT EXISTS "progress_before" integer,
  ADD COLUMN IF NOT EXISTS "progress_after"  integer;

-- Backfill check_in_date for existing rows using the USER'S configured timezone,
-- matching the going-forward rule (see gamification/calendar.ts userCalendarDate:
-- user timezone when set + valid, otherwise UTC). Bucketing historical rows by
-- UTC would disagree with new rows across a UTC midnight boundary.
--
-- `AT TIME ZONE <text>` raises "time zone not recognized" for any string that is
-- not a known zone, which would abort the whole migration. The CASE guards every
-- row: it uses profiles.timezone only when it is non-empty AND present in
-- pg_timezone_names (the canonical IANA set Intl also uses); otherwise it falls
-- back to the always-valid 'UTC'. So the UPDATE can never fail on a bad value.
UPDATE "public"."goal_check_ins" AS gc
  SET "check_in_date" = (
    gc."created_at" AT TIME ZONE (
      CASE
        WHEN p."timezone" IS NOT NULL
         AND p."timezone" <> ''
         AND EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p."timezone")
        THEN p."timezone"
        ELSE 'UTC'
      END
    )
  )::date
  FROM "public"."profiles" AS p
  WHERE p."id" = gc."user_id"
    AND gc."check_in_date" IS NULL;

-- Defensive fallback: any rows whose user_id has no matching profile row (should
-- not happen given the FK, but never leave a NULL that would skip dedup) get the
-- UTC calendar day.
UPDATE "public"."goal_check_ins"
  SET "check_in_date" = ("created_at" AT TIME ZONE 'utc')::date
  WHERE "check_in_date" IS NULL;

-- One check-in per user per goal per calendar day.
-- NOTE: plain (non-CONCURRENT) index — it MUST stay non-concurrent because Prisma
-- runs each migration inside a transaction and PostgreSQL forbids
-- CREATE INDEX CONCURRENTLY inside a transaction block. See the deployment notes
-- in scripts/preflight-goal-checkin-duplicates.sql for the large-table strategy.
CREATE UNIQUE INDEX IF NOT EXISTS "goal_check_ins_user_goal_day_key"
  ON "public"."goal_check_ins" ("user_id", "goal_id", "check_in_date");
