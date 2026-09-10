import prisma, { type PrismaClientLike } from '../../../lib/prisma';
import { PLAN_LIMITS } from '../billing.constants';
import { isActiveTrialUniqueViolation as isActiveTrialConflict } from './subscription-constraints';

export const STANDARD_DISCOVER_TRIAL_DAYS = 7;
export const FOUNDING_MEMBER_DISCOVER_TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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
 * Sequential requests reuse the existing row. Concurrent first requests are protected by the
 * active-trial partial unique index and the race recovery below.
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
   * Trial window end. Omitted leaves an existing row untouched and omits the field on create.
   * Canonical Discover provisioning always supplies a bounded end date.
   */
  endDate?: Date;
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
        ...(endDate instanceof Date ? { end_date: endDate } : {}),
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
        ...(endDate instanceof Date ? { end_date: endDate } : {}),
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
export interface ProvisionDiscoverTrialOptions {
  billingCycle?: string;
  amount?: number;
  /** Injectable only so duration tests can assert exact timestamps. */
  startDate?: Date;
}

export interface ProvisionDiscoverTrialResult extends EnsureActiveTrialResult {
  foundingMember: boolean;
  trialDays: typeof STANDARD_DISCOVER_TRIAL_DAYS | typeof FOUNDING_MEMBER_DISCOVER_TRIAL_DAYS;
}

/**
 * Canonical Discover trial provisioning.
 *
 * Founding Members are identified solely by normalized email presence in `founding_members`.
 * Any historical trial row makes the operation a no-op: its dates and minute balance are left
 * untouched. This makes retries safe and intentionally does not repair legacy rows.
 */
export async function provisionDiscoverTrial(
  userId: string,
  email: string,
  options: ProvisionDiscoverTrialOptions = {},
  client: PrismaClientLike = prisma
): Promise<ProvisionDiscoverTrialResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const foundingMemberRow = normalizedEmail
    ? await client.founding_members.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })
    : null;
  const foundingMember = Boolean(foundingMemberRow);
  const trialDays = foundingMember
    ? FOUNDING_MEMBER_DISCOVER_TRIAL_DAYS
    : STANDARD_DISCOVER_TRIAL_DAYS;
  const startDate = options.startDate ?? new Date();

  const result = await ensureSingleActiveTrial(
    userId,
    {
      match: 'any_trial',
      billingCycle: options.billingCycle,
      amount: options.amount,
      startDate,
      endDate: new Date(startDate.getTime() + trialDays * DAY_MS),
      reshapeExisting: false,
    },
    client
  );

  if (result.created) {
    const trialCredits = PLAN_LIMITS.trial.credits;
    await client.profiles.update({
      where: { id: userId },
      data: {
        credits: trialCredits,
        credits_seconds: trialCredits * 60,
      },
    });
  }

  return { ...result, foundingMember, trialDays };
}
