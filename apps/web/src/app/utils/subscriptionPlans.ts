// Subscription Plan Types and Configuration

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
    name: 'Trial',
    displayName: 'Trial',
    price: 0,
    credits: 30, // 30 minutes trial
    payAsYouGoRate: null, // No PAYG on trial
    trialDays: 7,
    hardCap: true,
    color: 'gray',
    gradient: 'from-gray-500 to-gray-600',
    allowanceDescription: '30 Minutes (0.5 Hour) Total Hard Cap',
    features: [
      'Landing + How Ezri Works',
      'Signup / Login / Verification',
      'FaceTime Basic',
      'Session Start/End Protocol',
      'Minutes Deduction Tracking',
      'Crisis Detection & De-escalation',
      'Crisis Resources Surfaced'
    ],
    notIncluded: [
      'Mood history or trends',
      'Journaling',
      'Wellness tools',
      'Usage history',
      'Pay-As-You-Go',
      'Plan management',
      'Analytics / exports'
    ]
  },
  core: {
    id: 'core',
    name: 'Core',
    displayName: 'Core (Habit Plan)',
    price: 25,
    credits: 200, // 200 minutes per month
    payAsYouGoRate: 0.20, // $5 per 25 mins = $0.20/min
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    allowanceDescription: '200 Minutes (3.33 Hours) Resets Monthly',
    features: [
      'Full FaceTime with Ezri',
      'Daily mood check-in & history',
      '7-day & 30-day visual trends',
      'Unlimited journals & Rich editor',
      'Curated wellness tools',
      'Avatar customization',
      'Usage dashboard',
      'Real-time crisis detection'
    ],
    notIncluded: [
      '90-day mood trends',
      'Journal export',
      'Advanced usage analytics',
      'Priority system handling'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro / Clarity',
    price: 49,
    credits: 400, // 400 minutes per month
    payAsYouGoRate: 0.20, // $5 per 25 mins = $0.20/min
    popular: true,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    allowanceDescription: '400 Minutes (6.66 Hours) Resets Monthly',
    features: [
      'Everything in Core',
      'Longer uninterrupted sessions',
      'Priority system handling',
      '90-day mood trends',
      'Export-ready journaling',
      'Full wellness tool library',
      'Detailed session logs',
      'Usage transparency dashboard'
    ],
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
  creditsRemaining: number; // Minutes left this billing cycle
  creditsTotal: number; // Total minutes for this plan
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
