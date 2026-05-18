-- Exact session length for CMS wellness tools (timers / MM:SS display).
ALTER TABLE "public"."wellness_tools" ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER;

UPDATE "public"."wellness_tools"
SET "duration_seconds" = "duration_minutes" * 60
WHERE "duration_seconds" IS NULL
  AND "duration_minutes" IS NOT NULL
  AND "duration_minutes" > 0;
