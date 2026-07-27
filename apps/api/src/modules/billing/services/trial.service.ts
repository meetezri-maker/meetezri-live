import prisma, { type PrismaClientLike } from '../../../lib/prisma';
import { isActiveTrialUniqueViolation as isActiveTrialConflict } from './subscription-constraints';

/**
 * Canonical trial-row creation — plan §8A.4.
 *
 * Every automated writer that creates a trial subscription row delegates here, so the
 * active-trial invariant lives in exactly one place:
 *
 *   > A user may have at most one `active` trial subscription row.
 *
 * Historical `canceled`/expired trial rows remain valid history, and a paid row coexisting
 * with a single active trial row remains valid (21 production users are in exactly that state
 * after upgrading — `getSubscription` is newest-row-wins and correctly surfaces the paid row).
 *
 * SCOPE OF THE GUARANTEE: this is an application-level, SEQUENTIAL invariant. A repeated
 * request observes the row the previous one committed and reuses it. It is NOT concurrency-
 * safe: two simultaneous callers can still both miss the lookup and both create a row, because
 * `subscriptions` has no partial unique index on (user_id) WHERE plan_type='trial' AND
 * status='active' yet. That index is the real guarantee and lands with the approved cleanup
 * migration (plan §8A.3 Option A / §17 Gate 3b).
 */

/** How an existing row is matched before deciding to create a new one. */
export type TrialMatchMode =
  /** Any trial row, regardless of status. Preserves the signup writer's historical semantics. */
  | 'any_trial'
  /** Only an `active` trial row — the invariant's own scope. */
  | 'active_trial';

export interface EnsureActiveTrialOptions {
  /** Defaults to `'active_trial'`, the invariant's scope. */
  match?: TrialMatchMode;
  billingCycle?: string;
  /**
   * Trial window end. Pass a Date for a bounded trial, `null` for an open-ended one.
   * Omitted means "leave whatever the row already has" on reuse, and unset on create.
   */
  endDate?: Date | null;
  /** Written on create only; some callers record a zero amount explicitly. */
  amount?: number;
  /**
   * Start of the trial window, written on create. Pass it alongside a computed `endDate` so the
   * two are derived from the same instant — otherwise the window is off by the time between the
   * caller building `endDate` and the helper calling `new Date()`.
   */
  startDate?: Date;
  /**
   * When true, an existing matched row is updated to active-trial shape. When false the row is
   * returned untouched. Signup only needs existence; the billing endpoint re-asserts shape.
   */
  reshapeExisting?: boolean;
}

export interface EnsureActiveTrialResult {
  subscription: any;
  /** True when this call created the row; false when an existing row satisfied the invariant. */
  created: boolean;
  /** True when an existing row was found and updated rather than created. */
  reshaped: boolean;
  /**
   * True when this call lost the database race to a concurrent caller and returned that
   * caller's committed row. Only ever true once the partial unique index exists.
   */
  raceRecovered?: boolean;
}

// Constraint recognition lives in one place so both index predicates share a single parser.
// Re-exported here because existing callers and tests import them from this module.
export {
  ACTIVE_TRIAL_UNIQUE_INDEX,
  isActiveTrialUniqueViolation,
} from './subscription-constraints';

/**
 * Ensure the user has exactly one active trial row, creating it only when absent.
 *
 * Pass `client` to enlist in a caller-owned transaction; omitting it uses the Prisma singleton.
 * This function performs no Stripe calls, so it is safe to run inside a transaction.
 */
export async function ensureSingleActiveTrial(
  userId: string,
  options: EnsureActiveTrialOptions = {},
  client: PrismaClientLike = prisma
): Promise<EnsureActiveTrialResult> {
  const {
    match = 'active_trial',
    billingCycle = 'monthly',
    endDate,
    amount,
    startDate,
    reshapeExisting = false,
  } = options;

  const where =
    match === 'any_trial'
      ? { user_id: userId, plan_type: 'trial' }
      : { user_id: userId, plan_type: 'trial', status: 'active' };

  // Newest-row-wins, matching how `getSubscription` reads subscription state.
  const existing = await client.subscriptions.findFirst({
    where,
    orderBy: { created_at: 'desc' },
  });

  if (existing) {
    if (!reshapeExisting) {
      return { subscription: existing, created: false, reshaped: false };
    }

    const updated = await client.subscriptions.update({
      where: { id: existing.id },
      data: {
        plan_type: 'trial',
        status: 'active',
        billing_cycle: billingCycle,
        ...(amount !== undefined ? { amount } : {}),
        ...(endDate !== undefined ? { end_date: endDate } : {}),
      },
    });
    return { subscription: updated, created: false, reshaped: true };
  }

  try {
    const created = await client.subscriptions.create({
      data: {
        user_id: userId,
        plan_type: 'trial',
        status: 'active',
        billing_cycle: billingCycle,
        start_date: startDate ?? new Date(),
        ...(amount !== undefined ? { amount } : {}),
        ...(endDate !== undefined && endDate !== null ? { end_date: endDate } : {}),
      },
    });

    return { subscription: created, created: true, reshaped: false };
  } catch (error) {
    // Anything that is not specifically the active-trial index losing a race propagates.
    if (!isActiveTrialConflict(error)) throw error;

    // A concurrent caller committed first. Return their row rather than creating a second.
    //
    // CAVEAT — caller-supplied transactions: in PostgreSQL a unique violation aborts the
    // surrounding transaction, so this re-query can only succeed when the helper owns its own
    // connection (i.e. `client` is the singleton, which is how both production callers use it
    // today). A caller that passes a `tx` must handle the conflict at its own transaction
    // boundary and retry the whole transaction; the re-query below would otherwise fail with
    // "current transaction is aborted", and that error is deliberately allowed to propagate.
    const winner = await client.subscriptions.findFirst({
      where: { user_id: userId, plan_type: 'trial', status: 'active' },
      orderBy: { created_at: 'desc' },
    });

    // Losing the race but finding no winner means our understanding of the constraint is
    // wrong. Surface the original error rather than inventing a result.
    if (!winner) throw error;

    return { subscription: winner, created: false, reshaped: false, raceRecovered: true };
  }
}
