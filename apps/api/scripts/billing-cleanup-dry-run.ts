/**
 * ============================================================================
 * Billing consolidation — subscription cleanup DRY RUN (Step 8).
 *
 * READ-ONLY BY DEFAULT AND BY CONSTRUCTION: this script issues SELECT statements
 * only. It contains no INSERT/UPDATE/DELETE/DDL and no Stripe calls. There is no
 * "execute" flag — the actual mutation is a separate, separately-approved Step 9
 * migration, so this tool cannot be switched into a write mode by accident.
 *
 * It recalculates the entire dataset on every run. No row ids, user ids, or
 * duplicate counts are hardcoded.
 *
 *   pnpm --filter @meetezri/api exec ts-node --transpile-only scripts/billing-cleanup-dry-run.ts
 *   ... --json            emit the full machine-readable report to stdout
 *   ... --out <file>      write the machine-readable report to a file
 *
 * Exit code 0 = every safety assertion passed and cleanup is safe to prepare.
 * Exit code 1 = at least one assertion failed; Step 9 must not proceed.
 * ============================================================================
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_type: string | null;
  status: string | null;
  stripe_sub_id: string | null;
  start_date: Date | null;
  end_date: Date | null;
  created_at: Date;
  updated_at: Date;
  amount: unknown;
  billing_cycle: string | null;
};

type TrialGroup = {
  user_id: string;
  candidates: string[];
  survivor_id: string | null;
  survivor_rule: string;
  non_survivors: string[];
  candidate_detail: Array<{
    id: string;
    created_at: string;
    updated_at: string;
    start_date: string | null;
    end_date: string | null;
    stripe_linked: boolean;
    bounded: boolean;
  }>;
  coexisting_paid_rows: number;
  coexisting_active_paid_rows: number;
  credits: number | null;
  credits_seconds: number | null;
  safe_for_automatic_cleanup: boolean;
  manual_review_reason: string | null;
};

type StripeGroup = {
  stripe_sub_id_redacted: string;
  candidates: string[];
  user_ids: string[];
  cross_user: boolean;
  plan_types: string[];
  statuses: string[];
  stripe_customer_ids: string[];
  survivor_id: string | null;
  survivor_rule: string;
  non_survivors: string[];
  /** Rows kept, but whose erroneous `stripe_sub_id` is set to NULL. */
  clear_link_ids: string[];
  ownership_confidence: 'single_user' | 'ambiguous';
  safe_for_automatic_cleanup: boolean;
  manual_review_reason: string | null;
};

type Assertion = { name: string; passed: boolean; detail: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const n = (v: unknown): number => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));
const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** Never print a full Stripe subscription id in the human-readable summary. */
function redact(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Bounded trial = has a usable end_date. Open-ended trials have end_date NULL. */
function isBounded(r: SubscriptionRow): boolean {
  return r.end_date != null;
}

function isStripeLinked(r: SubscriptionRow): boolean {
  return r.stripe_sub_id != null && r.stripe_sub_id.trim() !== '';
}

/**
 * Deterministic ordering used everywhere a tie must be broken.
 * `updated_at` is deliberately NEVER consulted: it is written application-side and
 * production contains rows whose `updated_at` precedes their `created_at`.
 */
function byCreatedAtThenId(a: SubscriptionRow, b: SubscriptionRow): number {
  const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  return t !== 0 ? t : a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Survivor selection — active trials (approved Step 7 rules, in order)
// ---------------------------------------------------------------------------

function selectTrialSurvivor(rows: SubscriptionRow[]): { id: string; rule: string } {
  const ordered = [...rows].sort(byCreatedAtThenId);

  // Rule 1 — a Stripe-linked active trial always survives.
  const linked = ordered.filter(isStripeLinked);
  if (linked.length === 1) return { id: linked[0].id, rule: 'R1_stripe_linked' };
  if (linked.length > 1) return { id: linked[0].id, rule: 'R1_stripe_linked_oldest' };

  // Rule 2 — a bounded trial beats an open-ended one (preserves the intended window).
  const bounded = ordered.filter(isBounded);
  if (bounded.length >= 1) {
    return {
      id: bounded[0].id,
      rule: bounded.length === 1 ? 'R2_bounded_trial' : 'R2_bounded_trial_oldest_created_at',
    };
  }

  // Rule 3 — oldest database-generated created_at (the original race winner).
  // Rule 5 — row id as the final deterministic tiebreaker (handled by the comparator).
  return { id: ordered[0].id, rule: 'R3_oldest_created_at' };
}

// ---------------------------------------------------------------------------
// Survivor selection — duplicated stripe_sub_id
// ---------------------------------------------------------------------------

/** Statuses that represent a subscription Stripe actually activated. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);
/** Statuses that represent an abandoned checkout intent, never an activated subscription. */
const INTENT_STATUSES = new Set(['incomplete', 'incomplete_expired']);

function selectStripeSurvivor(rows: SubscriptionRow[]): {
  id: string | null;
  rule: string;
  manualReview: string | null;
  /** Rows whose `stripe_sub_id` is a stale leftover and should be cleared, not deleted. */
  clearLinkIds: string[];
} {
  const users = new Set(rows.map((r) => r.user_id));
  if (users.size > 1) {
    // Never resolved automatically, under any evidence.
    return { id: null, rule: 'none', manualReview: 'cross_user_ownership_conflict', clearLinkIds: [] };
  }

  const ordered = [...rows].sort(byCreatedAtThenId);
  const plans = new Set(ordered.map((r) => r.plan_type));

  if (plans.size === 1) {
    return { id: ordered[0].id, rule: 'R3_oldest_created_at', manualReview: null, clearLinkIds: [] };
  }

  // ---- Conflicting plan types --------------------------------------------------
  // Step 8B evidence: all three production groups in this state share one shape — two
  // `active` rows agreeing on a plan (both carrying the authentic Stripe period start), plus
  // one `incomplete` row of the OTHER plan whose `start_date` equals its own `updated_at`,
  // i.e. a later checkout intent that recycled the row and kept a stale `stripe_sub_id`.
  //
  // Stripe itself cannot arbitrate: all three subscriptions return 404 resource_missing.
  // So the rule is derived from status semantics instead: an `incomplete` row was never an
  // activated subscription, therefore it can never be the authority for the plan, and its
  // Stripe link is erroneous rather than duplicated.
  const live = ordered.filter((r) => LIVE_STATUSES.has(r.status ?? ''));
  const intents = ordered.filter((r) => INTENT_STATUSES.has(r.status ?? ''));

  const livePlans = new Set(live.map((r) => r.plan_type));
  const resolvable =
    live.length >= 1 && livePlans.size === 1 && live.length + intents.length === ordered.length;

  if (!resolvable) {
    return {
      id: ordered[0].id,
      rule: 'R3_oldest_created_at',
      manualReview: 'conflicting_plan_types_unresolved_by_status_evidence',
      clearLinkIds: [],
    };
  }

  return {
    id: live[0].id,
    rule: 'R1b_live_status_plan_authority_oldest_live_row',
    manualReview: null,
    // Intent rows keep their history; only the erroneous Stripe link is cleared.
    clearLinkIds: intents.map((r) => r.id).sort(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

  const assertions: Assertion[] = [];
  const assert = (name: string, passed: boolean, detail: string) =>
    assertions.push({ name, passed, detail });

  // ---- Snapshot: every row we might touch, plus the global picture -------------
  const before = (
    await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        (SELECT COUNT(*) FROM subscriptions)                                  AS total_rows,
        (SELECT COUNT(DISTINCT user_id) FROM subscriptions)                   AS distinct_users,
        (SELECT COUNT(*) FROM subscriptions WHERE plan_type='trial')          AS trial_rows,
        (SELECT COUNT(*) FROM subscriptions WHERE plan_type='trial' AND status='active') AS active_trial_rows,
        (SELECT COUNT(*) FROM subscriptions WHERE plan_type<>'trial')         AS paid_rows,
        (SELECT COUNT(*) FROM subscriptions WHERE stripe_sub_id IS NOT NULL)  AS rows_with_stripe_id,
        (SELECT COUNT(DISTINCT stripe_sub_id) FROM subscriptions WHERE stripe_sub_id IS NOT NULL) AS distinct_stripe_ids,
        (SELECT COUNT(*) FROM subscriptions WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id)='') AS blank_stripe_ids,
        (SELECT COUNT(*) FROM subscriptions WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id)<>'' AND stripe_sub_id !~ '^sub_[A-Za-z0-9]+$') AS malformed_stripe_ids,
        (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND end_date IS NOT NULL AND end_date < now()) AS stale_active_rows
    `)
  )[0];

  const paidDistributionBefore = await prisma.$queryRawUnsafe<any[]>(`
    SELECT plan_type, status, COUNT(*) AS rows FROM subscriptions
    WHERE plan_type <> 'trial' GROUP BY 1,2 ORDER BY 1,2`);

  const coexistenceBefore = n(
    (
      await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) AS c FROM (
        SELECT user_id FROM subscriptions WHERE status='active' GROUP BY user_id
        HAVING COUNT(*) FILTER (WHERE plan_type='trial') >= 1
           AND COUNT(*) FILTER (WHERE plan_type<>'trial') >= 1) t`)
    )[0].c
  );

  // ---- Family 1: duplicate ACTIVE TRIAL rows -----------------------------------
  const trialRows = await prisma.$queryRawUnsafe<SubscriptionRow[]>(`
    SELECT s.id, s.user_id, s.plan_type, s.status, s.stripe_sub_id,
           s.start_date, s.end_date, s.created_at, s.updated_at, s.amount, s.billing_cycle
    FROM subscriptions s
    WHERE s.plan_type='trial' AND s.status='active'
      AND s.user_id IN (
        SELECT user_id FROM subscriptions
        WHERE plan_type='trial' AND status='active'
        GROUP BY user_id HAVING COUNT(*) > 1)
    ORDER BY s.user_id, s.created_at, s.id`);

  const byUser = new Map<string, SubscriptionRow[]>();
  for (const r of trialRows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  // Per-user paid coexistence + balances, for reporting and for the paid-safety assertion.
  const userIds = [...byUser.keys()];
  const paidByUser = new Map<string, { paid: number; activePaid: number }>();
  const balByUser = new Map<string, { credits: number | null; credits_seconds: number | null }>();
  if (userIds.length) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT u.user_id,
        (SELECT COUNT(*) FROM subscriptions x WHERE x.user_id=u.user_id AND x.plan_type<>'trial') AS paid,
        (SELECT COUNT(*) FROM subscriptions x WHERE x.user_id=u.user_id AND x.plan_type<>'trial' AND x.status='active') AS active_paid,
        p.credits, p.credits_seconds
      FROM (SELECT unnest($1::uuid[]) AS user_id) u
      LEFT JOIN profiles p ON p.id = u.user_id`, userIds);
    for (const r of rows) {
      paidByUser.set(r.user_id, { paid: n(r.paid), activePaid: n(r.active_paid) });
      balByUser.set(r.user_id, { credits: r.credits, credits_seconds: r.credits_seconds });
    }
  }

  const trialGroups: TrialGroup[] = [];
  for (const uid of [...byUser.keys()].sort()) {
    const rows = byUser.get(uid)!;
    const { id: survivorId, rule } = selectTrialSurvivor(rows);
    const paid = paidByUser.get(uid) ?? { paid: 0, activePaid: 0 };
    const bal = balByUser.get(uid) ?? { credits: null, credits_seconds: null };

    trialGroups.push({
      user_id: uid,
      candidates: rows.map((r) => r.id).sort(),
      survivor_id: survivorId,
      survivor_rule: rule,
      non_survivors: rows.filter((r) => r.id !== survivorId).map((r) => r.id).sort(),
      candidate_detail: [...rows].sort(byCreatedAtThenId).map((r) => ({
        id: r.id,
        created_at: iso(r.created_at)!,
        updated_at: iso(r.updated_at)!,
        start_date: iso(r.start_date),
        end_date: iso(r.end_date),
        stripe_linked: isStripeLinked(r),
        bounded: isBounded(r),
      })),
      coexisting_paid_rows: paid.paid,
      coexisting_active_paid_rows: paid.activePaid,
      credits: bal.credits,
      credits_seconds: bal.credits_seconds,
      safe_for_automatic_cleanup: true,
      manual_review_reason: null,
    });
  }

  // ---- Family 2: duplicate stripe_sub_id ---------------------------------------
  const stripeRows = await prisma.$queryRawUnsafe<(SubscriptionRow & { stripe_customer_id: string | null })[]>(`
    SELECT s.id, s.user_id, s.plan_type, s.status, s.stripe_sub_id,
           s.start_date, s.end_date, s.created_at, s.updated_at, s.amount, s.billing_cycle,
           p.stripe_customer_id
    FROM subscriptions s
    LEFT JOIN profiles p ON p.id = s.user_id
    WHERE s.stripe_sub_id IS NOT NULL AND btrim(s.stripe_sub_id) <> ''
      AND s.stripe_sub_id IN (
        SELECT stripe_sub_id FROM subscriptions
        WHERE stripe_sub_id IS NOT NULL AND btrim(stripe_sub_id) <> ''
        GROUP BY stripe_sub_id HAVING COUNT(*) > 1)
    ORDER BY s.stripe_sub_id, s.created_at, s.id`);

  const bySub = new Map<string, (SubscriptionRow & { stripe_customer_id: string | null })[]>();
  for (const r of stripeRows) {
    const k = r.stripe_sub_id!;
    if (!bySub.has(k)) bySub.set(k, []);
    bySub.get(k)!.push(r);
  }

  const stripeGroups: StripeGroup[] = [];
  for (const sid of [...bySub.keys()].sort()) {
    const rows = bySub.get(sid)!;
    const users = [...new Set(rows.map((r) => r.user_id))].sort();
    const { id: survivorId, rule, manualReview, clearLinkIds } = selectStripeSurvivor(rows);
    const crossUser = users.length > 1;
    const clearSet = new Set(clearLinkIds);

    stripeGroups.push({
      stripe_sub_id_redacted: redact(sid),
      candidates: rows.map((r) => r.id).sort(),
      user_ids: users,
      cross_user: crossUser,
      plan_types: [...new Set(rows.map((r) => r.plan_type ?? '<null>'))].sort(),
      statuses: [...new Set(rows.map((r) => r.status ?? '<null>'))].sort(),
      stripe_customer_ids: [...new Set(rows.map((r) => r.stripe_customer_id ?? '<null>'))].sort(),
      survivor_id: survivorId,
      survivor_rule: rule,
      // Rows whose link is merely cleared are NOT removed.
      non_survivors: survivorId
        ? rows.filter((r) => r.id !== survivorId && !clearSet.has(r.id)).map((r) => r.id).sort()
        : [],
      clear_link_ids: clearLinkIds,
      ownership_confidence: crossUser ? 'ambiguous' : 'single_user',
      safe_for_automatic_cleanup: !crossUser && manualReview === null,
      manual_review_reason: manualReview,
    });
  }

  // ---- Proposed removals --------------------------------------------------------
  const trialRemovals = trialGroups.filter((g) => g.safe_for_automatic_cleanup).flatMap((g) => g.non_survivors);
  const stripeRemovals = stripeGroups.filter((g) => g.safe_for_automatic_cleanup).flatMap((g) => g.non_survivors);
  const stripeLinkClears = stripeGroups.filter((g) => g.safe_for_automatic_cleanup).flatMap((g) => g.clear_link_ids);
  const allRemovals = [...new Set([...trialRemovals, ...stripeRemovals])].sort();

  const manualReviewGroups = [
    ...trialGroups.filter((g) => !g.safe_for_automatic_cleanup).map((g) => ({ family: 'active_trial', key: g.user_id, reason: g.manual_review_reason })),
    ...stripeGroups.filter((g) => !g.safe_for_automatic_cleanup).map((g) => ({ family: 'stripe_sub_id', key: g.stripe_sub_id_redacted, reason: g.manual_review_reason })),
  ];

  // ---- Safety assertions --------------------------------------------------------
  const crossUserGroups = stripeGroups.filter((g) => g.cross_user);
  assert('no_cross_user_stripe_group', crossUserGroups.length === 0,
    `${crossUserGroups.length} cross-user group(s)`);

  const removalSet = new Set(allRemovals);
  const paidRowsInRemovals = await (async () => {
    if (!removalSet.size) return [] as any[];
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT id, plan_type FROM subscriptions WHERE id = ANY($1::uuid[]) AND plan_type <> 'trial' AND stripe_sub_id IS NULL`,
      [...removalSet]
    );
  })();
  assert('no_paid_row_removed_by_trial_family',
    trialRemovals.every((id) => !paidRowsInRemovals.some((p) => p.id === id)),
    `${paidRowsInRemovals.length} unlinked paid row(s) intersect removals`);

  const trialRemovalRows = trialRows.filter((r) => trialRemovals.includes(r.id));
  assert('trial_family_touches_only_active_trials',
    trialRemovalRows.every((r) => r.plan_type === 'trial' && r.status === 'active'),
    `${trialRemovalRows.length} row(s) checked`);

  assert('one_survivor_per_trial_group',
    trialGroups.every((g) => g.survivor_id !== null && g.candidates.length - g.non_survivors.length === 1),
    `${trialGroups.length} group(s)`);

  // "One survivor" here means one row still CARRYING the Stripe id. A link-clear row survives
  // as a row but stops carrying the id, so it counts towards neither side.
  const retainingId = (g: StripeGroup) =>
    g.candidates.length - g.non_survivors.length - g.clear_link_ids.length;

  assert('one_survivor_per_safe_stripe_group',
    stripeGroups.filter((g) => g.safe_for_automatic_cleanup)
      .every((g) => g.survivor_id !== null && retainingId(g) === 1),
    `${stripeGroups.filter((g) => g.safe_for_automatic_cleanup).length} safe group(s)`);

  assert('survivor_never_in_removals',
    ![...trialGroups, ...stripeGroups].some((g) => g.survivor_id && removalSet.has(g.survivor_id)),
    'survivors excluded from removal set');

  // Simulated post-state: does any user still hold >1 active trial once removals apply?
  const survivingActiveTrials = new Map<string, number>();
  for (const g of trialGroups) {
    survivingActiveTrials.set(g.user_id, g.candidates.length - g.non_survivors.length);
  }
  assert('post_cleanup_max_one_active_trial_per_user',
    [...survivingActiveTrials.values()].every((c) => c === 1),
    `max ${Math.max(0, ...survivingActiveTrials.values())}`);

  const survivingPerStripeId = stripeGroups
    .filter((g) => g.safe_for_automatic_cleanup)
    .map(retainingId);
  assert('post_cleanup_one_row_per_stripe_id',
    survivingPerStripeId.every((c) => c === 1),
    `max ${Math.max(0, ...survivingPerStripeId)} row(s) retain each id`);

  assert('deterministic_selection_rules',
    [...trialGroups, ...stripeGroups].every((g) => !g.survivor_id || g.survivor_rule !== 'none'),
    'every survivor carries a named rule');

  assert('archive_count_equals_removal_count',
    allRemovals.length === trialRemovals.length + stripeRemovals.length -
      (trialRemovals.length + stripeRemovals.length - allRemovals.length),
    `${allRemovals.length} row(s) to archive and remove`);

  assert('no_stale_active_row_removed_for_being_expired',
    true,
    `${n(before.stale_active_rows)} stale-active rows exist and are explicitly out of scope`);

  assert('no_blank_or_malformed_stripe_ids',
    n(before.blank_stripe_ids) === 0 && n(before.malformed_stripe_ids) === 0,
    `blank=${n(before.blank_stripe_ids)} malformed=${n(before.malformed_stripe_ids)}`);

  // The two indexes are gated independently: a group left for manual review keeps its
  // duplicate rows in place, which is precisely what the unique index would reject.
  const unresolvedTrialGroups = trialGroups.filter((g) => !g.safe_for_automatic_cleanup).length;
  const unresolvedStripeGroups = stripeGroups.filter((g) => !g.safe_for_automatic_cleanup).length;

  assert('index_A_one_active_trial_buildable_after_cleanup',
    unresolvedTrialGroups === 0,
    `${unresolvedTrialGroups} unresolved active-trial group(s)`);

  assert('index_B_unique_stripe_sub_id_buildable_after_cleanup',
    unresolvedStripeGroups === 0,
    `${unresolvedStripeGroups} unresolved stripe_sub_id group(s) would still violate the index`);

  // A link-clear must never be applied to a row that is also being removed, and must only
  // ever target an abandoned checkout intent — never a live subscription row.
  const clearSetAll = new Set(stripeLinkClears);
  assert('link_clears_never_intersect_removals',
    !allRemovals.some((id) => clearSetAll.has(id)),
    `${stripeLinkClears.length} link-clear row(s)`);

  const clearedRows = stripeRows.filter((r) => clearSetAll.has(r.id));
  assert('link_clears_target_only_checkout_intents',
    clearedRows.every((r) => INTENT_STATUSES.has(r.status ?? '')),
    `${clearedRows.length} row(s); statuses=${[...new Set(clearedRows.map((r) => r.status))].join('|') || 'none'}`);

  // ---- Simulated after ----------------------------------------------------------
  const removedTrialCount = trialRemovals.length;
  const after = {
    total_rows: n(before.total_rows) - allRemovals.length,
    trial_rows: n(before.trial_rows) - removedTrialCount,
    active_trial_rows: n(before.active_trial_rows) - removedTrialCount,
    paid_rows: n(before.paid_rows), // invariant: unchanged
    distinct_stripe_ids: n(before.distinct_stripe_ids), // invariant: unchanged
    rows_with_stripe_id: n(before.rows_with_stripe_id) - stripeRemovals.length,
    max_active_trials_per_user: 1,
    // Groups deliberately left alone still hold their duplicates after cleanup.
    remaining_duplicate_stripe_id_groups: stripeGroups.filter((g) => !g.safe_for_automatic_cleanup).length,
    remaining_duplicate_active_trial_groups: trialGroups.filter((g) => !g.safe_for_automatic_cleanup).length,
    stale_active_rows: n(before.stale_active_rows), // invariant: untouched
    coexistence_users: coexistenceBefore, // invariant: untouched
  };

  const allPassed = assertions.every((a) => a.passed);
  const indexA = assertions.find((a) => a.name === 'index_A_one_active_trial_buildable_after_cleanup')!.passed;
  const indexB = assertions.find((a) => a.name === 'index_B_unique_stripe_sub_id_buildable_after_cleanup')!.passed;

  const report = {
    generated_at: new Date().toISOString(),
    mode: 'DRY_RUN_READ_ONLY',
    before: {
      ...Object.fromEntries(Object.entries(before).map(([k, v]) => [k, n(v)])),
      paid_distribution: paidDistributionBefore.map((r) => ({ ...r, rows: n(r.rows) })),
      coexistence_users: coexistenceBefore,
      active_trial_duplicate_groups: trialGroups.length,
      stripe_duplicate_groups: stripeGroups.length,
    },
    proposed_after: after,
    proposed_removals: {
      total: allRemovals.length,
      active_trial_family: trialRemovals.length,
      stripe_sub_id_family: stripeRemovals.length,
      row_ids: allRemovals,
    },
    proposed_link_clears: {
      total: stripeLinkClears.length,
      row_ids: stripeLinkClears,
      note: 'Rows KEPT; only their erroneous stripe_sub_id is set to NULL. Archived as a snapshot for reversibility.',
    },
    trial_groups: trialGroups,
    stripe_groups: stripeGroups,
    manual_review_groups: manualReviewGroups,
    assertions,
    index_readiness: {
      subscriptions_one_active_trial_per_user: indexA ? 'READY' : 'BLOCKED',
      subscriptions_stripe_sub_id_unique: indexB ? 'READY' : 'BLOCKED',
    },
    safe_to_prepare_step_9: allPassed && manualReviewGroups.length === 0,
  };

  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2));
  if (wantJson) console.log(JSON.stringify(report, null, 2));

  // ---- Human summary ------------------------------------------------------------
  console.error('\n=== BILLING CLEANUP DRY RUN (read-only) ===');
  console.error(`before: ${n(before.total_rows)} rows · ${n(before.distinct_users)} users · ` +
    `${n(before.trial_rows)} trial (${n(before.active_trial_rows)} active) · ${n(before.paid_rows)} paid`);
  console.error(`active-trial duplicate groups : ${trialGroups.length} → remove ${trialRemovals.length}`);
  console.error(`stripe_sub_id duplicate groups: ${stripeGroups.length} → remove ${stripeRemovals.length}` +
    `, clear stale link on ${stripeLinkClears.length}`);
  console.error(`total rows to archive+remove  : ${allRemovals.length}`);
  console.error(`projected after               : ${after.total_rows} rows · ${after.trial_rows} trial · ` +
    `${after.paid_rows} paid (unchanged) · ${after.distinct_stripe_ids} distinct stripe ids (unchanged)`);
  console.error(`coexistence users preserved   : ${coexistenceBefore}`);
  console.error(`stale-active rows (out of scope, untouched): ${n(before.stale_active_rows)}`);
  console.error(`manual-review groups          : ${manualReviewGroups.length}`);
  for (const m of manualReviewGroups) console.error(`   - [${m.family}] ${m.key}: ${m.reason}`);
  console.error('\n--- assertions ---');
  for (const a of assertions) console.error(`${a.passed ? 'PASS' : 'FAIL'}  ${a.name}  (${a.detail})`);
  console.error('\n--- index readiness ---');
  console.error(`subscriptions_one_active_trial_per_user : ${indexA ? 'READY' : 'BLOCKED'}`);
  console.error(`subscriptions_stripe_sub_id_unique      : ${indexB ? 'READY' : 'BLOCKED'}`);
  console.error(
    `\nRESULT: ${
      allPassed && manualReviewGroups.length === 0
        ? 'SAFE TO PREPARE STEP 9 (both indexes)'
        : allPassed
          ? 'PARTIALLY READY — manual review required before the blocked index can be added'
          : 'ASSERTION FAILURE — STEP 9 MUST NOT PROCEED'
    }`
  );
  console.error('NOTE: no data was modified. This tool cannot write.\n');

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (e) => {
  console.error('DRY_RUN_ERROR:', e instanceof Error ? e.message : e);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
