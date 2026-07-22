-- ============================================================================
-- READ-ONLY preflight for migration 20260720120000_gamification_points_foundation
-- Run manually against STAGING ONLY, before the migration is applied anywhere.
-- Contains SELECTs only. It does not modify, lock, or write any data.
-- Do NOT run against production. Do NOT run prisma migrate deploy from here.
-- ============================================================================
--
-- Purpose: report (user_id, goal_id, calendar-day) groups in goal_check_ins that
-- have more than one row, using the EXACT SAME timezone-aware bucketing as the
-- migration's check_in_date backfill. Any group returned here would violate the
-- new UNIQUE (user_id, goal_id, check_in_date) index and must be de-duplicated
-- (keep the latest row per day) BEFORE the migration runs, or the index build
-- will fail and abort the migration.

-- Effective calendar day per row, identical to the migration + userCalendarDate:
--   valid non-empty profiles.timezone -> that zone; otherwise -> UTC.
WITH bucketed AS (
  SELECT
    gc.id,
    gc.user_id,
    gc.goal_id,
    gc.created_at,
    gc.notes,
    gc.progress_percentage,
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
    )::date AS check_in_day
  FROM public.goal_check_ins gc
  LEFT JOIN public.profiles p ON p.id = gc.user_id
)
SELECT
  user_id,
  goal_id,
  check_in_day,
  COUNT(*)                              AS duplicate_count,
  array_agg(id ORDER BY created_at)     AS row_ids,
  array_agg(created_at ORDER BY created_at) AS created_at_values,
  array_agg(progress_percentage ORDER BY created_at) AS progress_values,
  array_agg(notes ORDER BY created_at)  AS notes_values
FROM bucketed
GROUP BY user_id, goal_id, check_in_day
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, user_id, goal_id, check_in_day;

-- Summary counts (also read-only):
--   total rows, number of duplicate groups, total rows involved in duplicates.
WITH bucketed AS (
  SELECT
    gc.id,
    gc.user_id,
    gc.goal_id,
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
    )::date AS check_in_day
  FROM public.goal_check_ins gc
  LEFT JOIN public.profiles p ON p.id = gc.user_id
),
groups AS (
  SELECT user_id, goal_id, check_in_day, COUNT(*) AS c
  FROM bucketed
  GROUP BY user_id, goal_id, check_in_day
)
SELECT
  (SELECT COUNT(*) FROM public.goal_check_ins)          AS total_goal_check_in_rows,
  (SELECT COUNT(*) FROM groups WHERE c > 1)             AS duplicate_groups,
  (SELECT COALESCE(SUM(c), 0) FROM groups WHERE c > 1)  AS total_rows_in_duplicate_groups,
  (SELECT COALESCE(SUM(c - 1), 0) FROM groups WHERE c > 1) AS rows_to_remove_to_satisfy_index;
