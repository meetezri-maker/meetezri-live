-- ============================================================================
-- ██ DRAFT — NOT A MIGRATION. DO NOT APPLY. ██
--
-- This file is deliberately NOT under prisma/migrations/ so that
-- `prisma migrate deploy` cannot pick it up. It is the reviewable draft of the
-- Step 9 cleanup + constraint transaction, produced during the Step 8 dry run.
--
-- It has been executed ONLY against a throwaway local PostgreSQL 16 container
-- with synthetic fixtures, inside BEGIN … ROLLBACK. It has never run against
-- production.
--
-- PRECONDITIONS (all must hold at execution time, re-verified inside the txn):
--   1. `scripts/billing-cleanup-dry-run.ts` exits 0.
--   2. Zero cross-user duplicate stripe_sub_id groups.
--   3. Every duplicate stripe_sub_id group with conflicting plan_types has been
--      resolved manually against Stripe, or is excluded and index B is deferred.
--   4. A fresh backup / PITR restore point exists.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Serialise against concurrent writers for the duration of the cleanup.
--    SHARE ROW EXCLUSIVE blocks other writers and other DDL but still permits
--    reads, so `/users/me` and billing reads stay up. The table is ~296 kB, so
--    the whole transaction is expected to run in milliseconds.
--    NOTE: CREATE INDEX CONCURRENTLY is deliberately NOT used — it cannot run
--    inside a transaction, and at this table size it buys nothing while costing
--    the all-or-nothing guarantee.
-- ---------------------------------------------------------------------------
LOCK TABLE public.subscriptions IN SHARE ROW EXCLUSIVE MODE;

-- ---------------------------------------------------------------------------
-- 1. HARD GATE — abort immediately on any cross-user Stripe collision.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v int;
BEGIN
  SELECT COUNT(*) INTO v FROM (
    SELECT stripe_sub_id FROM public.subscriptions
    WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
    GROUP BY stripe_sub_id
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT user_id) > 1) t;
  IF v > 0 THEN
    RAISE EXCEPTION 'ABORT: % cross-user stripe_sub_id group(s) require manual review', v;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Archive table (see the Step 8 report for the full column rationale).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_cleanup_archive (
  archive_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_batch_id         uuid        NOT NULL,
  cleanup_category         text        NOT NULL,
  cleanup_reason           text        NOT NULL,
  archived_at              timestamptz NOT NULL DEFAULT timezone('utc', now()),
  original_subscription_id uuid        NOT NULL,
  survivor_subscription_id uuid        NOT NULL,
  user_id                  uuid        NOT NULL,
  plan_type                text,
  status                   text,
  stripe_sub_id            text,
  stripe_customer_id       text,
  start_date               timestamptz,
  end_date                 timestamptz,
  amount                   numeric(10,2),
  billing_cycle            text,
  original_created_at      timestamptz,
  original_updated_at      timestamptz,
  original_row             jsonb       NOT NULL
);
CREATE INDEX IF NOT EXISTS subscription_cleanup_archive_batch_idx ON public.subscription_cleanup_archive(cleanup_batch_id);
CREATE INDEX IF NOT EXISTS subscription_cleanup_archive_orig_idx  ON public.subscription_cleanup_archive(original_subscription_id);
CREATE INDEX IF NOT EXISTS subscription_cleanup_archive_user_idx  ON public.subscription_cleanup_archive(user_id);

-- ---------------------------------------------------------------------------
-- 3. Deterministic plans. No hardcoded ids; recomputed at execution time.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _batch AS SELECT gen_random_uuid() AS id;

CREATE TEMP TABLE _trial_removals AS
WITH ranked AS (
  SELECT s.id,
         FIRST_VALUE(s.id) OVER w AS survivor_id,
         ROW_NUMBER()       OVER w AS rn
  FROM public.subscriptions s
  WHERE s.plan_type = 'trial' AND s.status = 'active'
    AND s.user_id IN (SELECT user_id FROM public.subscriptions
                      WHERE plan_type = 'trial' AND status = 'active'
                      GROUP BY user_id HAVING COUNT(*) > 1)
  WINDOW w AS (PARTITION BY s.user_id
               ORDER BY (s.stripe_sub_id IS NOT NULL) DESC,  -- R1 stripe-linked wins
                        (s.end_date IS NOT NULL)      DESC,  -- R2 bounded wins
                        s.created_at ASC,                    -- R3 oldest wins
                        s.id ASC)                            -- R5 stable tiebreak
)
SELECT id, survivor_id FROM ranked WHERE rn > 1;

-- Groups where every row agrees on the plan: the oldest row wins outright.
CREATE TEMP TABLE _stripe_removals AS
WITH safe_groups AS (
  SELECT stripe_sub_id FROM public.subscriptions
  WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
  GROUP BY stripe_sub_id
  HAVING COUNT(*) > 1 AND COUNT(DISTINCT user_id) = 1 AND COUNT(DISTINCT plan_type) = 1
), ranked AS (
  SELECT s.id,
         FIRST_VALUE(s.id) OVER w AS survivor_id,
         ROW_NUMBER()       OVER w AS rn
  FROM public.subscriptions s
  JOIN safe_groups g ON g.stripe_sub_id = s.stripe_sub_id
  WINDOW w AS (PARTITION BY s.stripe_sub_id ORDER BY s.created_at ASC, s.id ASC)
)
SELECT id, survivor_id FROM ranked WHERE rn > 1;

-- ---------------------------------------------------------------------------
-- 3b. Conflicting-plan groups (Step 8B evidence).
--
-- Shape confirmed on all three production groups: two `active` rows agreeing on a plan and
-- carrying the authentic Stripe period start, plus one `incomplete` row of the OTHER plan
-- whose start_date equals its own updated_at — a later checkout intent that recycled the row
-- and kept a stale stripe_sub_id. Stripe cannot arbitrate: all three subscriptions return
-- 404 resource_missing.
--
-- Rule: an `incomplete` row was never an activated subscription, so it is never the plan
-- authority and its Stripe link is erroneous rather than duplicated. The live rows decide the
-- plan; surplus live rows are archived+removed; the intent row KEEPS its history and only has
-- its erroneous stripe_sub_id cleared.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _conflict_groups AS
SELECT stripe_sub_id
FROM public.subscriptions
WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
GROUP BY stripe_sub_id
HAVING COUNT(*) > 1
   AND COUNT(DISTINCT user_id) = 1
   AND COUNT(DISTINCT plan_type) > 1
   -- every row is either a live subscription or a checkout intent
   AND COUNT(*) FILTER (WHERE status IN ('active','trialing','past_due','incomplete','incomplete_expired')) = COUNT(*)
   -- at least one live row, and all live rows agree on the plan
   AND COUNT(*) FILTER (WHERE status IN ('active','trialing','past_due')) >= 1
   AND COUNT(DISTINCT plan_type) FILTER (WHERE status IN ('active','trialing','past_due')) = 1;

-- Surplus LIVE rows in a conflicting group are removed like any other duplicate.
INSERT INTO _stripe_removals (id, survivor_id)
WITH ranked AS (
  SELECT s.id,
         FIRST_VALUE(s.id) OVER w AS survivor_id,
         ROW_NUMBER()       OVER w AS rn
  FROM public.subscriptions s
  JOIN _conflict_groups g ON g.stripe_sub_id = s.stripe_sub_id
  WHERE s.status IN ('active','trialing','past_due')
  WINDOW w AS (PARTITION BY s.stripe_sub_id ORDER BY s.created_at ASC, s.id ASC)
)
SELECT id, survivor_id FROM ranked WHERE rn > 1;

-- Checkout-intent rows keep their history; only the stale link is cleared.
CREATE TEMP TABLE _stripe_link_clears AS
SELECT s.id,
       (SELECT l.id FROM public.subscriptions l
         WHERE l.stripe_sub_id = s.stripe_sub_id
           AND l.status IN ('active','trialing','past_due')
         ORDER BY l.created_at ASC, l.id ASC LIMIT 1) AS survivor_id
FROM public.subscriptions s
JOIN _conflict_groups g ON g.stripe_sub_id = s.stripe_sub_id
WHERE s.status IN ('incomplete','incomplete_expired');

-- Safety: a link-clear must never also be a removal, and must never be a live row.
DO $$
DECLARE v int;
BEGIN
  SELECT COUNT(*) INTO v FROM _stripe_link_clears c JOIN _stripe_removals r ON r.id = c.id;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % row(s) both cleared and removed', v; END IF;

  SELECT COUNT(*) INTO v FROM public.subscriptions s JOIN _stripe_link_clears c ON c.id = s.id
   WHERE s.status NOT IN ('incomplete','incomplete_expired');
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % link-clear target(s) are not checkout intents', v; END IF;
END $$;

-- Safety: a survivor must never appear in the removal set.
DO $$
DECLARE v int;
BEGIN
  SELECT COUNT(*) INTO v FROM (
    SELECT survivor_id FROM _trial_removals  INTERSECT SELECT id FROM _trial_removals
    UNION ALL
    SELECT survivor_id FROM _stripe_removals INTERSECT SELECT id FROM _stripe_removals) t;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % survivor(s) also marked for removal', v; END IF;
END $$;

-- Safety: the trial family must touch active trial rows only.
DO $$
DECLARE v int;
BEGIN
  SELECT COUNT(*) INTO v FROM public.subscriptions s JOIN _trial_removals r ON r.id = s.id
  WHERE s.plan_type <> 'trial' OR s.status <> 'active';
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: trial cleanup would touch % non-active-trial row(s)', v; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Archive BEFORE deleting.
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_cleanup_archive
  (cleanup_batch_id, cleanup_category, cleanup_reason, original_subscription_id, survivor_subscription_id,
   user_id, plan_type, status, stripe_sub_id, stripe_customer_id, start_date, end_date, amount,
   billing_cycle, original_created_at, original_updated_at, original_row)
SELECT (SELECT id FROM _batch), 'duplicate_active_trial', 'duplicate_active_trial',
       s.id, r.survivor_id, s.user_id, s.plan_type, s.status, s.stripe_sub_id, p.stripe_customer_id,
       s.start_date, s.end_date, s.amount, s.billing_cycle, s.created_at, s.updated_at, to_jsonb(s)
FROM public.subscriptions s
JOIN _trial_removals r ON r.id = s.id
LEFT JOIN public.profiles p ON p.id = s.user_id;

INSERT INTO public.subscription_cleanup_archive
  (cleanup_batch_id, cleanup_category, cleanup_reason, original_subscription_id, survivor_subscription_id,
   user_id, plan_type, status, stripe_sub_id, stripe_customer_id, start_date, end_date, amount,
   billing_cycle, original_created_at, original_updated_at, original_row)
SELECT (SELECT id FROM _batch), 'duplicate_stripe_sub_id', 'duplicate_stripe_sub_id',
       s.id, r.survivor_id, s.user_id, s.plan_type, s.status, s.stripe_sub_id, p.stripe_customer_id,
       s.start_date, s.end_date, s.amount, s.billing_cycle, s.created_at, s.updated_at, to_jsonb(s)
FROM public.subscriptions s
JOIN _stripe_removals r ON r.id = s.id
LEFT JOIN public.profiles p ON p.id = s.user_id;

-- Snapshot the link-clear rows too: they are modified, not deleted, and the snapshot is what
-- makes the modification reversible.
INSERT INTO public.subscription_cleanup_archive
  (cleanup_batch_id, cleanup_category, cleanup_reason, original_subscription_id, survivor_subscription_id,
   user_id, plan_type, status, stripe_sub_id, stripe_customer_id, start_date, end_date, amount,
   billing_cycle, original_created_at, original_updated_at, original_row)
SELECT (SELECT id FROM _batch), 'stale_checkout_intent_link_cleared',
       'erroneous_stripe_link_on_abandoned_checkout_intent',
       s.id, c.survivor_id, s.user_id, s.plan_type, s.status, s.stripe_sub_id, p.stripe_customer_id,
       s.start_date, s.end_date, s.amount, s.billing_cycle, s.created_at, s.updated_at, to_jsonb(s)
FROM public.subscriptions s
JOIN _stripe_link_clears c ON c.id = s.id
LEFT JOIN public.profiles p ON p.id = s.user_id;

DO $$
DECLARE arch int; planned int;
BEGIN
  SELECT COUNT(*) INTO arch FROM public.subscription_cleanup_archive
   WHERE cleanup_batch_id = (SELECT id FROM _batch);
  SELECT (SELECT COUNT(*) FROM _trial_removals)
       + (SELECT COUNT(*) FROM _stripe_removals)
       + (SELECT COUNT(*) FROM _stripe_link_clears) INTO planned;
  IF arch <> planned THEN
    RAISE EXCEPTION 'ABORT: archived % rows but planned to change %', arch, planned;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Delete ONLY rows that were archived in this batch.
-- ---------------------------------------------------------------------------
DELETE FROM public.subscriptions s
USING public.subscription_cleanup_archive a
WHERE a.original_subscription_id = s.id
  AND a.cleanup_batch_id = (SELECT id FROM _batch)
  AND a.cleanup_category IN ('duplicate_active_trial', 'duplicate_stripe_sub_id');

-- Clear the erroneous link on the abandoned checkout intents. The rows themselves stay.
UPDATE public.subscriptions s
SET stripe_sub_id = NULL
FROM _stripe_link_clears c
WHERE c.id = s.id;

-- ---------------------------------------------------------------------------
-- 6. Post-cleanup assertions.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v int;
BEGIN
  SELECT COUNT(*) INTO v FROM (SELECT user_id FROM public.subscriptions
    WHERE plan_type='trial' AND status='active' GROUP BY user_id HAVING COUNT(*) > 1) t;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % duplicate active-trial group(s) remain', v; END IF;

  SELECT COUNT(*) INTO v FROM (
    SELECT stripe_sub_id FROM public.subscriptions
    WHERE stripe_sub_id IS NOT NULL GROUP BY stripe_sub_id HAVING COUNT(*) > 1) t;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % duplicate stripe_sub_id group(s) remain', v; END IF;

  SELECT COUNT(*) INTO v FROM public.subscription_cleanup_archive a
   WHERE a.cleanup_batch_id = (SELECT id FROM _batch)
     AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = a.survivor_subscription_id);
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % archived row(s) point at a missing survivor', v; END IF;

  SELECT COUNT(*) INTO v FROM public.subscription_cleanup_archive a
   JOIN public.subscriptions s ON s.id = a.survivor_subscription_id
   WHERE a.cleanup_batch_id = (SELECT id FROM _batch) AND s.user_id <> a.user_id;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % archived row(s) cross a user boundary', v; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Constraints.
--    Index A is unconditional. Index B must be commented out unless every
--    conflicting-plan group has been resolved — otherwise it aborts the batch.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX subscriptions_one_active_trial_per_user
  ON public.subscriptions (user_id)
  WHERE plan_type = 'trial' AND status = 'active';

-- Unblocked by the Step 8B evidence resolution. `WHERE stripe_sub_id IS NOT NULL` is kept
-- explicit for documentation value; PostgreSQL already treats NULLs as distinct under a
-- unique index, so multiple unlinked rows remain legal either way (verified empirically).
CREATE UNIQUE INDEX subscriptions_stripe_sub_id_unique
  ON public.subscriptions (stripe_sub_id)
  WHERE stripe_sub_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. Final invariants. Compare against the values captured by the dry run.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.subscriptions)                                    AS total_rows_after,
  (SELECT COUNT(*) FROM public.subscriptions WHERE plan_type <> 'trial')         AS paid_rows_after,
  (SELECT COALESCE(SUM(credits), 0) FROM public.profiles)                        AS credits_checksum,
  (SELECT COALESCE(SUM(credits_seconds), 0) FROM public.profiles)                AS credits_seconds_checksum,
  (SELECT COUNT(*) FROM (SELECT user_id FROM public.subscriptions WHERE status='active'
     GROUP BY user_id
     HAVING COUNT(*) FILTER (WHERE plan_type='trial') >= 1
        AND COUNT(*) FILTER (WHERE plan_type<>'trial') >= 1) t)                  AS coexistence_users_after,
  (SELECT COUNT(*) FROM public.subscription_cleanup_archive
     WHERE cleanup_batch_id = (SELECT id FROM _batch))                           AS archived_rows;

-- Review the output above, THEN choose one:
-- COMMIT;
ROLLBACK;

-- ============================================================================
-- ROLLBACK AFTER COMMIT (if a problem is found later):
--   INSERT INTO public.subscriptions
--   SELECT (original_row ->> 'id')::uuid, ... -- restore from original_row jsonb
--   FROM public.subscription_cleanup_archive WHERE cleanup_batch_id = '<batch>';
--   DROP INDEX public.subscriptions_one_active_trial_per_user;
-- The jsonb snapshot preserves every column, so restoration is lossless.
-- ============================================================================
