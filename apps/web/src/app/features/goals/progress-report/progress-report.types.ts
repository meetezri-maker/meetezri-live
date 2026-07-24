/**
 * Frontend mirror of the backend Progress Report contract
 * (apps/api/src/modules/progress-report/progress-report.types.ts).
 *
 * The backend is the source of truth: these types describe the response only.
 * No reporting formula is reproduced on the client.
 */

export const PROGRESS_REPORT_RANGES = ["7d", "30d", "90d", "all"] as const;
export type ProgressReportRange = (typeof PROGRESS_REPORT_RANGES)[number];

export type ProgressReportItemType = "goal" | "achievement";

/** Where an item came from (Phase 5). Optional on read for backward compat. */
export type ProgressReportOrigin = "personal" | "system";

export type ProgressReportTrackingType = "count" | "duration" | "amount" | "manual_milestone";

export type ProgressReportAttentionReason =
  | "overdue"
  | "approaching_target"
  | "no_recent_check_ins"
  | "no_progress_during_period";

export interface ProgressReportTextEntry {
  text: string;
  date: string;
  itemId: string;
  itemType: ProgressReportItemType;
  itemTitle: string;
}

export interface ProgressReportItem {
  id: string;
  title: string;
  /** Item origin (Phase 5). Optional so pre-Phase-5 fixtures stay valid. */
  origin?: ProgressReportOrigin;
  /** Backend-provided icon name (system items). */
  iconName?: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  trackingType: ProgressReportTrackingType;
  trackingUnit: string | null;
  currentValue: number | null;
  targetValue: number | null;
  /** Live progress percentage (0..100). */
  currentProgress: number;
  progressAtStart: number;
  progressAtEnd: number;
  progressChange: number;
  checkInsDuringPeriod: number;
  activeCheckInDays: number;
  /** null for custom-frequency items. */
  consistencyRate: number | null;
  startDate: string | null;
  targetDate: string | null;
  isOverdue: boolean;
  isApproachingTarget: boolean;
  hasNoRecentCheckIns: boolean;
  hasNoProgressDuringPeriod: boolean;
  rewardAwarded: boolean;
}

export interface ProgressReportCompletion {
  itemType: ProgressReportItemType;
  itemId: string;
  title: string;
  origin?: ProgressReportOrigin;
  completedAt: string;
  rewardPointsAwarded: number;
  trackingType: ProgressReportTrackingType;
  finalCurrentValue: number | null;
  finalTargetValue: number | null;
}

export interface ProgressReportAttentionItem {
  itemType: ProgressReportItemType;
  itemId: string;
  title: string;
  reasons: ProgressReportAttentionReason[];
}

export interface ProgressReportRewardTransaction {
  id: string;
  sourceType: string;
  sourceItemId: string;
  points: number;
  reason: string | null;
  createdAt: string;
  date: string;
}

export interface ProgressReport {
  version: 1;
  generatedAt: string;
  timezone: string;

  period: {
    range: ProgressReportRange;
    start: string | null;
    end: string;
    label: string;
  };

  user: {
    displayName: string | null;
  };

  currentSnapshot: {
    totalPoints: number;
    currentLevel: number;
    pointsIntoLevel: number;
    pointsRequiredForNextLevel: number;
    pointsRemainingToNextLevel: number;
    activeGoals: number;
    activeAchievements: number;
    completedGoalsAllTime: number;
    completedAchievementsAllTime: number;
  };

  periodSummary: {
    completedGoals: number;
    completedAchievements: number;
    totalCheckIns: number;
    activeCheckInDays: number;
    overallConsistencyRate: number | null;
    pointsEarned: number;
    totalProgressChange: number;
  };

  activeGoals: ProgressReportItem[];
  activeAchievements: ProgressReportItem[];

  completedDuringPeriod: ProgressReportCompletion[];

  checkInActivity: {
    totalCheckIns: number;
    activeDays: number;
    mostConsistentItem: {
      itemType: ProgressReportItemType;
      itemId: string;
      title: string;
      rate: number;
    } | null;
  };

  wellbeingEntries: {
    wins: ProgressReportTextEntry[];
    challenges: ProgressReportTextEntry[];
    reflections: ProgressReportTextEntry[];
    notes: ProgressReportTextEntry[];
    moodCounts: Array<{ mood: string; count: number }>;
  };

  needsAttention: ProgressReportAttentionItem[];

  rewards: {
    pointsEarned: number;
    transactions: ProgressReportRewardTransaction[];
  };

  closingSummary: string[];
}
