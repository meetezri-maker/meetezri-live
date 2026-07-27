-- ============================================================================
-- READ-ONLY post-migration verification for
-- 20260725120000_billing_subscription_cleanup_and_constraints.
-- Run immediately after the migration. SELECTs only.
-- ============================================================================

-- 1. Shape --------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM subscriptions)                                       AS total_rows,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type='trial')               AS trial_rows,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type='trial' AND status='active') AS active_trial_rows,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_type<>'trial')              AS paid_rows,
  (SELECT COUNT(DISTINCT stripe_sub_id) FROM subscriptions WHERE stripe_sub_id IS NOT NULL) AS distinct_stripe_ids,
  (SELECT COUNT(DISTINCT user_id) FROM subscriptions)                        AS affected_users,
  (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND end_date IS NOT NULL AND end_date < now()) AS stale_active_rows,
  (SELECT COUNT(*) FROM profiles WHERE stripe_customer_id IS NOT NULL)       AS profiles_with_stripe_customer,
  (SELECT COUNT(*) FROM stripe_webhook_events)                               AS webhook_events;

-- 2. GATE conditions — every value here MUST be zero ---------------------------
SELECT
  (SELECT COUNT(*) FROM (SELECT user_id FROM subscriptions WHERE plan_type='trial' AND status='active'
     GROUP BY user_id HAVING COUNT(*)>1) t)                                  AS duplicate_active_trial_groups,
  (SELECT COUNT(*) FROM (SELECT stripe_sub_id FROM subscriptions WHERE stripe_sub_id IS NOT NULL
     GROUP BY stripe_sub_id HAVING COUNT(*)>1) t)                            AS duplicate_stripe_id_groups,
  (SELECT COUNT(*) FROM (SELECT stripe_sub_id FROM subscriptions WHERE stripe_sub_id IS NOT NULL
     GROUP BY stripe_sub_id HAVING COUNT(DISTINCT user_id)>1) t)            AS cross_user_stripe_collisions,
  (SELECT COALESCE(MAX(c),0) FROM (SELECT COUNT(*) c FROM subscriptions
     WHERE plan_type='trial' AND status='active' GROUP BY user_id) t)       AS max_active_trials_per_user;

-- 3. Archive ------------------------------------------------------------------
SELECT cleanup_category, COUNT(*) AS rows
FROM subscription_cleanup_archive GROUP BY 1 ORDER BY 1;

SELECT COUNT(DISTINCT cleanup_batch_id) AS batches,
       COUNT(*) AS archived_rows,
       COUNT(*) FILTER (WHERE NOT EXISTS
         (SELECT 1 FROM subscriptions s WHERE s.id = a.survivor_subscription_id)) AS archived_with_missing_survivor,
       COUNT(*) FILTER (WHERE EXISTS
         (SELECT 1 FROM subscriptions s WHERE s.id = a.survivor_subscription_id AND s.user_id <> a.user_id)) AS archived_crossing_user
FROM subscription_cleanup_archive a;

-- 4. Indexes exist and are valid ----------------------------------------------
SELECT i.relname AS index_name, idx.indisvalid AS is_valid, idx.indisunique AS is_unique
FROM pg_index idx JOIN pg_class i ON i.oid = idx.indexrelid
WHERE i.relname IN ('subscriptions_one_active_trial_per_user','subscriptions_stripe_sub_id_unique')
ORDER BY 1;

-- 5. Coexistence preserved ----------------------------------------------------
SELECT COUNT(*) AS trial_plus_paid_coexistence_users FROM (
  SELECT user_id FROM subscriptions WHERE status='active' GROUP BY user_id
  HAVING COUNT(*) FILTER (WHERE plan_type='trial') >= 1
     AND COUNT(*) FILTER (WHERE plan_type<>'trial') >= 1) t;

-- 6. Paid plan distribution (compare to the pre-migration snapshot) ------------
SELECT plan_type, status, COUNT(*) AS rows
FROM subscriptions WHERE plan_type<>'trial' GROUP BY 1,2 ORDER BY 1,2;

-- 7. Balance checksums (must equal the pre-migration values) -------------------
SELECT COALESCE(SUM(credits),0)                   AS credits_checksum,
       COALESCE(SUM(credits_seconds),0)           AS credits_seconds_checksum,
       COALESCE(SUM(purchased_credits),0)         AS purchased_credits_checksum,
       COALESCE(SUM(purchased_credits_seconds),0) AS purchased_credits_seconds_checksum
FROM profiles;
