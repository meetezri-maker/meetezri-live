/**
 * The authoritative Progress Report data contract.
 *
 * This model is deliberately: explicit, versioned, JSON-serializable, free of
 * UI/PDF formatting, and free of raw Prisma records. It is the single shape
 * consumed by the future in-app report UI, PDF export, deterministic narrative
 * layers, and any later (approved) AI summary.
 */
import type { ProgressReportRange } from "./progress-report.constants";

export type { ProgressReportRange };

export type ProgressReportItemType = "goal" | "achievement";

/**
 * Where an item came from. `personal` = user-created (personal_goals /
 * custom_achievements). `system` = backend-defined activity achievement
 * (system-achievements catalog + user_achievements state).
 */
export type ProgressReportOrigin = "personal" | "system";

/** Tracking strategies (mirrors the gamification foundation). */
export type ProgressReportTrackingType = "count" | "duration" | "amount" | "manual_milestone";

/** A single user-entered text entry (win / challenge / reflection / note). */
export interface ProgressReportTextEntry {
  text: string;
  date: string; // YYYY-MM-DD (user calendar day of the check-in)
  itemId: string;
  itemType: ProgressReportItemType;
  itemTitle: string;
}

/** Shared progress fields for goal + achievement report items. */
export interface ProgressReportItemBase {
  id: string;
  title: string;
  /** Item origin (added in Phase 5; personal items keep their previous meaning). */
  origin: ProgressReportOrigin;
  /** Icon name for UI/PDF rendering (system items only; null for personal). */
  iconName: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  trackingType: ProgressReportTrackingType;
  trackingUnit: string | null;
  /** Raw current value (count/duration/amount). Null for manual milestones. */
  currentValue: number | null;
  /** Raw target value (count/duration/amount). Null for manual milestones. */
  targetValue: number | null;
  /** Live progress percentage (0..100) — the current snapshot value. */
  currentProgress: number;
  /** Historical progress at the start of the reporting period (0..100). */
  progressAtStart: number;
  /** Historical progress at the end of the reporting period (0..100). */
  progressAtEnd: number;
  /** progressAtEnd - progressAtStart (may be negative). */
  progressChange: number;
  checkInsDuringPeriod: number;
  activeCheckInDays: number;
  /** Fixed-frequency consistency (0..100), or null for custom frequency. */
  consistencyRate: number | null;
  startDate: string | null;
  targetDate: string | null;
  isOverdue: boolean;
  isApproachingTarget: boolean;
  hasNoRecentCheckIns: boolean;
  hasNoProgressDuringPeriod: boolean;
  rewardAwarded: boolean;
}

export type ProgressReportGoal = ProgressReportItemBase;
export type ProgressReportAchievement = ProgressReportItemBase;

/** An item completed inside the reporting period (from `completed_at`). */
export interface ProgressReportCompletion {
  itemType: ProgressReportItemType;
  itemId: string;
  title: string;
  origin: ProgressReportOrigin;
  completedAt: string; // YYYY-MM-DD (user calendar day)
  /** Points actually awarded per the point_transactions ledger (never derived). */
  rewardPointsAwarded: number;
  trackingType: ProgressReportTrackingType;
  finalCurrentValue: number | null;
  finalTargetValue: number | null;
}

/** Deterministic reasons an item needs attention. */
export type ProgressReportAttentionReason =
  | "overdue"
  | "approaching_target"
  | "no_recent_check_ins"
  | "no_progress_during_period";

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
  createdAt: string; // ISO timestamp
  date: string; // YYYY-MM-DD (user calendar day)
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

  activeGoals: ProgressReportGoal[];
  activeAchievements: ProgressReportAchievement[];

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
