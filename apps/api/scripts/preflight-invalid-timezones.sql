-- ============================================================================
-- READ-ONLY preflight: which stored profiles.timezone values are NOT recognized
-- by PostgreSQL, for migration 20260720120000_gamification_points_foundation.
-- Run manually against STAGING ONLY. SELECTs only — no writes.
-- Do NOT run against production.
-- ============================================================================
--
-- Why this matters: `timestamptz AT TIME ZONE <text>` raises
--   ERROR: time zone "<value>" not recognized
-- for any unrecognized string, which would ABORT the migration. The migration
-- guards against this (it only passes values found in pg_timezone_names, else
-- UTC), so it is SAFE even with bad data. This report tells you HOW MUCH data
-- would silently fall back to UTC, so you can decide whether to correct the
-- source values first (e.g. non-canonical or abbreviation forms).
--
-- Note: pg_timezone_names.name is the canonical IANA set, matching the names the
-- frontend Intl API produces. Abbreviations (e.g. 'EST') and POSIX forms that
-- AT TIME ZONE might otherwise accept are treated as "fall back to UTC" here,
-- which is the conservative, migration-safe behavior.

-- 1. Distinct non-null/non-empty timezone values that are NOT canonical IANA
--    names, with how many profiles use each (these fall back to UTC).
SELECT
  p.timezone            AS unrecognized_timezone,
  COUNT(*)              AS profile_count
FROM public.profiles p
WHERE p.timezone IS NOT NULL
  AND p.timezone <> ''
  AND NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p.timezone)
GROUP BY p.timezone
ORDER BY profile_count DESC;

-- 2. Coverage summary across all profiles.
SELECT
  COUNT(*)                                                             AS total_profiles,
  COUNT(*) FILTER (WHERE timezone IS NULL OR timezone = '')            AS null_or_empty_tz,
  COUNT(*) FILTER (
    WHERE timezone IS NOT NULL AND timezone <> ''
      AND EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = profiles.timezone)
  )                                                                    AS valid_iana_tz,
  COUNT(*) FILTER (
    WHERE timezone IS NOT NULL AND timezone <> ''
      AND NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = profiles.timezone)
  )                                                                    AS invalid_tz_falls_back_to_utc
FROM public.profiles;

-- 3. How many goal_check_ins rows belong to profiles whose timezone will fall
--    back to UTC during the backfill (null/empty OR unrecognized).
SELECT COUNT(*) AS goal_check_in_rows_backfilled_as_utc
FROM public.goal_check_ins gc
JOIN public.profiles p ON p.id = gc.user_id
WHERE p.timezone IS NULL
   OR p.timezone = ''
   OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p.timezone);
