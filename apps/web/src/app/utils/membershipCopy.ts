/**
 * Membership copy — the single source of customer-facing membership language.
 *
 * =========================================================================================
 * WHAT BELONGS HERE / WHAT DOES NOT
 * =========================================================================================
 *
 *   HERE      membership names, descriptions, status labels, CTA labels, restriction and
 *             upgrade messaging — anything a member reads.
 *
 *   NOT HERE  prices, minute allowances, Stripe price IDs, PAYG rates  -> `subscriptionPlans.ts`
 *             and the backend's `billing.constants.ts` remain the financial authority.
 *
 *   NOT HERE  who is allowed to do what -> the backend entitlement engine is the only
 *             authority. Nothing in this file grants or denies access; it only names things.
 *
 * =========================================================================================
 * INTERNAL vs CUSTOMER VOCABULARY
 * =========================================================================================
 *
 * The database, Stripe, and every API contract speak `trial` / `core` / `pro`. Customers read
 * Discover / Grow / Thrive. `MEMBERSHIP_BY_PLAN` is the ONLY place the two meet on the frontend —
 * mirroring `INTERNAL_PLAN_TO_MEMBERSHIP` in the backend entitlement engine.
 *
 * Never render a `PlanTier` directly. Always map through here.
 */

import type { PlanTier } from './subscriptionPlans';

export type MembershipKey = 'discover' | 'grow' | 'thrive';

/** Lifecycle states a member can be shown. Mirrors the backend's `MembershipStatus`. */
export type MembershipStatusKey =
  | 'active'
  | 'trialing'
  | 'expired'
  | 'canceled_in_period'
  | 'past_due'
  | 'none';

// ---------------------------------------------------------------------------
// Internal plan -> customer membership
// ---------------------------------------------------------------------------

/** The one mapping point. `trial`/`core`/`pro` never leave this module as customer text. */
export const MEMBERSHIP_BY_PLAN: Readonly<Record<PlanTier, MembershipKey>> = {
  trial: 'discover',
  core: 'grow',
  pro: 'thrive',
};

/**
 * Map a membership value returned by the entitlement API (`DISCOVER` / `GROW` / `THRIVE`) to a
 * copy key.
 *
 * Distinct from `membershipKeyForPlan`, which maps the internal BILLING values
 * (`trial`/`core`/`pro`). The API speaks both vocabularies in different places — entitlement
 * errors use membership names, `/users/me` uses `subscription_plan` — so keeping the two mappings
 * separate avoids one silently accepting the other's input.
 *
 * Returns `null` for anything unrecognised so callers can decide, rather than defaulting to a
 * membership the server never mentioned.
 */
export function membershipKeyForApiValue(value: unknown): MembershipKey | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized === 'discover' || normalized === 'grow' || normalized === 'thrive'
    ? (normalized as MembershipKey)
    : null;
}

export function membershipKeyForPlan(plan: PlanTier | string | null | undefined): MembershipKey {
  if (typeof plan !== 'string') return 'discover';
  const key = MEMBERSHIP_BY_PLAN[plan.trim().toLowerCase() as PlanTier];
  // Unknown values resolve to Discover, matching the backend resolver's safe default.
  return key ?? 'discover';
}

// ---------------------------------------------------------------------------
// Membership identity
// ---------------------------------------------------------------------------

export interface MembershipCopy {
  /** "Discover" — the name on its own. */
  name: string;
  /** "Discover Membership" — for headings and confirmations. */
  fullName: string;
  /** One line describing who it is for. */
  tagline: string;
  /** What this membership includes. Every line must be true of the shipped product. */
  includes: string[];
  /**
   * What it does not include. Stated as a plain fact, never as a taunt.
   * Empty for the top membership — "nothing missing" reads better than a list of nothings.
   */
  notIncluded: string[];
}

/**
 * TRUTHFULNESS NOTE — every `includes` line below was verified against shipped code, not against
 * the previous marketing copy. Where the two disagreed, the code won.
 *
 * Specifically: Journal, Mood History, Wellness Tools, Progress and Session History are gated to
 * paid memberships IN THE FRONTEND today (see the `subscription_plan === 'trial'` guards on those
 * pages). The backend does not enforce it, but the shipped experience does, so Discover's
 * `notIncluded` reflects what a member actually encounters.
 */
export const MEMBERSHIP_COPY: Readonly<Record<MembershipKey, MembershipCopy>> = {
  discover: {
    name: 'Discover',
    fullName: 'Discover Membership',
    tagline: 'Try Solace and see how it feels — no card needed.',
    includes: [
      '30 Talk It Out minutes',
      'Daily mood check-ins',
      'Community access',
      'One active challenge',
      'Safety detection and crisis resources',
    ],
    notIncluded: [
      'Monthly minutes',
      'Additional minute top-ups',
      'Journalling',
      'Mood history and trends',
      'Wellness tool library',
      'Progress and session history',
    ],
  },
  grow: {
    name: 'Grow',
    fullName: 'Grow Membership',
    tagline: 'The everyday membership — room to build a real routine.',
    includes: [
      '200 Talk It Out minutes each month',
      'Top up minutes anytime',
      'Unlimited journalling, with PDF and JSON export',
      'Mood history and trends',
      'Wellness tool library',
      'Progress and session history',
      'Up to 3 active challenges',
      'Avatar customisation',
    ],
    notIncluded: ['Unlimited active challenges'],
  },
  thrive: {
    name: 'Thrive',
    fullName: 'Thrive Membership',
    tagline: 'The deepest membership — the most time and the most room.',
    includes: [
      '400 Talk It Out minutes each month',
      'Top up minutes anytime',
      'Everything in Grow',
      'Unlimited active challenges',
      'Longer uninterrupted sessions',
    ],
    // Kept deliberately: these are safety boundaries, and stating them plainly matters more
    // than a tidy feature grid.
    notIncluded: ['Unlimited usage', 'Human intervention', 'Emergency service calling'],
  },
};

// ---------------------------------------------------------------------------
// Status labels
// ---------------------------------------------------------------------------

export interface MembershipStatusCopy {
  label: string;
  /** Short explanation; omitted where the label already says everything. */
  description?: string;
  tone: 'neutral' | 'positive' | 'warning' | 'danger';
}

export const MEMBERSHIP_STATUS_COPY: Readonly<Record<MembershipStatusKey, MembershipStatusCopy>> = {
  active: { label: 'Active', tone: 'positive' },
  trialing: { label: 'Active', tone: 'positive' },
  none: { label: 'Active', tone: 'neutral' },
  expired: {
    label: 'Ended',
    description: 'Your Discover membership has ended.',
    tone: 'danger',
  },
  canceled_in_period: {
    label: 'Cancelling',
    description: 'You keep full access until your paid period ends.',
    tone: 'warning',
  },
  past_due: {
    label: 'Payment due',
    description: "We couldn't process your last payment. Your membership is still active.",
    tone: 'warning',
  },
};

// ---------------------------------------------------------------------------
// Shared labels
// ---------------------------------------------------------------------------

/**
 * "Subscription" is retained ONLY where it is the financially or legally accurate word —
 * recurring payment, cancellation, billing history. Everywhere else the product says
 * "membership".
 */
export const MEMBERSHIP_LABELS = {
  membership: 'Membership',
  memberships: 'Memberships',
  currentMembership: 'Current Membership',
  yourMembership: 'Your Membership',
  changeMembership: 'Change membership',
  upgradeMembership: 'Upgrade membership',
  manageMembership: 'Manage membership',
  compareMemberships: 'Compare memberships',
  // Deliberately still "subscription": this is the recurring-payment agreement.
  cancelSubscription: 'Cancel subscription',
  billingHistory: 'Billing history',
  renewsOn: 'Renews on',
  paidPeriodEnds: 'Access ends',
  includedMinutes: 'Included Talk It Out minutes',
  additionalMinutes: 'Additional minutes',
  addMinutes: 'Add minutes',
  minutesRemaining: 'Minutes remaining',
} as const;

// ---------------------------------------------------------------------------
// Restriction and upgrade messaging
// ---------------------------------------------------------------------------

export interface RestrictionCopy {
  title: string;
  body: string;
  cta: string;
}

/** The membership a given one upgrades to, or null at the top. */
export function nextMembership(current: MembershipKey): MembershipKey | null {
  if (current === 'discover') return 'grow';
  if (current === 'grow') return 'thrive';
  return null;
}

/**
 * A feature that is available on paid memberships but not on Discover.
 *
 * Used by the page-level guards on Journal, Mood History, Wellness Tools, Progress and Session
 * History so all five read consistently instead of each inventing its own wording.
 */
export function paidFeatureRestriction(featureName: string): RestrictionCopy {
  return {
    title: `${featureName} is part of Grow`,
    body: `Upgrade to Grow or Thrive to unlock ${featureName.toLowerCase()}. Everything you have already saved stays exactly where it is.`,
    cta: MEMBERSHIP_LABELS.upgradeMembership,
  };
}

/**
 * Active-challenge limit reached.
 *
 * Values come from the backend `ACTIVE_CHALLENGE_LIMIT_REACHED` response — membership, limit,
 * current count and upgrade target are all returned by the API, so nothing here is guessed.
 */
export function challengeLimitRestriction(input: {
  membership: MembershipKey;
  limit: number;
  upgradeTo: MembershipKey | null;
}): RestrictionCopy {
  const { limit, upgradeTo } = input;
  const noun = limit === 1 ? 'challenge' : 'challenges';

  const upgradeHint = upgradeTo
    ? ` ${MEMBERSHIP_COPY[upgradeTo].name} includes ${
        MEMBERSHIP_COPY[upgradeTo].name === 'Thrive' ? 'unlimited challenges' : '3'
      }.`
    : '';

  return {
    title: 'Challenge limit reached',
    body: `You can have ${limit} active ${noun} at a time. Finish or leave one to start another.${upgradeHint}`,
    cta: upgradeTo ? MEMBERSHIP_LABELS.upgradeMembership : 'View challenges',
  };
}

/** Discover cannot buy additional minutes. */
export const PAYG_RESTRICTION: RestrictionCopy = {
  title: 'Adding minutes needs a paid membership',
  body: 'Grow and Thrive let you top up minutes whenever you run low. Discover includes a fixed 30 minutes.',
  cta: MEMBERSHIP_LABELS.upgradeMembership,
};

/**
 * Discover has ended.
 *
 * Wording is constrained by the approved policy: conversations stop, the member keeps one active
 * challenge, and NOTHING is deleted. The reassurance is not a nicety — implying data loss would
 * misrepresent what the backend does.
 */
export const EXPIRED_DISCOVER_COPY = {
  title: 'Your Discover membership has ended',
  body: 'Talk It Out conversations are paused, and you can no longer add minutes.',
  retained: [
    'Everything you have saved stays — journals, moods, sleep and check-ins',
    'Your active challenge stays active',
    'Community access continues',
  ],
  reassurance: 'Nothing is deleted. Upgrading picks up exactly where you left off.',
  cta: MEMBERSHIP_LABELS.upgradeMembership,
} as const;

/** Minutes exhausted. Distinct from expiry — different cause, different fix. */
export function noMinutesRestriction(membership: MembershipKey): RestrictionCopy {
  return membership === 'discover'
    ? {
        title: "You've used your Discover minutes",
        body: 'Upgrade to Grow for 200 minutes a month, and the option to top up whenever you need more.',
        cta: MEMBERSHIP_LABELS.upgradeMembership,
      }
    : {
        title: 'No minutes remaining',
        body: 'Add minutes to keep talking, or wait for your next monthly refresh.',
        cta: MEMBERSHIP_LABELS.addMinutes,
      };
}

/** Past-due. Access is retained today, so the tone is a nudge, not a threat. */
export const PAST_DUE_COPY: RestrictionCopy = {
  title: "We couldn't process your payment",
  body: 'Your membership is still active. Update your payment method to avoid interruption.',
  cta: 'Update payment method',
};
