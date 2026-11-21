import {
  getMembershipEntitlements,
  getPolicyStatus,
  type MembershipEntitlements,
  type MembershipStatus,
  type MembershipTier,
} from '../entitlements';

/**
 * Text chat — subscription eligibility and daily allowance (Phase 5).
 *
 * REUSES THE ENTITLEMENT ENGINE. Membership and status come only from `getMembershipEntitlements`
 * (the repository rule: no feature module reads `plan_type` or `subscriptions`). That engine maps
 * plan types to tiers — trial -> DISCOVER, core -> GROW, pro -> THRIVE — so "active trial" and
 * "Discover" are the SAME tier here and cannot carry different limits.
 *
 * NEVER ACTIVE BY ACCIDENT. Two independent switches must both say yes before anyone is blocked:
 *   1. `CONVERSATIONS_ENTITLEMENTS_MODE=enforce` in the API environment, and
 *   2. `ENTITLEMENT_POLICY_STATUS.textChatAccess` approved in `entitlements.config.ts`
 *      (the repository's existing guard against enforcing unreviewed policy).
 * If (1) asks for enforcement while (2) is still PROVISIONAL, the gate runs in SHADOW mode: it
 * evaluates and logs what it would have done, and blocks nobody.
 *
 * Modes: off (default — no extra queries, today's behaviour) | shadow (evaluate + log) | enforce.
 *
 * Text chat never reads or spends voice minutes: `remainingSeconds` / `canUseAI` are not used.
 */

export const TEXT_CHAT_POLICY_DIMENSION = 'textChatAccess';

export type TextChatEntitlementMode = 'off' | 'shadow' | 'enforce';

export type TextChatDailyLimits = Readonly<Record<MembershipTier, number>>;

/** PROPOSED values (not approved). 0 means "not available on this tier". */
export const PROPOSED_DAILY_LIMITS: TextChatDailyLimits = {
  DISCOVER: 20, // the proposal lists trial 20 / Discover 30, but both are the DISCOVER tier
  GROW: 100,
  THRIVE: 200,
};

const MAX_CONFIGURABLE_LIMIT = 10_000;

function limitFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= MAX_CONFIGURABLE_LIMIT ? n : fallback;
}

export function readTextChatDailyLimits(env: NodeJS.ProcessEnv = process.env): TextChatDailyLimits {
  return {
    DISCOVER: limitFromEnv(env.CONVERSATIONS_DAILY_LIMIT_DISCOVER, PROPOSED_DAILY_LIMITS.DISCOVER),
    GROW: limitFromEnv(env.CONVERSATIONS_DAILY_LIMIT_GROW, PROPOSED_DAILY_LIMITS.GROW),
    THRIVE: limitFromEnv(env.CONVERSATIONS_DAILY_LIMIT_THRIVE, PROPOSED_DAILY_LIMITS.THRIVE),
  };
}

export function requestedTextChatMode(env: NodeJS.ProcessEnv = process.env): TextChatEntitlementMode {
  const raw = (env.CONVERSATIONS_ENTITLEMENTS_MODE ?? '').trim().toLowerCase();
  return raw === 'shadow' || raw === 'enforce' ? raw : 'off';
}

/**
 * The mode that actually applies. Enforcement additionally requires the policy ledger to mark
 * `textChatAccess` APPROVED; otherwise it is downgraded to shadow.
 */
export function effectiveTextChatMode(
  requested: TextChatEntitlementMode = requestedTextChatMode(),
  policyStatus: string = getPolicyStatus(TEXT_CHAT_POLICY_DIMENSION)
): TextChatEntitlementMode {
  if (requested !== 'enforce') return requested;
  return policyStatus === 'APPROVED' || policyStatus === 'ENFORCED' ? 'enforce' : 'shadow';
}

export type TextChatAccessCode = 'TRIAL_EXPIRED' | 'SUBSCRIPTION_NOT_ELIGIBLE' | 'PLAN_NOT_ELIGIBLE';

export type TextChatAccessDecision =
  | { allowed: true; membership: MembershipTier; status: MembershipStatus; dailyLimit: number }
  | { allowed: false; membership: MembershipTier; status: MembershipStatus; code: TextChatAccessCode };

/**
 * Pure policy. Statuses follow the entitlement engine and mirror voice where voice has a rule:
 * - EXPIRED blocks (voice blocks an expired membership too). DISCOVER + EXPIRED is the expired
 *   trial; any other tier reaching EXPIRED is a cancelled paid plan whose period has ended.
 * - ACTIVE, TRIALING, PAST_DUE and CANCELED-within-period keep their tier's access (the engine's
 *   existing, approved behaviour — nothing restricts on past_due or an in-period cancellation).
 * - NONE (no subscription row, or an unrecognised status) gets DISCOVER access, which is how every
 *   existing caller treats a missing subscription. Changing that is a product decision.
 * - A tier whose limit is configured as 0 is not eligible.
 */
export function decideTextChatAccess(
  entitlements: Pick<MembershipEntitlements, 'membership' | 'status'>,
  limits: TextChatDailyLimits
): TextChatAccessDecision {
  const { membership, status } = entitlements;
  if (status === 'EXPIRED') {
    return {
      allowed: false,
      membership,
      status,
      code: membership === 'DISCOVER' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_NOT_ELIGIBLE',
    };
  }
  const dailyLimit = limits[membership] ?? 0;
  if (dailyLimit <= 0) return { allowed: false, membership, status, code: 'PLAN_NOT_ELIGIBLE' };
  return { allowed: true, membership, status, dailyLimit };
}

export interface TextChatGate {
  mode: Exclude<TextChatEntitlementMode, 'off'>;
  decision: TextChatAccessDecision;
}

/** Resolves the member's gate, or null when the gate is off (no queries at all). */
export async function resolveTextChatGate(
  userId: string,
  options: {
    mode?: TextChatEntitlementMode;
    limits?: TextChatDailyLimits;
    loadEntitlements?: (id: string) => Promise<Pick<MembershipEntitlements, 'membership' | 'status'>>;
  } = {}
): Promise<TextChatGate | null> {
  const mode = options.mode ?? effectiveTextChatMode();
  if (mode === 'off') return null;
  const entitlements = await (options.loadEntitlements ?? getMembershipEntitlements)(userId);
  return { mode, decision: decideTextChatAccess(entitlements, options.limits ?? readTextChatDailyLimits()) };
}
