-- ============================================================================
-- READ-ONLY preflight comparison: UTC vs user-timezone bucketing of
-- goal_check_ins, for migration 20260720120000_gamification_points_foundation.
-- Run manually against STAGING ONLY. SELECTs only — no writes, no locks.
-- Do NOT run against production.
-- ============================================================================
--
-- Shows why the migration switched from UTC to user-timezone bucketing:
--   (a) duplicate groups under UTC bucketing,
--   (b) duplicate groups under user-timezone bucketing (what the migration uses),
--   (c) rows whose UTC calendar day differs from their user-timezone day — these
--       are the rows that would be bucketed differently by the two methods.

-- Per-row day under each method.
WITH per_row AS (
  SELECT
    gc.id,
    gc.user_id,
    gc.goal_id,
    gc.created_at,
    p.timezone AS raw_timezone,
    (gc.created_at AT TIME ZONE 'UTC')::date AS utc_day,
    (
      gc.created_at AT TIME ZONE (
        CASE
          WHEN p.timezone IS NOT NULL
           AND p.timezone <> ''
           AND EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p.timezone)
          THEN p.timezone
          ELSE 'UTC'
        END
      )
    )::date AS user_day
  FROM public.goal_check_ins gc
  LEFT JOIN public.profiles p ON p.id = gc.user_id
)

-- (a) + (b): duplicate-group counts under each bucketing method.
SELECT
  'utc_bucketing'  AS method,
  COUNT(*)         AS duplicate_groups,
  COALESCE(SUM(c), 0)     AS rows_in_duplicate_groups
FROM (
  SELECT user_id, goal_id, utc_day, COUNT(*) AS c
  FROM per_row GROUP BY user_id, goal_id, utc_day HAVING COUNT(*) > 1
) g
UNION ALL
SELECT
  'user_timezone_bucketing' AS method,
  COUNT(*)                  AS duplicate_groups,
  COALESCE(SUM(c), 0)       AS rows_in_duplicate_groups
FROM (
  SELECT user_id, goal_id, user_day, COUNT(*) AS c
  FROM per_row GROUP BY user_id, goal_id, user_day HAVING COUNT(*) > 1
) g;

-- (c): individual rows whose UTC day and user-timezone day disagree.
--      These are the rows the two methods would place in different day-buckets.
WITH per_row AS (
  SELECT
    gc.id,
    gc.user_id,
    gc.goal_id,
    gc.created_at,
    p.timezone AS raw_timezone,
    (gc.created_at AT TIME ZONE 'UTC')::date AS utc_day,
    (
      gc.created_at AT TIME ZONE (
        CASE
          WHEN p.timezone IS NOT NULL
           AND p.timezone <> ''
           AND EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p.timezone)
          THEN p.timezone
          ELSE 'UTC'
        END
      )
    )::date AS user_day
  FROM public.goal_check_ins gc
  LEFT JOIN public.profiles p ON p.id = gc.user_id
)
SELECT id, user_id, goal_id, raw_timezone, created_at, utc_day, user_day
FROM per_row
WHERE utc_day <> user_day
ORDER BY user_id, goal_id, created_at;
