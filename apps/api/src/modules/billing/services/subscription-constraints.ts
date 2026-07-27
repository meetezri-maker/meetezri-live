/**
 * Recognition of the two partial unique indexes on `public.subscriptions`.
 *
 * HOW PRISMA REPORTS THESE — verified empirically against PostgreSQL 16 with the real indexes
 * in place (Step 8B). Prisma does **not** surface the index name; it surfaces the COLUMN LIST
 * of the violated index, plus the model:
 *
 *   subscriptions_one_active_trial_per_user  ->  { modelName: 'subscriptions', target: ['user_id'] }
 *   subscriptions_stripe_sub_id_unique       ->  { modelName: 'subscriptions', target: ['stripe_sub_id'] }
 *   subscriptions_pkey                       ->  { modelName: 'subscriptions', target: ['id'] }
 *
 * Each predicate below therefore matches one exact column list on the `subscriptions` model.
 * Every other `P2002` — a different model, a different column, a composite key, or a target
 * Prisma could not resolve — returns false so the caller rethrows. Swallowing those would hide
 * real defects, including primary-key collisions.
 *
 * The index-name comparison is retained as a secondary match in case a future Prisma version
 * begins reporting constraint names.
 */

export const ACTIVE_TRIAL_UNIQUE_INDEX = 'subscriptions_one_active_trial_per_user';
export const STRIPE_SUB_ID_UNIQUE_INDEX = 'subscriptions_stripe_sub_id_unique';

function matchesUniqueViolation(error: unknown, column: string, indexName: string): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code !== 'P2002') return false;

  const meta = (error as { meta?: { target?: unknown; modelName?: unknown } })?.meta;

  // When Prisma tells us the model, it must be `subscriptions`.
  if (typeof meta?.modelName === 'string' && meta.modelName !== 'subscriptions') return false;

  const target = meta?.target;

  if (Array.isArray(target)) {
    return (
      (target.length === 1 && target[0] === column) ||
      target.some((t) => typeof t === 'string' && t.includes(indexName))
    );
  }

  if (typeof target === 'string') {
    return target === column || target.includes(indexName);
  }

  return false;
}

/**
 * True only for `subscriptions_one_active_trial_per_user`.
 *
 * `['user_id']` identifies that index unambiguously because `user_id` alone keys no other
 * unique index on this table — the primary key reports `['id']` and the Stripe index reports
 * `['stripe_sub_id']`. If a migration ever adds another unique index keyed solely on
 * `user_id`, this predicate must be revisited; the assumption is guarded by tests.
 */
export function isActiveTrialUniqueViolation(error: unknown): boolean {
  return matchesUniqueViolation(error, 'user_id', ACTIVE_TRIAL_UNIQUE_INDEX);
}

/** True only for `subscriptions_stripe_sub_id_unique`. */
export function isStripeSubIdUniqueViolation(error: unknown): boolean {
  return matchesUniqueViolation(error, 'stripe_sub_id', STRIPE_SUB_ID_UNIQUE_INDEX);
}
