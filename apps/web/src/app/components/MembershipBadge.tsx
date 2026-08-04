/**
 * MembershipBadge — the one component that renders a membership name or status.
 *
 * Every surface that used to print `plan.name` ("Core", "Pro") or a bare `plan_type` should use
 * this instead. Centralising it is what makes "zero customer-facing Core/Pro" enforceable rather
 * than aspirational: there is a single place that turns an internal plan value into words.
 *
 * Purely presentational — it never decides access. The backend entitlement engine remains the
 * only authority on what a member may do.
 */

import { cn } from '@/lib/utils';
import type { PlanTier } from '../utils/subscriptionPlans';
import {
  MEMBERSHIP_COPY,
  MEMBERSHIP_STATUS_COPY,
  membershipKeyForPlan,
  type MembershipKey,
  type MembershipStatusKey,
} from '../utils/membershipCopy';

/** Per-membership accent. Kept here so the three memberships look consistent everywhere. */
const MEMBERSHIP_STYLES: Record<MembershipKey, string> = {
  discover: 'border-slate-400/25 bg-slate-400/10 text-slate-200',
  grow: 'border-blue-400/30 bg-blue-400/10 text-blue-200',
  thrive: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
};

const STATUS_STYLES: Record<'neutral' | 'positive' | 'warning' | 'danger', string> = {
  neutral: 'border-white/10 bg-white/5 text-slate-300',
  positive: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  danger: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
};

export interface MembershipBadgeProps {
  /**
   * Internal plan value straight from the API (`profile.subscription_plan`, `plan_type`).
   * Mapping to customer wording happens inside — callers never do it themselves.
   */
  plan?: PlanTier | string | null;
  /** Use when the membership key is already known. Takes precedence over `plan`. */
  membership?: MembershipKey;
  /** Renders a status pill alongside the name. */
  status?: MembershipStatusKey;
  /** Appends "Membership" — for headings rather than inline chips. */
  showFullName?: boolean;
  /** Marks this as the member's own current membership. */
  current?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function MembershipBadge({
  plan,
  membership,
  status,
  showFullName = false,
  current = false,
  size = 'md',
  className,
}: MembershipBadgeProps) {
  const key = membership ?? membershipKeyForPlan(plan);
  const copy = MEMBERSHIP_COPY[key];
  const statusCopy = status ? MEMBERSHIP_STATUS_COPY[status] : null;

  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full border font-medium tracking-tight',
          sizing,
          MEMBERSHIP_STYLES[key]
        )}
      >
        {showFullName ? copy.fullName : copy.name}
      </span>

      {current && (
        <span
          className={cn(
            'inline-flex items-center rounded-full border font-medium tracking-tight',
            sizing,
            STATUS_STYLES.neutral
          )}
        >
          Current
        </span>
      )}

      {statusCopy && (
        // The neutral "Active" pill is noise next to a membership name that already implies it.
        statusCopy.tone !== 'neutral' && (
          <span
            className={cn(
              'inline-flex items-center rounded-full border font-medium tracking-tight',
              sizing,
              STATUS_STYLES[statusCopy.tone]
            )}
            title={statusCopy.description}
          >
            {statusCopy.label}
          </span>
        )
      )}
    </span>
  );
}

/**
 * Derive the status a badge should show from the fields `/users/me` already returns.
 *
 * Deliberately mirrors the backend resolver's precedence — expiry first, then cancellation, then
 * payment trouble — so the badge cannot contradict what the engine decided.
 */
export function membershipStatusFromProfile(input: {
  planType?: string | null;
  subscriptionStatus?: string | null;
  endDate?: string | Date | null;
  now?: Date;
}): MembershipStatusKey {
  const { planType, subscriptionStatus, endDate } = input;
  const now = input.now ?? new Date();

  const status = (subscriptionStatus ?? '').trim().toLowerCase();
  const end = endDate ? new Date(endDate) : null;
  const ended = end instanceof Date && !Number.isNaN(end.getTime()) && end < now;

  if (status === 'past_due') return 'past_due';

  if (status === 'canceled' || status === 'cancelled') {
    return ended ? 'expired' : 'canceled_in_period';
  }

  // Live-row expiry applies to Discover only, matching the backend rule that a paid row with a
  // stale end date is webhook drift rather than a lapse.
  const isDiscover = membershipKeyForPlan(planType) === 'discover';
  if (ended && isDiscover) return 'expired';

  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  return 'none';
}
