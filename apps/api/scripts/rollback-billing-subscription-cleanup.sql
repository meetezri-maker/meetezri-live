-- ============================================================================
-- ROLLBACK for migration 20260725120000_billing_subscription_cleanup_and_constraints
--
-- Restores ONE cleanup batch from subscription_cleanup_archive and drops both unique
-- indexes. Fails closed: every gate RAISEs, aborting the whole transaction, so a partial
-- restoration is impossible.
--
-- USAGE: set the batch id below, run inside a transaction, review the output, then COMMIT.
--   \set batch '00000000-0000-0000-0000-000000000000'
--
-- Do NOT run this unless the migration actually needs reverting.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Pick the batch. Defaults to the most recent one if :batch is not supplied.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _rb AS
SELECT COALESCE(
         NULLIF(current_setting('rollback.batch_id', true), '')::uuid,
         (SELECT cleanup_batch_id FROM public.subscription_cleanup_archive
           ORDER BY archived_at DESC LIMIT 1)
       ) AS batch_id;

DO $$
DECLARE b uuid; n int;
BEGIN
  SELECT batch_id INTO b FROM _rb;
  IF b IS NULL THEN RAISE EXCEPTION 'ABORT: no cleanup batch found to roll back'; END IF;
  SELECT COUNT(*) INTO n FROM public.subscription_cleanup_archive WHERE cleanup_batch_id = b;
  IF n = 0 THEN RAISE EXCEPTION 'ABORT: batch % holds no archived rows', b; END IF;
  RAISE NOTICE 'rolling back batch % (% archived row(s))', b, n;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Drop the indexes FIRST. Restoring duplicates is the whole point of a rollback,
--    so the constraints must not be in the way.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.subscriptions_one_active_trial_per_user;
DROP INDEX IF EXISTS public.subscriptions_stripe_sub_id_unique;

-- ---------------------------------------------------------------------------
-- 2. Safety gates before any write.
-- ---------------------------------------------------------------------------
DO $$
DECLARE b uuid; v int;
BEGIN
  SELECT batch_id INTO b FROM _rb;

  -- A deleted row must not already exist (that would mean someone recreated it).
  SELECT COUNT(*) INTO v
    FROM public.subscription_cleanup_archive a
    JOIN public.subscriptions s ON s.id = a.original_subscription_id
   WHERE a.cleanup_batch_id = b
     AND a.cleanup_category IN ('duplicate_active_trial','duplicate_stripe_sub_id');
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % archived row(s) already exist; restore would duplicate', v; END IF;

  -- A link-clear row must still be present to receive its id back.
  SELECT COUNT(*) INTO v
    FROM public.subscription_cleanup_archive a
   WHERE a.cleanup_batch_id = b
     AND a.cleanup_category = 'stale_checkout_intent_link_cleared'
     AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = a.original_subscription_id);
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % link-clear row(s) no longer exist', v; END IF;

  -- The user must still exist, or the FK will reject the restore.
  SELECT COUNT(*) INTO v
    FROM public.subscription_cleanup_archive a
   WHERE a.cleanup_batch_id = b
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.user_id);
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % archived row(s) belong to a deleted profile', v; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Restore deleted rows verbatim from the JSONB snapshot.
--    Every column is taken from `original_row`, so the restore is lossless even if the
--    table has since gained columns the typed archive columns do not cover.
-- ---------------------------------------------------------------------------
INSERT INTO public.subscriptions (
  id, org_id, stripe_sub_id, status, created_at, amount, billing_cycle, end_date,
  next_billing_at, payment_method, plan_type, start_date, updated_at, user_id)
SELECT
  (a.original_row ->> 'id')::uuid,
  NULLIF(a.original_row ->> 'org_id','')::uuid,
  a.original_row ->> 'stripe_sub_id',
  a.original_row ->> 'status',
  (a.original_row ->> 'created_at')::timestamptz,
  NULLIF(a.original_row ->> 'amount','')::numeric,
  a.original_row ->> 'billing_cycle',
  NULLIF(a.original_row ->> 'end_date','')::timestamptz,
  NULLIF(a.original_row ->> 'next_billing_at','')::timestamptz,
  a.original_row ->> 'payment_method',
  a.original_row ->> 'plan_type',
  (a.original_row ->> 'start_date')::timestamptz,
  (a.original_row ->> 'updated_at')::timestamptz,
  (a.original_row ->> 'user_id')::uuid
FROM public.subscription_cleanup_archive a, _rb
WHERE a.cleanup_batch_id = _rb.batch_id
  AND a.cleanup_category IN ('duplicate_active_trial','duplicate_stripe_sub_id');

-- ---------------------------------------------------------------------------
-- 4. Restore cleared Stripe links.
-- ---------------------------------------------------------------------------
UPDATE public.subscriptions s
SET stripe_sub_id = a.stripe_sub_id
FROM public.subscription_cleanup_archive a, _rb
WHERE a.cleanup_batch_id = _rb.batch_id
  AND a.cleanup_category = 'stale_checkout_intent_link_cleared'
  AND s.id = a.original_subscription_id;

-- ---------------------------------------------------------------------------
-- 5. Verify the restore is complete before committing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE b uuid; missing int; unlinked int;
BEGIN
  SELECT batch_id INTO b FROM _rb;

  SELECT COUNT(*) INTO missing
    FROM public.subscription_cleanup_archive a
   WHERE a.cleanup_batch_id = b
     AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = a.original_subscription_id);
  IF missing > 0 THEN RAISE EXCEPTION 'ABORT: % archived row(s) were not restored', missing; END IF;

  SELECT COUNT(*) INTO unlinked
    FROM public.subscription_cleanup_archive a
    JOIN public.subscriptions s ON s.id = a.original_subscription_id
   WHERE a.cleanup_batch_id = b
     AND a.cleanup_category = 'stale_checkout_intent_link_cleared'
     AND s.stripe_sub_id IS DISTINCT FROM a.stripe_sub_id;
  IF unlinked > 0 THEN RAISE EXCEPTION 'ABORT: % stripe link(s) were not restored', unlinked; END IF;

  RAISE NOTICE 'rollback verified for batch %', b;
END $$;

SELECT
  (SELECT batch_id FROM _rb)                                              AS batch_id,
  (SELECT COUNT(*) FROM public.subscriptions)                             AS rows_after_restore,
  (SELECT COUNT(*) FROM public.subscription_cleanup_archive a, _rb
    WHERE a.cleanup_batch_id = _rb.batch_id)                              AS archived_rows_in_batch,
  (SELECT COALESCE(SUM(credits),0) FROM public.profiles)                  AS credits_checksum;

-- Review the output above, THEN choose one:
-- COMMIT;
ROLLBACK;
