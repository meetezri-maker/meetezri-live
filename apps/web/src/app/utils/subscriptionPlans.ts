// Membership configuration — pricing, allowances, and the internal plan identifiers.
//
// CUSTOMER-FACING WORDING LIVES IN `membershipCopy.ts`, not here. This file keeps the money and
// the identifiers; that file keeps the language. `name`/`displayName` below are retained only so
// existing callers keep compiling, and they now carry the customer-facing membership names.
//
// `PlanTier` values (`trial`/`core`/`pro`) are the DATABASE and STRIPE contract. They are never
// renamed and never rendered directly — map through `membershipKeyForPlan()`.

export type PlanTier = 'trial' | 'core' | 'pro';

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  displayName: string;
  price: number; // Monthly price in dollars
  credits: number; // Minutes per month
  payAsYouGoRate: number | null; // Price per minute for PAYG (null if not available)
  features: string[];
  notIncluded?: string[];
  popular?: boolean;
  trialDays?: number;
  color: string; // Brand color for UI
  gradient: string; // Gradient class
  allowanceDescription?: string;
  hardCap?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  trial: {
    id: 'trial',
    name: 'Discover',
    displayName: 'Discover',
    price: 0,
    credits: 30, // 30 minutes trial
    payAsYouGoRate: null, // No PAYG on trial
    trialDays: 7,
    hardCap: true,
    color: 'gray',
    gradient: 'from-gray-500 to-gray-600',
    allowanceDescription: '30 Talk It Out minutes, included',
    // Verified against shipped behaviour. Removed: "Landing + How Solace Works" and
    // "Signup / Login / Verification", which described the website rather than a membership.
    features: [
      '30 Talk It Out minutes',
      'Daily mood check-ins',
      'Community access',
      'One active challenge',
      'Safety detection and crisis resources',
    ],
    // Accurate as shipped: Journal, Mood History, Wellness Tools, Progress and Session History
    // are gated to paid memberships on the frontend today.
    notIncluded: [
      'Monthly minutes',
      'Additional minute top-ups',
      'Journalling',
      'Mood history and trends',
      'Wellness tool library',
      'Progress and session history',
    ]
  },
  core: {
    id: 'core',
    name: 'Grow',
    displayName: 'Grow',
    price: 25,
    credits: 200, // 200 minutes per month
    payAsYouGoRate: 0.20, // $5 per 25 mins = $0.20/min
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    allowanceDescription: '200 Talk It Out minutes each month',
    features: [
      '200 Talk It Out minutes each month',
      'Top up minutes anytime',
      'Unlimited journalling, with PDF and JSON export',
      'Mood history and trends',
      'Wellness tool library',
      'Progress and session history',
      'Up to 3 active challenges',
      'Avatar customisation',
    ],
    // "Journal export" removed — export ships to Grow as well (see JournalExportModal).
    // "Priority system handling" and "Advanced usage analytics" removed — neither exists.
    notIncluded: [
      'Unlimited active challenges',
    ]
  },
  pro: {
    id: 'pro',
    name: 'Thrive',
    displayName: 'Thrive',
    price: 49,
    credits: 400, // 400 minutes per month
    payAsYouGoRate: 0.20, // $5 per 25 mins = $0.20/min
    popular: true,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    allowanceDescription: '400 Talk It Out minutes each month',
    // "Priority system handling" and "Export-ready journaling" removed: the first does not
    // exist, and the second is not exclusive to this membership.
    features: [
      '400 Talk It Out minutes each month',
      'Top up minutes anytime',
      'Everything in Grow',
      'Unlimited active challenges',
      'Longer uninterrupted sessions',
    ],
    // Retained deliberately — these are safety boundaries, not feature gaps.
    notIncluded: [
      'Unlimited usage',
      'Human intervention',
      'Emergency service calling'
    ]
  }
};

// User Subscription Interface
export interface UserSubscription {
  userId: string;
  planId: PlanTier;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  creditsRemaining: number; // Minutes left in subscription bucket
  creditsTotal: number; // Subscription-bucket capacity view (remaining + used; stacked upgrades)
  billingCycle: {
    startDate: string; // ISO date
    endDate: string; // ISO date
    renewsOn: string | null; // ISO date or null if cancelled
  };
  payAsYouGoCredits: number; // Extra minutes purchased
  totalSpent: number; // Total amount spent
  usageHistory: UsageRecord[];
  createdAt: string;
  updatedAt: string;
  /** All pools: remaining subscription + PAYG + lifetime used (canonical account capacity). */
  accountTotalMinutes?: number;
  accountUsedMinutes?: number;
  /** Remaining minutes across subscription + PAYG buckets. */
  accountRemainingMinutes?: number;
}

export interface UsageRecord {
  id: string;
  date: string; // ISO date
  minutesUsed: number;
  sessionType: 'ai-avatar' | 'companion'; // For future companion feature
  avatarName?: string;
  cost: number; // Cost of this session (0 for included minutes, PAYG rate for extra)
}

export interface PayAsYouGoPurchase {
  id: string;
  userId: string;
  planId: PlanTier;
  minutesPurchased: number;
  ratePerMinute: number;
  totalCost: number;
  purchaseDate: string; // ISO date
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed';
}

// Helper Functions
export function getAvailablePAYGRate(planId: PlanTier): number | null {
  return SUBSCRIPTION_PLANS[planId].payAsYouGoRate;
}

export function canUsePAYG(planId: PlanTier): boolean {
  return planId !== 'trial' && SUBSCRIPTION_PLANS[planId].payAsYouGoRate !== null;
}

export function calculatePAYGCost(planId: PlanTier, minutes: number): number {
  const rate = getAvailablePAYGRate(planId);
  if (!rate) return 0;
  return rate * minutes;
}

export function getRemainingTrialDays(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, 7 - diffDays);
}

export function formatMinutes(minutes: number): string {
  const hours = (minutes / 60).toFixed(2);
  // Remove trailing zeros if integer
  const formattedHours = parseFloat(hours).toString();
  const unit = formattedHours === '1' || parseFloat(formattedHours) < 1 ? 'Hour' : 'Hours';
  return `${minutes} Minutes (${formattedHours} ${unit})`;
}

export function isSubscriptionActive(subscription: UserSubscription): boolean {
  const now = new Date();
  const endDate = new Date(subscription.billingCycle.endDate);
  return subscription.status === 'active' && now <= endDate;
}

export function shouldWarnLowCredits(creditsRemaining: number): boolean {
  return creditsRemaining <= 10 && creditsRemaining > 0;
}

export function hasCreditsRemaining(subscription: UserSubscription): boolean {
  return subscription.creditsRemaining > 0 || subscription.payAsYouGoCredits > 0;
}
