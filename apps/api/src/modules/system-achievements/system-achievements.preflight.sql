-- =============================================================================
-- System Achievements — READ-ONLY historical gap preflight (Phase 5, Part 7)
--
-- Run these BEFORE any backfill. Every statement is a SELECT: nothing is
-- mutated. Execute against a read replica where possible.
--
-- Catalog ids are the fixed uuids in system-achievements.constants.ts.
-- =============================================================================

-- 1. Current ledger composition (baseline: how many system rewards exist today).
--    Expected before any backfill: zero 'system_achievement_completion' rows.
SELECT source_type,
       COUNT(*)                AS ledger_rows,
       COUNT(DISTINCT user_id) AS users,
       SUM(points)             AS total_points
FROM public.point_transactions
GROUP BY source_type
ORDER BY ledger_rows DESC;

-- 2. Duplicate reward detection. The unique constraint
--    (user_id, source_type, source_item_id) should make this return 0 rows.
SELECT user_id, source_type, source_item_id, COUNT(*) AS duplicates
FROM public.point_transactions
GROUP BY user_id, source_type, source_item_id
HAVING COUNT(*) > 1;

-- 3. Dormant catalog / earned-state tables (are they already populated?).
SELECT (SELECT COUNT(*) FROM public.achievements)      AS catalog_rows,
       (SELECT COUNT(*) FROM public.user_achievements) AS user_earned_rows;

-- 4. Earned system achievements that have NO matching reward transaction.
--    These are the records a backfill would remediate.
SELECT ua.achievement_id,
       a.name,
       COUNT(*) AS users_missing_reward
FROM public.user_achievements ua
JOIN public.achievements a ON a.id = ua.achievement_id
LEFT JOIN public.point_transactions pt
       ON pt.user_id        = ua.user_id
      AND pt.source_item_id = ua.achievement_id
      AND pt.source_type    = 'system_achievement_completion'
WHERE pt.id IS NULL
GROUP BY ua.achievement_id, a.name
ORDER BY users_missing_reward DESC;

-- 5. RETROACTIVE IMPACT: how many users already satisfy each threshold today.
--    This is the population that WOULD be rewarded if the evaluator were run
--    over the existing user base. Review these counts before approving anything.
WITH metrics AS (
  SELECT p.id AS user_id,
         (SELECT COUNT(*) FROM public.app_sessions   s WHERE s.user_id = p.id) AS sessions,
         (SELECT COUNT(*) FROM public.mood_entries   m WHERE m.user_id = p.id) AS moods,
         (SELECT COUNT(*) FROM public.journal_entries j WHERE j.user_id = p.id) AS journals,
         (SELECT COUNT(*) FROM public.user_wellness_progress w WHERE w.user_id = p.id) AS wellness,
         (SELECT COUNT(*) FROM public.community_posts c
            WHERE c.user_id = p.id AND c.deleted_at IS NULL) AS community
  FROM public.profiles p
)
SELECT 'First Steps (sessions>=1, 10pts)'        AS achievement,
       COUNT(*) FILTER (WHERE sessions  >= 1)  AS users_qualifying,
       COUNT(*) FILTER (WHERE sessions  >= 1) * 10  AS points_if_awarded FROM metrics
UNION ALL SELECT 'Consistent Journey (sessions>=10, 50pts)',
       COUNT(*) FILTER (WHERE sessions  >= 10), COUNT(*) FILTER (WHERE sessions >= 10) * 50 FROM metrics
UNION ALL SELECT 'Mood Master (moods>=7, 25pts)',
       COUNT(*) FILTER (WHERE moods     >= 7),  COUNT(*) FILTER (WHERE moods    >= 7)  * 25 FROM metrics
UNION ALL SELECT 'Journaling Pro (journals>=20, 40pts)',
       COUNT(*) FILTER (WHERE journals  >= 20), COUNT(*) FILTER (WHERE journals >= 20) * 40 FROM metrics
UNION ALL SELECT 'Wellness Warrior (wellness>=5, 30pts)',
       COUNT(*) FILTER (WHERE wellness  >= 5),  COUNT(*) FILTER (WHERE wellness >= 5)  * 30 FROM metrics
UNION ALL SELECT 'Night Owl (wellness>=14, 35pts)',
       COUNT(*) FILTER (WHERE wellness  >= 14), COUNT(*) FILTER (WHERE wellness >= 14) * 35 FROM metrics
UNION ALL SELECT 'Community Contributor (posts>=3, 20pts)',
       COUNT(*) FILTER (WHERE community >= 3),  COUNT(*) FILTER (WHERE community >= 3) * 20 FROM metrics
ORDER BY users_qualifying DESC;
-- NOTE: 'Legendary Dedication' (30-day streak) is intentionally omitted here —
-- the streak is computed in application code (calculateStreak), not in SQL, so
-- it must be measured with the dry-run evaluator rather than a query.

-- 6. Total retroactive points exposure + resulting level movement.
--    Levels are derived (floor(total/100)+1), so this shows who would level up.
WITH current_totals AS (
  SELECT user_id, COALESCE(SUM(points), 0) AS total_points
  FROM public.point_transactions GROUP BY user_id
)
SELECT COUNT(*)                                   AS users_with_points,
       MIN(total_points)                          AS min_points,
       MAX(total_points)                          AS max_points,
       ROUND(AVG(total_points), 1)                AS avg_points,
       FLOOR(AVG(total_points) / 100) + 1         AS avg_level_today
FROM current_totals;
