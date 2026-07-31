# Billing Subscription Cleanup — Production Execution Report (Step 9A)

**Status: executed and accepted.** This migration mutated production data. It is recorded here
for audit and reversibility.

## Execution

| Field | Value |
|---|---|
| Executed (UTC) | 2026-07-27T20:44:12Z |
| Migration file | `apps/api/prisma/migrations/20260725120000_billing_subscription_cleanup_and_constraints/migration.sql` |
| Migration SHA-256 | `31db3eab3b650c1d3d09a0ba0c3bb4329cb050a078bba88c4f0b30040a4e5f5d` |
| Applied via | direct SQL, one atomic `BEGIN; …; COMMIT;` through the Supabase **session-mode** pooler. **NOT** `prisma migrate deploy` (production `_prisma_migrations` is out of sync — see note). |
| Cleanup batch ID | `4ab04577-1e5c-400e-9015-7c0679e06e82` |
| Pre-migration backup | `billing-preclean-public-20260727T202801Z.dump` (kept outside the repo) |
| Backup SHA-256 | `38c5195035318b7b0e0228d4366ce7ac9ef51a2b7b8ac429dfe8d2864247d3a6` |
| Backup verified | `pg_restore --list` OK; restored into throwaway PG17 with counts 401 / 200 / 127 / credits 55643 |

## Final values (actual, post-migration)

| Metric | Value |
|---|---|
| Total subscription rows | **333** |
| Trial rows / active trials | 148 / 147 |
| **Paid rows** | **185** |
| **Distinct paid Stripe subscriptions** | **126** |
| Distinct Stripe IDs (all) | 127 |
| Archive rows | **71** |
| Deleted rows | **68** (53 duplicate active trials + 15 duplicate Stripe rows) |
| Cleared stale Stripe links | **3** |
| Affected users | 37 (31 trial-family + 9 Stripe-family, 3 overlap) |
| Duplicate active-trial groups | 0 |
| Duplicate non-null Stripe-ID groups | 0 |
| Cross-user Stripe collisions | 0 |
| Coexistence (trial+paid) users | 21 |
| Credits / credits_seconds | 55643 / 3304082 (unchanged) |
| Purchased credits / seconds | 575 / 22500 (unchanged) |

## Constraints created

| Index | Valid | Unique |
|---|---|---|
| `subscriptions_one_active_trial_per_user` | yes | yes |
| `subscriptions_stripe_sub_id_unique` | yes | yes |

## Corrected paid-row invariant

The earlier Step 8 / 8B dry-run projection labeled paid rows as **"unchanged (200)"**. That was
inaccurate and internally inconsistent (148 trial + 200 paid ≠ 333 total). The Stripe dedup
**removes duplicate paid rows on purpose**, so the raw paid-row count legitimately dropped from
200 to 185.

The authoritative paid invariant is therefore **not** "paid row count unchanged" but:

> **No unique paid subscription or paid entitlement is lost.**

Proven on the committed production state:
- Distinct paid Stripe subscriptions unchanged at **126**.
- Distinct Stripe IDs unchanged at **127**.
- Every one of the 15 removed paid rows has a **same-user survivor carrying the same
  `stripe_sub_id`** (15/15).
- No paid entitlement lost, no user ownership changed, no paid row converted to trial.
- Credits, balances, purchased credits and allowance values unchanged.

Regression assertions enforcing this were added to `scripts/billing-cleanup-dry-run.ts`
(`distinct_paid_stripe_subscriptions_unchanged`,
`every_removed_paid_row_has_same_user_survivor_same_stripe_id`) and to
`scripts/verify-billing-subscription-cleanup.sql` (section 8). Both pass on production.

## Reversibility

- **Rollback script:** `scripts/rollback-billing-subscription-cleanup.sql` (batch
  `4ab04577-…`) — restores deleted rows from the archive JSONB snapshot and re-links the
  cleared Stripe ids; verified to restore byte-identical state in isolation.
- **Logical backup:** the pre-migration dump above.

## Deferred (not part of this task)

`_prisma_migrations` is out of sync with the repo migrations folder and was **not** repaired.
Production has not been managed by `prisma migrate deploy` since ~2026-04; later schema changes
were applied by another mechanism. A routine `prisma migrate deploy` would currently try to
apply several already-applied migrations and fail — reconciling this is separate follow-up work.

Also still deferred: production caller redirect / canonical activation (Step 10+), legacy
wrapper removal, cancellation `plan_type:'trial'` mislabel, the 222 stale-active rows,
entitlement ledger, and Stripe live-mode readiness.
