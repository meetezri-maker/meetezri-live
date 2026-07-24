-- ============================================================================
-- READ-ONLY preflight for the billing subscription cleanup (Step 9 draft).
-- Contains SELECTs only. It does not modify, lock, or write any data.
-- Safe to run against any environment, including production.
--
-- The executable equivalent with safety assertions is:
--   scripts/billing-cleanup-dry-run.ts
-- This file exists so the same checks can be run manually from any SQL console.
-- ============================================================================

-- 1. Global shape ------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM subscriptions)                                                       AS total_rows,
  (SELECT COUNT(DISTINCT user_id) FROM subscriptions)                                        AS distinct_users,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'trial')                             AS trial_rows,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'trial' AND status = 'active')       AS active_trial_rows,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type <> 'trial')                            AS paid_rows,
  (SELECT COUNT(*) FROM subscriptions WHERE stripe_sub_id IS NOT NULL)                       AS rows_with_stripe_id,
  (SELECT COUNT(DISTINCT stripe_sub_id) FROM subscriptions WHERE stripe_sub_id IS NOT NULL)  AS distinct_stripe_ids,
  (SELECT COUNT(*) FROM subscriptions WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) = '') AS blank_stripe_ids,
  (SELECT COUNT(*) FROM subscriptions
     WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
       AND stripe_sub_id !~ '^sub_[A-Za-z0-9]+$')                                            AS malformed_stripe_ids,
  (SELECT COUNT(*) FROM subscriptions
     WHERE status = 'active' AND end_date IS NOT NULL AND end_date < now())                  AS stale_active_rows_out_of_scope;

-- 2. GATE — active-trial duplicates. Index A cannot be created while this is > 0.
SELECT user_id, COUNT(*) AS active_trials
FROM subscriptions
WHERE plan_type = 'trial' AND status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY active_trials DESC, user_id;

-- 3. GATE — duplicate stripe_sub_id. Index B cannot be created while this is > 0.
--    `users > 1` is a HARD BLOCKER: cross-user ownership is never resolved automatically.
--    `distinct_plans > 1` requires confirming the plan against Stripe before cleanup.
SELECT stripe_sub_id,
       COUNT(*)                    AS rows,
       COUNT(DISTINCT user_id)     AS users,
       COUNT(DISTINCT plan_type)   AS distinct_plans,
       COUNT(DISTINCT status)      AS distinct_statuses,
       (COUNT(DISTINCT user_id) > 1)   AS cross_user_blocker,
       (COUNT(DISTINCT plan_type) > 1) AS needs_stripe_confirmation
FROM subscriptions
WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
GROUP BY stripe_sub_id
HAVING COUNT(*) > 1
ORDER BY users DESC, rows DESC, stripe_sub_id;

-- 4. Proposed survivors — active trials.
--    Rule order: R1 stripe-linked, R2 bounded end_date, R3 oldest created_at, R5 row id.
--    `updated_at` is deliberately never consulted (it is application-clocked and some rows
--    have updated_at < created_at).
WITH ranked AS (
  SELECT s.id, s.user_id, s.created_at, s.end_date, s.stripe_sub_id,
         ROW_NUMBER() OVER (
           PARTITION BY s.user_id
           ORDER BY (s.stripe_sub_id IS NOT NULL) DESC,
                    (s.end_date IS NOT NULL) DESC,
                    s.created_at ASC,
                    s.id ASC) AS rn
  FROM subscriptions s
  WHERE s.plan_type = 'trial' AND s.status = 'active'
    AND s.user_id IN (SELECT user_id FROM subscriptions
                      WHERE plan_type = 'trial' AND status = 'active'
                      GROUP BY user_id HAVING COUNT(*) > 1)
)
SELECT user_id, id, created_at, end_date IS NOT NULL AS bounded,
       stripe_sub_id IS NOT NULL AS stripe_linked,
       CASE WHEN rn = 1 THEN 'SURVIVOR' ELSE 'archive+remove' END AS disposition
FROM ranked ORDER BY user_id, rn;

-- 5. Proposed survivors — duplicate stripe_sub_id, SAFE groups only
--    (single user AND single plan type). Everything else is manual review.
WITH safe_groups AS (
  SELECT stripe_sub_id FROM subscriptions
  WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
  GROUP BY stripe_sub_id
  HAVING COUNT(*) > 1 AND COUNT(DISTINCT user_id) = 1 AND COUNT(DISTINCT plan_type) = 1
), ranked AS (
  SELECT s.id, s.stripe_sub_id, s.user_id, s.plan_type, s.status, s.created_at,
         ROW_NUMBER() OVER (PARTITION BY s.stripe_sub_id ORDER BY s.created_at ASC, s.id ASC) AS rn
  FROM subscriptions s JOIN safe_groups g ON g.stripe_sub_id = s.stripe_sub_id
)
SELECT stripe_sub_id, id, user_id, plan_type, status, created_at,
       CASE WHEN rn = 1 THEN 'SURVIVOR' ELSE 'archive+remove' END AS disposition
FROM ranked ORDER BY stripe_sub_id, rn;

-- 6. Invariants that cleanup must NOT disturb.
SELECT
  (SELECT COUNT(*) FROM (
     SELECT user_id FROM subscriptions WHERE status = 'active' GROUP BY user_id
     HAVING COUNT(*) FILTER (WHERE plan_type = 'trial') >= 1
        AND COUNT(*) FILTER (WHERE plan_type <> 'trial') >= 1) t)  AS trial_paid_coexistence_users,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type <> 'trial')  AS paid_rows_must_be_unchanged,
  (SELECT COALESCE(SUM(credits), 0) FROM profiles)                 AS credits_checksum_must_be_unchanged,
  (SELECT COALESCE(SUM(credits_seconds), 0) FROM profiles)         AS credits_seconds_checksum_must_be_unchanged;

-- 7. Existing indexes — confirm neither target index already exists.
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'subscriptions'
ORDER BY indexname;
