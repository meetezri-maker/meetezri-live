-- ============================================================================
-- Add Bianca, Damian and Sasha to public.ai_avatars.        PREPARED, NOT APPLIED.
-- ============================================================================
--
-- ADDITIVE AND RERUNNABLE. Inserts a row only when no row with the same name
-- (trimmed, case-insensitive) already exists. It never deletes, updates or
-- reorders anything: the original four, their ids, admin edits and any
-- admin-created companions are untouched. Do NOT use scripts/seed_avatars.ts for
-- this — it deletes every row first.
--
-- WHY A SCRIPT AND NOT A PRISMA MIGRATION. `ai_avatars.name` has no unique
-- constraint, so ON CONFLICT is unavailable and the guard is NOT EXISTS under a
-- table lock. And the API build does not run migrations: a migration directory
-- would be applied by whoever next runs `prisma migrate deploy` for any reason,
-- tying these rows to an unrelated release. This file is run deliberately.
--
-- VALUES ARE ONLY WHAT IS APPROVED. name and an empty specialties array. The
-- persona columns (gender, age_range, personality, description, voice_type,
-- accent_type) are NULL because no approved copy exists; the web app renders
-- "Solace companion" and hides empty fields. rating is set to NULL explicitly —
-- the column defaults to 5.0, which would be an invented rating. image_url is
-- NULL: the portrait resolves from public/avatars/<Name>.png by name.
--
-- ACTIVATION. `is_active` exists (Boolean, default true) and the member-facing
-- DB selectors — Session Lobby and Change Avatar — hide rows where it is false;
-- the admin manager shows them and can toggle them. So the rows can go in
-- inactive first (STEP 2A) and be switched on later (STEP 4). Onboarding does
-- NOT read this table — see the rollout notes in HYPER3D_SEVEN_COMPANION_REPORT.md.
--
-- Run with psql against the target database, one step at a time:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f add-companions-bianca-damian-sasha.sql
-- (or paste the step you need). Nothing here has been run.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 — PREFLIGHT (read-only). Expect zero rows. A row here means a
-- companion with one of these names already exists (for example an admin
-- created one); the insert below would then SKIP that name and leave the
-- existing row as it is. Decide about it before continuing.
-- ---------------------------------------------------------------------------
SELECT id, name, is_active, created_at
FROM "public"."ai_avatars"
WHERE LOWER(TRIM("name")) IN ('bianca', 'damian', 'sasha')
ORDER BY name;


-- ---------------------------------------------------------------------------
-- STEP 2A — INSERT INACTIVE (recommended). Rows exist but stay hidden from
-- Session Lobby and Change Avatar until STEP 4.
-- STEP 2B — to insert them already active instead, change `false` to `true`
-- in the VALUES below and skip STEP 4.
-- ---------------------------------------------------------------------------
BEGIN;

-- Serialises concurrent runs so the NOT EXISTS guard cannot race itself.
LOCK TABLE "public"."ai_avatars" IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO "public"."ai_avatars"
  ("name", "gender", "age_range", "personality", "specialties", "description",
   "image_url", "voice_type", "accent_type", "rating", "is_active")
SELECT v."name", NULL, NULL, NULL, ARRAY[]::text[], NULL,
       NULL, NULL, NULL, NULL, v."is_active"
FROM (VALUES
  ('Bianca', false),
  ('Damian', false),
  ('Sasha',  false)
) AS v("name", "is_active")
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."ai_avatars" a
  WHERE LOWER(TRIM(a."name")) = LOWER(v."name")
);

-- Expect exactly one row per name.
SELECT name, COUNT(*) AS rows, BOOL_AND(is_active) AS all_active
FROM "public"."ai_avatars"
WHERE LOWER(TRIM("name")) IN ('bianca', 'damian', 'sasha')
GROUP BY name
ORDER BY name;

COMMIT;


-- ---------------------------------------------------------------------------
-- STEP 3 — VERIFY the original four are unchanged (compare with a snapshot
-- taken before STEP 2).
-- ---------------------------------------------------------------------------
SELECT id, name, is_active, updated_at
FROM "public"."ai_avatars"
WHERE "name" IN ('Alex', 'Jordan Taylor', 'Maya Chen', 'Sara Mitchell')
ORDER BY name;


-- ---------------------------------------------------------------------------
-- STEP 4 — ACTIVATE (only after the frontend that knows these companions is
-- live, and the AI agent has confirmed it handles their avatar_name).
-- Touches only these three names; rerunnable.
-- ---------------------------------------------------------------------------
-- UPDATE "public"."ai_avatars"
-- SET "is_active" = true, "updated_at" = timezone('utc'::text, now())
-- WHERE "name" IN ('Bianca', 'Damian', 'Sasha') AND "is_active" IS DISTINCT FROM true;


-- ---------------------------------------------------------------------------
-- ROLLBACK — hide again (preferred; keeps ids and session history joins):
-- ---------------------------------------------------------------------------
-- UPDATE "public"."ai_avatars"
-- SET "is_active" = false, "updated_at" = timezone('utc'::text, now())
-- WHERE "name" IN ('Bianca', 'Damian', 'Sasha');
