import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Trophy,
  Award,
  Star,
  Lock,
  Calendar,
  Target,
  Zap,
  Heart,
  Moon,
  CheckCircle,
  ArrowLeft,
  Users,
  Crown,
  Flame,
  Sparkles,
  Compass,
  User,
  Diamond,
  BookOpen,
  Headphones,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  modalBodyText,
  modalCheckboxLabel,
  modalCloseButton,
  modalInput,
  modalLabel,
  modalLink,
  modalOverlay,
  modalPanelLg,
  modalPrimaryButton,
  modalTabActive,
  modalTabInactive,
  modalTitle,
} from '@/lib/modalTheme';
import { ACHIEVEMENTS_IMAGES } from '@/lib/solace/achievementsImages';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { GOAL_CATEGORY_OPTIONS, GOAL_EMOTION_TAG_OPTIONS } from '@/app/features/goals/constants';
import {
  AMOUNT_UNITS,
  CHECK_IN_FIELD_LABELS,
  DURATION_UNITS,
  MILESTONE_STAGES,
  TRACKING_METHOD_LABELS,
  isAmountPresetUnit,
  requiresTrackingChangeConfirmation,
  type TrackingMethod,
} from '@/app/features/goals/tracking';
import {
  goalCardView,
  goalCategoryToFormCategory,
  goalPriorityToFormPriority,
} from '@/app/features/goals/goalCardView';
import {
  combineAndFilter,
  type CombinedItem,
  type GamificationFilter,
} from '@/app/features/goals/combinedItems';
import { normalizeHistory, type NormalizedCheckIn } from '@/app/features/goals/checkInHistory';
import { buildAchievementDetail, buildGoalDetail } from '@/app/features/goals/detailView';
import { PREDEFINED_GOALS } from '@/app/features/goals/seedGoals';
import type { GoalCategory } from '@/app/features/goals/types';
import { SolaceSelect } from '@/app/solace';
import {
  achievementsBadgeCard,
  achievementsBadgeEmblemLocked,
  achievementsBadgeEmblemUnlocked,
  achievementsBadgeIconUnlocked,
  achievementsCard,
  achievementsCategoryPill,
  achievementsEmptyState,
  achievementsHeroContent,
  achievementsHeroImage,
  achievementsHeroLightScrim,
  achievementsHeroOverlay,
  achievementsHeroOverlayBottom,
  achievementsHeroShell,
  achievementsHeroSubtitle,
  achievementsHeroTitle,
  achievementsJourneyFocusCard,
  achievementsJourneyNodeCircle,
  achievementsJourneyNodeLabel,
  achievementsJourneyNodeSub,
  achievementsJourneySection,
  achievementsJourneySubtitle,
  achievementsJourneyTitle,
  achievementsMilestoneCard,
  achievementsPageFogMid,
  achievementsPageGlowTop,
  achievementsPageRoot,
  achievementsPageVignette,
  achievementsRecentBadgeIcon,
  achievementsRecentLabel,
  achievementsRecentSection,
  achievementsRailIconChip,
  achievementsSectionPanel,
  achievementsStatIconChip,
  achievementsStatStrip,
} from '@/app/pages/app/achievements/achievementsUi';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category:
    | 'sessions'
    | 'mood'
    | 'journal'
    | 'wellness'
    | 'streak'
    | 'community'
    | 'personal'
    | 'self_improvement'
    | 'professional';
  progress: number;
  total: number;
  unlocked: boolean;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  goalType?: 'gym' | 'money_management' | 'career' | 'learning' | 'health' | 'custom';
  lastCheckInDate?: string;
  checkInHistory?: string[];
  checkInEntries?: { date: string; amount?: number; note?: string }[];
  goalCategory?: 'Mental' | 'Emotional' | 'Productivity' | 'Relationships' | 'Wellness';
  whyItMatters?: string;
  targetOutcome?: string;
  startDate?: string;
  targetDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
  progressStatus?: 'Not Started' | 'In Progress' | 'Achieved';
  checkInFrequency?: 'Daily' | 'Weekly' | 'Custom';
  reminderEnabled?: boolean;
  actionSteps?: string;
  moodTag?: 'Stress' | 'Sadness' | 'Fear' | 'Confidence' | 'Motivation';
  supportType?: 'Encouragement' | 'Accountability' | 'Reflection' | 'Coping Help';
  notes?: string;
  completedAt?: string;
  rewardAwarded?: boolean;
  linkedGoalId?: string;
  /** When true (default), daily check-ins also write to the personal goals API. False = streak only on this achievement. */
  syncWithGoals?: boolean;
  /** Which authoritative entity this display card came from (Task 2.5 view model). */
  __source?: 'goal' | 'achievement';
  trackingType?: 'count' | 'duration' | 'amount' | 'manual_milestone';
  targetValue?: number;
  currentValue?: number;
  trackingUnit?: string;
}

type PersonalGoalTemplateKey = '' | `pre:${number}` | 'custom';

/** Frontend-only combined display model. Backend models stay separate: a goal is
 * a raw personal_goals record; an achievement is the existing Achievement type. */
type GamificationCardItem = CombinedItem<Record<string, unknown>, Achievement>;

function mapSeedCategoryToGoalCategory(cat: GoalCategory): NonNullable<Achievement['goalCategory']> {
  switch (cat) {
    case 'mental_emotional':
      return 'Mental';
    case 'social_relationships':
      return 'Relationships';
    case 'personal_growth':
      return 'Wellness';
    case 'daily_productivity':
      return 'Productivity';
    case 'wellness':
      return 'Wellness';
    default:
      return 'Wellness';
  }
}

function mapAchievementCategoryToGoalCategory(category?: Achievement['goalCategory']): GoalCategory {
  switch (category) {
    case 'Mental':
    case 'Emotional':
      return 'mental_emotional';
    case 'Relationships':
      return 'social_relationships';
    case 'Productivity':
      return 'daily_productivity';
    case 'Wellness':
    default:
      return 'wellness';
  }
}

function mapAchievementPriorityToGoalPriority(priority?: Achievement['priority']): 'low' | 'medium' | 'high' {
  if (priority === 'High') return 'high';
  if (priority === 'Low') return 'low';
  return 'medium';
}

function mapAchievementFrequencyToGoalFrequency(
  frequency?: Achievement['checkInFrequency']
): 'daily' | 'weekly' | 'custom' {
  if (frequency === 'Weekly') return 'weekly';
  if (frequency === 'Custom') return 'custom';
  return 'daily';
}

function mapMoodTagToGoalEmotionTag(
  mood?: Achievement['moodTag']
): 'stress' | 'sadness' | 'confidence' | 'motivation' | undefined {
  if (!mood) return undefined;
  const normalized = mood.toLowerCase();
  if (normalized === 'stress') return 'stress';
  if (normalized === 'sadness') return 'sadness';
  if (normalized === 'confidence') return 'confidence';
  if (normalized === 'motivation') return 'motivation';
  return undefined;
}

function mapSupportTypeToGoalSupportType(
  support?: Achievement['supportType']
): 'encouragement' | 'accountability' | 'reflection' | 'coping_help' | undefined {
  if (!support) return undefined;
  const normalized = support.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'encouragement') return 'encouragement';
  if (normalized === 'accountability') return 'accountability';
  if (normalized === 'reflection') return 'reflection';
  if (normalized === 'coping_help') return 'coping_help';
  return undefined;
}

function ensureMinText(value: string | undefined, min: number, fallback: string): string {
  const trimmed = (value || '').trim();
  if (trimmed.length >= min) return trimmed;
  return fallback;
}

type DailyGoalCheckInFields = {
  amount: string;
  milestone: string;
  mood: string;
  reflection: string;
  challenges: string;
  wins: string;
  notes: string;
};

function emptyDailyGoalCheckIn(): DailyGoalCheckInFields {
  return {
    amount: '',
    milestone: '',
    mood: '',
    reflection: '',
    challenges: '',
    wins: '',
    notes: '',
  };
}

function defaultEmotionFromAchievementMood(mood?: Achievement['moodTag']): string {
  if (!mood) return '';
  const m: Record<NonNullable<Achievement['moodTag']>, string> = {
    Stress: 'stress',
    Sadness: 'sadness',
    Fear: 'anxiety',
    Confidence: 'confidence',
    Motivation: 'motivation',
  };
  return m[mood] || '';
}

/** Maps UI mood selection to API emotion tag; falls back to goal default. */
function parseMoodForApi(selected: string, fallback?: Achievement['moodTag']): string | undefined {
  const raw = selected.trim() || defaultEmotionFromAchievementMood(fallback);
  if (!raw) return undefined;
  if (GOAL_EMOTION_TAG_OPTIONS.some((o) => o.value === raw)) return raw;
  return mapMoodTagToGoalEmotionTag(fallback);
}

/** Maps a selected achievement to a journey node index for local preview (no backend). */
function journeyIndexFromSelectedAchievement(a: Achievement): number {
  const total = Math.max(1, a.total);
  const ratio = a.progress / total;
  if (a.unlocked) {
    if (ratio >= 1 && a.points >= 50) return 4;
    if (ratio >= 1) return 3;
    return 2;
  }
  if (ratio <= 0.2) return 0;
  if (ratio <= 0.45) return 1;
  if (ratio <= 0.75) return 2;
  return 3;
}

function formatUnlockDate(achievement: Achievement): string | null {
  if (!achievement.unlocked) return null;
  const hist = achievement.checkInHistory;
  if (hist && hist.length > 0) {
    const latest = hist.reduce((a, b) => (a > b ? a : b));
    try {
      return format(new Date(`${latest}T12:00:00`), 'MMM d, yyyy');
    } catch {
      return null;
    }
  }
  return null;
}

interface VaultParticlesProps {
  className?: string;
}

function VaultParticles({ className }: VaultParticlesProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-0.5 w-0.5 rounded-full bg-amber-200/50 shadow-[0_0_8px_rgba(251,191,36,0.35)]"
          style={{ left: `${10 + ((i * 23) % 80)}%`, top: `${12 + ((i * 17) % 70)}%` }}
          animate={{ opacity: [0.15, 0.55, 0.15], scale: [0.9, 1.15, 0.9] }}
          transition={{
            duration: 2.8 + (i % 3) * 0.35,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export function Achievements() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // Combined Goals & Achievements type filter (default 'all').
  const [gamificationFilter, setGamificationFilter] = useState<GamificationFilter>('all');
  // Gates the empty state so it never flashes while the initial load is pending.
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  // Read-only detail modal: stores the clicked item's type + id; live data is
  // derived from the loaded lists so it stays fresh after check-ins.
  const [detailItem, setDetailItem] = useState<{ itemType: 'goal' | 'achievement'; id: string } | null>(null);
  const [detailHistory, setDetailHistory] = useState<NormalizedCheckIn[]>([]);
  const [detailHistoryLoading, setDetailHistoryLoading] = useState(false);
  // Bumped after a successful check-in so an open detail modal refetches history.
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [wellnessExercises, setWellnessExercises] = useState(0);
  const journeyRingId = useId().replace(/:/g, '');

  useEffect(() => {
    setShowAllAchievements(false);
    setSelectedAchievement(null);
  }, [selectedCategory]);

  const [communityPosts, setCommunityPosts] = useState(0);
  const [customAchievements, setCustomAchievements] = useState<Achievement[]>([]);
  // Personal Goals are loaded from their authoritative API (personal_goals),
  // NOT mirrored into custom_achievements (Task 2.5 — no dual-record model).
  const [personalGoals, setPersonalGoals] = useState<Record<string, unknown>[]>([]);
  // When set, the personal-goal form in the create modal edits this goal id
  // (via api.goals.update) instead of creating a new goal.
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  // When set, the personal-achievement form edits this custom achievement id
  // (via api.customAchievements.update) instead of creating a new one.
  const [editingAchievementId, setEditingAchievementId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTotal, setNewTotal] = useState('1');
  const [newCategory, setNewCategory] = useState<Achievement['category']>('personal');
  const [newGoalType, setNewGoalType] = useState<NonNullable<Achievement['goalType']>>('gym');
  const [moneyGoalKind, setMoneyGoalKind] = useState<'saving' | 'budget' | 'debt' | 'investment'>('saving');
  const [moneyCurrentAmount, setMoneyCurrentAmount] = useState('0');
  const [moneyTargetAmount, setMoneyTargetAmount] = useState('1000');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [activeAddTab, setActiveAddTab] = useState<'personal_goals' | 'personal_achievements'>('personal_goals');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<NonNullable<Achievement['goalCategory']>>('Mental');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalWhyItMatters, setGoalWhyItMatters] = useState('');
  const [goalTargetOutcome, setGoalTargetOutcome] = useState('');
  const [goalPriority, setGoalPriority] = useState<NonNullable<Achievement['priority']>>('Medium');
  const [goalStartDate, setGoalStartDate] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalProgress, setGoalProgress] = useState('0');
  const [goalCheckInFrequency, setGoalCheckInFrequency] = useState<NonNullable<Achievement['checkInFrequency']>>('Daily');
  const [goalActionSteps, setGoalActionSteps] = useState('');
  const [goalMoodTag, setGoalMoodTag] = useState<NonNullable<Achievement['moodTag']>>('Stress');
  const [goalSupportType, setGoalSupportType] = useState<NonNullable<Achievement['supportType']>>('Encouragement');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalReminderEnabled, setGoalReminderEnabled] = useState(true);
  const [goalTemplateKey, setGoalTemplateKey] = useState<PersonalGoalTemplateKey>('');
  // Tracking configuration for the create form (Task 2.5, Phase 7/8).
  const [goalTrackingType, setGoalTrackingType] =
    useState<'count' | 'duration' | 'amount' | 'manual_milestone'>('manual_milestone');
  const [goalTargetValue, setGoalTargetValue] = useState('');
  const [goalTrackingUnit, setGoalTrackingUnit] = useState('');
  // Amount-unit "Custom" mode (shows a free-text unit field).
  const [goalAmountCustom, setGoalAmountCustom] = useState(false);
  // Original method + whether the edited goal has check-ins (Phase 6 confirmation).
  const [editingGoalOriginalTracking, setEditingGoalOriginalTracking] = useState<TrackingMethod | undefined>();
  const [editingGoalHasCheckIns, setEditingGoalHasCheckIns] = useState(false);
  // Tracking configuration for the personal-achievement create form.
  const [achTrackingType, setAchTrackingType] =
    useState<'count' | 'duration' | 'amount' | 'manual_milestone'>('count');
  const [achTargetValue, setAchTargetValue] = useState('');
  const [achTrackingUnit, setAchTrackingUnit] = useState('');
  const [achAmountCustom, setAchAmountCustom] = useState(false);
  const [editingAchievementOriginalTracking, setEditingAchievementOriginalTracking] = useState<TrackingMethod | undefined>();
  const [editingAchievementHasCheckIns, setEditingAchievementHasCheckIns] = useState(false);
  const [personalGoalFormOpen, setPersonalGoalFormOpen] = useState(false);
  const [dailyCheckInInputs, setDailyCheckInInputs] = useState<Record<string, DailyGoalCheckInFields>>({});
  // Backend is the single source of truth for points + level (Task 1 foundation).
  const [backendPoints, setBackendPoints] = useState<{
    totalPoints: number;
    level: number;
    levelProgressPercentage: number;
    pointsToNextLevel: number;
  }>({ totalPoints: 0, level: 1, levelProgressPercentage: 0, pointsToNextLevel: 100 });

  const achievementGoalTemplateGroups = useMemo(
    () =>
      GOAL_CATEGORY_OPTIONS.map((cat) => ({
        label: cat.label,
        options: PREDEFINED_GOALS.flatMap((g, i) =>
          g.goal_category === cat.value
            ? [{ value: `pre:${i}` as const, label: g.goal_title }]
            : []
        ),
      })),
    []
  );

  const mapApiCustomAchievement = (item: any): Achievement => ({
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    category: item.category,
    progress: Number(item.progress || 0),
    total: Number(item.total || 1),
    unlocked: Boolean(item.unlocked),
    points: Number(item.points || 0),
    rarity: item.rarity || 'common',
    goalType: item.goal_type || undefined,
    lastCheckInDate: item.last_check_in_date || undefined,
    checkInHistory: Array.isArray(item.check_in_history) ? item.check_in_history : [],
    checkInEntries: Array.isArray(item.check_in_entries) ? item.check_in_entries : [],
    goalCategory: item.goal_category || undefined,
    whyItMatters: item.why_it_matters || undefined,
    targetOutcome: item.target_outcome || undefined,
    startDate: item.start_date || undefined,
    targetDate: item.target_date || undefined,
    priority: item.priority || undefined,
    progressStatus: item.progress_status || undefined,
    checkInFrequency: item.check_in_frequency || undefined,
    reminderEnabled: typeof item.reminder_enabled === 'boolean' ? item.reminder_enabled : undefined,
    actionSteps: item.action_steps || undefined,
    moodTag: item.mood_tag || undefined,
    supportType: item.support_type || undefined,
    notes: item.notes || undefined,
    linkedGoalId: item.linked_goal_id || undefined,
    syncWithGoals: item.sync_with_goals !== false,
    trackingType: item.tracking_type || undefined,
    trackingUnit: item.tracking_unit || undefined,
    completedAt: item.completed_at || undefined,
    rewardAwarded: Boolean(item.reward_awarded),
  });

  const mapAchievementToApiPayload = (item: Achievement) => ({
    title: item.title,
    description: item.description,
    icon: item.icon,
    category: item.category,
    progress: item.progress,
    total: item.total,
    // `unlocked` and `points` are intentionally omitted: the backend derives
    // unlock state and awards points. The client is not the source of truth.
    rarity: item.rarity,
    goalType: item.goalType,
    lastCheckInDate: item.lastCheckInDate,
    checkInHistory: item.checkInHistory || [],
    checkInEntries: item.checkInEntries || [],
    goalCategory: item.goalCategory,
    whyItMatters: item.whyItMatters,
    targetOutcome: item.targetOutcome,
    startDate: item.startDate,
    targetDate: item.targetDate,
    priority: item.priority,
    progressStatus: item.progressStatus,
    checkInFrequency: item.checkInFrequency,
    reminderEnabled: item.reminderEnabled,
    actionSteps: item.actionSteps,
    moodTag: item.moodTag,
    supportType: item.supportType,
    notes: item.notes,
    linkedGoalId: item.linkedGoalId,
    syncWithGoals: item.syncWithGoals !== false,
    trackingType: item.trackingType,
    trackingUnit: item.trackingUnit,
  });

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const [progress, posts] = await Promise.all([
          api.wellness.getProgress(),
          api.getCommunityPosts(100),
        ]);

        const completedWellness = Array.isArray(progress)
          ? progress.reduce((sum: number, item: any) => sum + Number(item?.sessionsCompleted || 0), 0)
          : 0;
        const authoredPosts = Array.isArray(posts)
          ? posts.filter((post: any) => post?.isByCurrentUser).length
          : 0;

        setWellnessExercises(completedWellness);
        setCommunityPosts(authoredPosts);
      } catch (error) {
        console.error('Failed to load achievement metrics', error);
      }
    };

    loadMetrics();
  }, []);

  useEffect(() => {
    if (!showCreateModal) {
      setGoalTemplateKey('');
      setPersonalGoalFormOpen(false);
      setEditingGoalId(null);
      setEditingAchievementId(null);
      setGoalAmountCustom(false);
      setAchAmountCustom(false);
      setEditingGoalOriginalTracking(undefined);
      setEditingGoalHasCheckIns(false);
      setEditingAchievementOriginalTracking(undefined);
      setEditingAchievementHasCheckIns(false);
    }
  }, [showCreateModal]);

  // Reload custom achievements straight from the backend (no localStorage cache).
  const reloadCustomAchievements = useCallback(async () => {
    try {
      const rows = await api.customAchievements.list();
      setCustomAchievements(Array.isArray(rows) ? rows.map(mapApiCustomAchievement) : []);
    } catch (error) {
      console.error('Failed to load custom achievements from database', error);
      setCustomAchievements([]);
    }
  }, []);

  // Reload the backend-owned points + level summary.
  const reloadPoints = useCallback(async () => {
    try {
      const p = await api.gamification.getPoints();
      setBackendPoints({
        totalPoints: Number(p?.totalPoints ?? 0),
        level: Number(p?.level ?? 1),
        levelProgressPercentage: Number(p?.levelProgressPercentage ?? 0),
        pointsToNextLevel: Number(p?.pointsToNextLevel ?? 100),
      });
    } catch (error) {
      console.error('Failed to load gamification points', error);
    }
  }, []);

  // Reload Personal Goals from their authoritative API.
  const reloadGoals = useCallback(async () => {
    try {
      const rows = await api.goals.list();
      setPersonalGoals(Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []);
    } catch (error) {
      console.error('Failed to load personal goals from database', error);
      setPersonalGoals([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([reloadCustomAchievements(), reloadGoals(), reloadPoints()]).finally(() =>
      setInitialLoadDone(true)
    );
  }, [reloadCustomAchievements, reloadGoals, reloadPoints]);

  const sessionsCompleted = Number(profile?.stats?.completed_sessions || 0);
  const moodCheckins = Number(profile?.stats?.total_checkins || 0);
  const journalEntries = Number(profile?.stats?.total_journals || 0);
  const streakDays = Number(profile?.streak_days || 0);

  const achievements: Achievement[] = useMemo(() => ([
    {
      id: '1',
      title: 'First Steps',
      description: 'Complete your first Talk with Solace',
      icon: 'footprints',
      category: 'sessions',
      progress: sessionsCompleted,
      total: 1,
      unlocked: sessionsCompleted >= 1,
      points: 10,
      rarity: 'common'
    },
    {
      id: '2',
      title: 'Consistent Journey',
      description: 'Complete 10 Talks with Solace',
      icon: 'target',
      category: 'sessions',
      progress: sessionsCompleted,
      total: 10,
      unlocked: sessionsCompleted >= 10,
      points: 50,
      rarity: 'rare'
    },
    {
      id: '3',
      title: 'Mood Master',
      description: 'Log your mood 7 times',
      icon: 'heart',
      category: 'mood',
      progress: moodCheckins,
      total: 7,
      unlocked: moodCheckins >= 7,
      points: 25,
      rarity: 'rare'
    },
    {
      id: '4',
      title: 'Journaling Pro',
      description: 'Write 20 journal entries',
      icon: 'book',
      category: 'journal',
      progress: journalEntries,
      total: 20,
      unlocked: journalEntries >= 20,
      points: 40,
      rarity: 'rare'
    },
    {
      id: '5',
      title: 'Wellness Warrior',
      description: 'Complete 5 wellness exercises',
      icon: 'zap',
      category: 'wellness',
      progress: wellnessExercises,
      total: 5,
      unlocked: wellnessExercises >= 5,
      points: 30,
      rarity: 'common'
    },
    {
      id: '6',
      title: 'Night Owl',
      description: 'Complete 14 wellness exercises',
      icon: 'moon',
      category: 'wellness',
      progress: wellnessExercises,
      total: 14,
      unlocked: wellnessExercises >= 14,
      points: 35,
      rarity: 'rare'
    },
    {
      id: '7',
      title: 'Legendary Dedication',
      description: 'Maintain a 30-day streak',
      icon: 'trophy',
      category: 'streak',
      progress: streakDays,
      total: 30,
      unlocked: streakDays >= 30,
      points: 100,
      rarity: 'legendary'
    },
    {
      id: '8',
      title: 'Community Contributor',
      description: 'Publish 3 community posts',
      icon: 'users',
      category: 'community',
      progress: communityPosts,
      total: 3,
      unlocked: communityPosts >= 3,
      points: 20,
      rarity: 'common'
    },
    ...customAchievements
  ]), [communityPosts, customAchievements, journalEntries, moodCheckins, sessionsCompleted, streakDays, wellnessExercises]);

  // Ids of the current user's OWN custom achievements (api.customAchievements.list
  // is user-scoped, so every id here is owned by the user). Predefined/system
  // achievements (hardcoded ids '1'..'8') are never in this set, so they stay
  // read-only.
  const customAchievementIds = useMemo(
    () => new Set(customAchievements.map((a) => a.id)),
    [customAchievements]
  );

  // Fetch check-in history for the open detail modal. Goals and CUSTOM
  // achievements have backend check-ins; predefined achievements do not.
  useEffect(() => {
    if (!detailItem) {
      setDetailHistory([]);
      return;
    }
    const checkInable = detailItem.itemType === 'goal' || customAchievementIds.has(detailItem.id);
    if (!checkInable) {
      setDetailHistory([]);
      return;
    }
    let cancelled = false;
    setDetailHistoryLoading(true);
    (async () => {
      try {
        const rows =
          detailItem.itemType === 'goal'
            ? await api.goals.listCheckIns(detailItem.id)
            : await api.customAchievements.listCheckIns(detailItem.id);
        if (!cancelled) setDetailHistory(normalizeHistory(rows, detailItem.itemType));
      } catch (error) {
        console.error('Failed to load check-in history', error);
        if (!cancelled) setDetailHistory([]);
      } finally {
        if (!cancelled) setDetailHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailItem, customAchievementIds, detailRefreshKey]);

  // Escape closes the read-only detail modal (no editable fields → no data loss).
  useEffect(() => {
    if (!detailItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailItem(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailItem]);

  const openGoalDetail = (raw: Record<string, unknown>) =>
    setDetailItem({ itemType: 'goal', id: String((raw as { id?: unknown }).id) });
  const openAchievementDetail = (a: Achievement) => {
    setSelectedAchievement(a); // keep the existing Achievement Journey highlight
    setDetailItem({ itemType: 'achievement', id: a.id });
  };

  const stats = {
    // Backend-owned total points (Task 1 ledger). Never computed on the client.
    totalPoints: backendPoints.totalPoints,
    unlockedCount: achievements.filter(a => a.unlocked).length,
    totalCount: achievements.length,
    currentStreak: streakDays,
    longestStreak: streakDays
  };

  const categories = [
    { id: 'all', label: 'All', icon: Trophy },
    { id: 'sessions', label: 'Talk It Out', icon: Target },
    { id: 'mood', label: 'Mood', icon: Heart },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'wellness', label: 'Wellness', icon: Zap },
    { id: 'streak', label: 'Streaks', icon: Flame },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'personal', label: 'Personal', icon: Star },
  ];

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return achievements;
    if (selectedCategory === 'personal') {
      return achievements.filter((a) =>
        ['personal', 'self_improvement', 'professional'].includes(a.category)
      );
    }
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  const recentUnlocked = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlocked);
    if (unlocked.length === 0) return null;
    const score = (a: Achievement) => {
      let t = 0;
      const h = a.checkInHistory;
      if (h && h.length > 0) {
        const maxD = h.reduce((best, d) => (d > best ? d : best), h[0]);
        t = new Date(`${maxD}T12:00:00`).getTime();
      }
      return t * 10 + a.points;
    };
    return unlocked.reduce((best, a) => (score(a) >= score(best) ? a : best), unlocked[0]);
  }, [achievements]);

  const overallCompletionPct =
    stats.totalCount > 0 ? Math.round((stats.unlockedCount / stats.totalCount) * 100) : 0;

  const journeyActiveIndex = useMemo(() => {
    const p = stats.totalCount > 0 ? stats.unlockedCount / stats.totalCount : 0;
    if (p >= 0.85) return 4;
    if (p >= 0.6) return 3;
    if (p >= 0.35) return 2;
    if (p >= 0.12) return 1;
    return 0;
  }, [stats.totalCount, stats.unlockedCount]);

  const nextClosestAchievement = useMemo(() => {
    const list = achievements.filter((x) => !x.unlocked && x.progress < x.total);
    if (list.length === 0) return null;
    return list.reduce((best, x) => {
      const br = best.progress / Math.max(1, best.total);
      const xr = x.progress / Math.max(1, x.total);
      return xr >= br ? x : best;
    });
  }, [achievements]);

  const journeyHighlightIndex = useMemo(
    () =>
      selectedAchievement
        ? journeyIndexFromSelectedAchievement(selectedAchievement)
        : journeyActiveIndex,
    [journeyActiveIndex, selectedAchievement]
  );

  // Level + progress-to-next come straight from the backend level service.
  const currentLevel = backendPoints.level;
  const levelProgressPct = backendPoints.levelProgressPercentage;
  const pointsToNext = backendPoints.pointsToNextLevel;

  const iconMap: Record<string, LucideIcon> = {
    footprints: Target,
    target: Target,
    heart: Heart,
    book: BookOpen,
    zap: Zap,
    moon: Moon,
    trophy: Trophy,
    sunrise: Calendar,
    users: Users,
  };

  const getIcon = (iconName: string): LucideIcon => iconMap[iconName] ?? Trophy;

  const visibleAchievementList = showAllAchievements
    ? filteredAchievements
    : filteredAchievements.slice(0, 8);

  // ---- Combined Goals & Achievements display model (frontend-only) ----------
  // Backend models stay separate; we only merge for display. Goal items carry
  // the raw personal_goals record; achievement items carry the Achievement.
  const goalItems: GamificationCardItem[] = personalGoals
    .filter((raw) => String((raw as { status?: unknown }).status) !== 'archived')
    .map((raw) => ({ itemType: 'goal', id: String((raw as { id?: unknown }).id), data: raw }));
  const achievementItems: GamificationCardItem[] = visibleAchievementList.map((a) => ({
    itemType: 'achievement',
    id: a.id,
    data: a,
  }));
  // All -> goals + achievements; Goals -> goals only; Achievements -> custom +
  // predefined achievements (both live in achievementItems).
  const combinedItems: GamificationCardItem[] = combineAndFilter(
    goalItems,
    achievementItems,
    gamificationFilter
  );
  const combinedEmptyMessage =
    gamificationFilter === 'goals'
      ? 'No personal goals yet.'
      : gamificationFilter === 'achievements'
        ? 'No achievements found.'
        : 'No goals or achievements found.';

  // Existing GOAL card — extracted verbatim so the exact card is reused.
  const renderGoalCard = (raw: Record<string, unknown>) => {
    const g = goalCardView(raw);
    return (
      <article
        key={`goal:${g.id}`}
        data-testid="goal-card"
        data-goal-id={g.id}
        role="button"
        tabIndex={0}
        onClick={() => openGoalDetail(raw)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openGoalDetail(raw);
          }
        }}
        aria-label={`${g.title}. Open details.`}
        className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[var(--solace-card-bg)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl outline-none transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:shadow-lg hover:shadow-black/25 focus-visible:ring-2 focus-visible:ring-fuchsia-400/45"
      >
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-white">{g.title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {g.category} · {TRACKING_METHOD_LABELS[g.trackingType]}
          </p>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 capitalize',
              g.completed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-zinc-400'
            )}
          >
            {g.completed ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Completed
              </>
            ) : (
              g.status.replace(/_/g, ' ')
            )}
          </span>
          {g.isNumeric && g.targetValue != null ? (
            <span className="tabular-nums text-zinc-400">
              {g.currentValue}/{g.targetValue}
              {g.trackingUnit ? ` ${g.trackingUnit}` : ''}
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Progress</span>
            <span className="tabular-nums text-zinc-400">{g.progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 to-teal-400/90"
              style={{ width: `${g.progressPct}%` }}
            />
          </div>
        </div>
      </article>
    );
  };

  // Existing ACHIEVEMENT badge card — extracted verbatim (predefined + custom).
  const renderAchievementCard = (achievement: Achievement, index: number) => {
    const Icon = getIcon(achievement.icon);
    const isUnlocked = achievement.unlocked;
    const total = Math.max(1, achievement.total);
    const pct = Math.min(100, (achievement.progress / total) * 100);
    const isSelected = selectedAchievement?.id === achievement.id;
    const showProgressBar = !isUnlocked && achievement.progress < total;

    return (
      <motion.article
        key={`achievement:${achievement.id}`}
        id={`ach-${achievement.id}`}
        layout={false}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24) }}
        className={cn(
          achievementsBadgeCard,
          'cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25',
          isUnlocked
            ? 'border-emerald-400/12 hover:border-emerald-400/22 [html[data-ezri-theme=light]_&:border-emerald-300/45 [html[data-theme=light]_&:border-emerald-300/45'
            : 'border-white/[0.06] hover:border-white/12',
          isSelected &&
            'ring-2 ring-fuchsia-400/30 ring-offset-2 ring-offset-[#05070d] [html[data-ezri-theme=light]_&:ring-offset-white [html[data-theme=light]_&:ring-offset-white'
        )}
      >
        <button
          type="button"
          onClick={() => openAchievementDetail(achievement)}
          className="flex flex-1 flex-col items-center gap-3 p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/45"
          aria-pressed={isSelected}
          aria-label={`${achievement.title}. ${isUnlocked ? 'Unlocked' : 'Locked'}. Open details.`}
        >
          <div
            className={cn(
              'relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border transition',
              isUnlocked ? achievementsBadgeEmblemUnlocked : achievementsBadgeEmblemLocked
            )}
          >
            <Icon
              className={cn('h-9 w-9', isUnlocked ? achievementsBadgeIconUnlocked : 'text-zinc-500')}
              aria-hidden
            />
            {!isUnlocked ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 [html[data-ezri-theme=light]_&:bg-violet-100/60 [html[data-theme=light]_&:bg-violet-100/60">
                <Lock className="h-5 w-5 text-zinc-500" aria-hidden />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1.5 px-0.5">
            <h3 className="line-clamp-2 text-center text-[15px] font-semibold leading-snug text-white">
              {achievement.title}
            </h3>
            <p className="line-clamp-2 text-center text-xs leading-relaxed text-zinc-500">
              {achievement.description}
            </p>
          </div>

          {showProgressBar ? (
            <div className="w-full space-y-1 px-1">
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Progress</span>
                <span className="tabular-nums text-zinc-400">
                  {achievement.progress}/{total}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: index * 0.05, duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500/90 to-cyan-400/90"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
            {isUnlocked ? (
              <>
                <span className="inline-flex items-center gap-1 text-emerald-300/90">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                  Unlocked
                </span>
                {formatUnlockDate(achievement) ? (
                  <span className="text-zinc-500">{formatUnlockDate(achievement)}</span>
                ) : null}
                {achievement.points > 0 ? (
                  <span className="text-zinc-600">+{achievement.points} pts</span>
                ) : null}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Locked
                </span>
                {achievement.points > 0 ? (
                  <span className="text-zinc-600">+{achievement.points} pts on unlock</span>
                ) : null}
              </>
            )}
          </div>
        </button>
      </motion.article>
    );
  };

  // State-only update. The backend is the source of truth; no localStorage cache.
  const saveCustomAchievements = (items: Achievement[]) => {
    setCustomAchievements(items);
  };

  const goalTypeLabels: Record<NonNullable<Achievement['goalType']>, string> = {
    gym: 'Gym',
    money_management: 'Money Management',
    career: 'Career',
    learning: 'Learning',
    health: 'Health',
    custom: 'Custom',
  };

  const goalTypeIcons: Record<NonNullable<Achievement['goalType']>, Achievement['icon']> = {
    gym: 'zap',
    money_management: 'target',
    career: 'trophy',
    learning: 'book',
    health: 'heart',
    custom: 'trophy',
  };

  const addCustomAchievement = async () => {
    const moneyMode = newGoalType === 'money_management';
    const moneyCurrent = Math.max(0, Number(moneyCurrentAmount) || 0);
    const moneyTarget = Math.max(1, Number(moneyTargetAmount) || 1);
    const title = moneyMode ? (newTitle.trim() || `${goalTypeLabels[newGoalType]} Goal`) : newTitle.trim();
    const description = moneyMode
      ? `${moneyGoalKind === 'saving' ? 'Saving' : moneyGoalKind === 'budget' ? 'Budget Control' : moneyGoalKind === 'debt' ? 'Debt Reduction' : 'Investment'} goal: $${moneyCurrent.toLocaleString()} / $${moneyTarget.toLocaleString()}`
      : newDescription.trim();
    const total = moneyMode ? moneyTarget : Math.max(1, Number(newTotal) || 1);

    if (!title || !description) return;

    const next: Achievement = {
      id: `custom-${Date.now()}`,
      title,
      description,
      icon: goalTypeIcons[newGoalType],
      category: newCategory,
      progress: moneyMode ? moneyCurrent : 0,
      total,
      unlocked: moneyMode ? moneyCurrent >= moneyTarget : false,
      points: 0,
      rarity: 'common',
      goalType: newGoalType,
      syncWithGoals: true,
    };

    try {
      const created = await api.customAchievements.create(mapAchievementToApiPayload(next));
      saveCustomAchievements([mapApiCustomAchievement(created), ...customAchievements]);
    } catch (error) {
      console.error('Failed to create custom achievement in database', error);
      toast.error('Failed to save custom achievement.');
      return;
    }
    setNewTitle('');
    setNewDescription('');
    setNewTotal('1');
    setNewCategory('personal');
    setNewGoalType('gym');
    setMoneyGoalKind('saving');
    setMoneyCurrentAmount('0');
    setMoneyTargetAmount('1000');
    setShowCreateModal(false);
  };

  const addPersonalGoalFromTab = async () => {
    const title = goalTitle.trim();
    const description = goalDescription.trim();
    if (!title || !description) return;

    const isNumeric =
      goalTrackingType === 'count' || goalTrackingType === 'duration' || goalTrackingType === 'amount';
    const targetValue = Math.max(0, Number(goalTargetValue) || 0);
    if (isNumeric && !(targetValue > 0)) {
      toast.error('Enter a target value greater than zero for this tracking method.');
      return;
    }

    // Phase 6: changing the tracking method on a goal that already has check-ins
    // requires explicit confirmation. If the user cancels, do nothing.
    if (
      editingGoalId &&
      requiresTrackingChangeConfirmation(editingGoalOriginalTracking, goalTrackingType, editingGoalHasCheckIns) &&
      !window.confirm('Changing the tracking method may affect this goal’s historical progress. Continue?')
    ) {
      return;
    }

    // Authoritative personal_goals record only — no custom_achievements mirror.
    const payload = {
      goal_title: ensureMinText(title, 2, 'Personal Goal'),
      goal_category: mapAchievementCategoryToGoalCategory(goalCategory),
      goal_description: ensureMinText(description, 10, 'Personal growth goal to track progress over time.'),
      why_this_goal_matters: ensureMinText(goalWhyItMatters, 5, 'Improve wellbeing'),
      target_outcome: ensureMinText(goalTargetOutcome, 5, 'Steady progress'),
      priority_level: mapAchievementPriorityToGoalPriority(goalPriority),
      start_date: goalStartDate || new Date().toISOString().slice(0, 10),
      target_date: goalTargetDate || undefined,
      tracking_type: goalTrackingType,
      target_value: isNumeric ? targetValue : undefined,
      tracking_unit: isNumeric ? goalTrackingUnit.trim() || undefined : undefined,
      check_in_frequency: mapAchievementFrequencyToGoalFrequency(goalCheckInFrequency),
      reminder_enabled: goalReminderEnabled,
      small_action_steps: goalActionSteps
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      emotion_tag: mapMoodTagToGoalEmotionTag(goalMoodTag),
      support_type_needed: mapSupportTypeToGoalSupportType(goalSupportType),
      notes: goalNotes.trim() || undefined,
    };
    try {
      if (editingGoalId) {
        // Edit path: update the SAME goal id (never creates a new goal).
        await api.goals.update(editingGoalId, payload);
      } else {
        await api.goals.create(payload);
      }
    } catch (error) {
      console.error('Failed to save personal goal', error);
      toast.error(editingGoalId ? 'Failed to update personal goal.' : 'Failed to create personal goal.');
      return;
    }
    // Refetch so BOTH the goal card grid and Daily Check-in update immediately.
    await Promise.all([reloadGoals(), reloadPoints()]);
    setEditingGoalId(null);
    setGoalTrackingType('manual_milestone');
    setGoalTargetValue('');
    setGoalTrackingUnit('');
    setGoalTitle('');
    setGoalCategory('Mental');
    setGoalDescription('');
    setGoalWhyItMatters('');
    setGoalTargetOutcome('');
    setGoalPriority('Medium');
    setGoalStartDate('');
    setGoalTargetDate('');
    setGoalProgress('0');
    setGoalCheckInFrequency('Daily');
    setGoalActionSteps('');
    setGoalMoodTag('Stress');
    setGoalSupportType('Encouragement');
    setGoalNotes('');
    setGoalReminderEnabled(true);
    setGoalTemplateKey('');
    setPersonalGoalFormOpen(false);
    setShowCreateModal(false);
  };

  // Open the existing goal form pre-filled with a goal's values, in EDIT mode.
  const openEditGoal = (raw: Record<string, unknown>) => {
    const g = goalCardView(raw);
    setEditingGoalId(g.id);
    setGoalTitle(String(raw.goal_title ?? ''));
    setGoalDescription(String(raw.goal_description ?? ''));
    setGoalCategory(goalCategoryToFormCategory(g.rawCategory));
    setGoalWhyItMatters(String(raw.why_this_goal_matters ?? ''));
    setGoalTargetOutcome(String(raw.target_outcome ?? ''));
    setGoalPriority(goalPriorityToFormPriority(raw.priority_level));
    setGoalStartDate((raw.start_date as string) || '');
    setGoalTargetDate((raw.target_date as string) || '');
    setGoalTrackingType(g.trackingType);
    setGoalTargetValue(g.targetValue != null ? String(g.targetValue) : '');
    setGoalTrackingUnit(g.trackingUnit);
    setGoalAmountCustom(g.trackingType === 'amount' && !!g.trackingUnit && !isAmountPresetUnit(g.trackingUnit));
    setGoalNotes((raw.notes as string) || '');
    setGoalActionSteps(
      Array.isArray(raw.small_action_steps) ? (raw.small_action_steps as string[]).join(', ') : ''
    );
    setGoalReminderEnabled(Boolean(raw.reminder_enabled));
    // Phase 6 confirmation inputs: original method + whether check-ins exist.
    setEditingGoalOriginalTracking(g.trackingType);
    setEditingGoalHasCheckIns(Boolean(raw.last_check_in_date) || Number(raw.current_value ?? 0) > 0);
    setActiveAddTab('personal_goals');
    setPersonalGoalFormOpen(true);
    setShowCreateModal(true);
  };

  // Open the existing achievement form pre-filled, in EDIT mode. Only used for
  // the user's own custom achievements (never predefined ones).
  const openEditAchievement = (a: Achievement) => {
    const isNumeric =
      a.trackingType === 'count' || a.trackingType === 'duration' || a.trackingType === 'amount';
    setEditingAchievementId(a.id);
    setNewTitle(a.title);
    setNewDescription(a.description);
    setAchTrackingType(a.trackingType ?? 'count');
    setAchTargetValue(isNumeric && a.total ? String(a.total) : '');
    setAchTrackingUnit(a.trackingUnit ?? '');
    setAchAmountCustom(a.trackingType === 'amount' && !!a.trackingUnit && !isAmountPresetUnit(a.trackingUnit));
    setEditingAchievementOriginalTracking(a.trackingType ?? 'count');
    // Custom achievements track a check-in via last check-in date or progress.
    setEditingAchievementHasCheckIns(Boolean(a.lastCheckInDate) || Number(a.progress ?? 0) > 0);
    setActiveAddTab('personal_achievements');
    setShowCreateModal(true);
  };

  const resetPersonalGoalDraftFields = () => {
    setGoalTitle('');
    setGoalCategory('Mental');
    setGoalDescription('');
    setGoalWhyItMatters('');
    setGoalTargetOutcome('');
    setGoalPriority('Medium');
    setGoalStartDate('');
    setGoalTargetDate('');
    setGoalProgress('0');
    setGoalCheckInFrequency('Daily');
    setGoalActionSteps('');
    setGoalMoodTag('Stress');
    setGoalSupportType('Encouragement');
    setGoalNotes('');
    setGoalReminderEnabled(true);
  };

  const openPersonalGoalFormFromTemplate = () => {
    if (!goalTemplateKey) return;
    if (goalTemplateKey === 'custom') {
      resetPersonalGoalDraftFields();
    } else {
      const idx = Number(goalTemplateKey.slice(4));
      const seed = PREDEFINED_GOALS[idx];
      if (!seed) return;
      setGoalTitle(seed.goal_title);
      setGoalDescription(seed.goal_description);
      setGoalCategory(mapSeedCategoryToGoalCategory(seed.goal_category));
      setGoalWhyItMatters('');
      setGoalTargetOutcome('');
      setGoalPriority('Medium');
      setGoalStartDate('');
      setGoalTargetDate('');
      setGoalProgress('0');
      setGoalCheckInFrequency('Daily');
      setGoalActionSteps('');
      setGoalMoodTag('Stress');
      setGoalSupportType('Encouragement');
      setGoalNotes('');
      setGoalReminderEnabled(true);
    }
    setPersonalGoalFormOpen(true);
  };

  const backToPersonalGoalTemplatePicker = () => {
    setPersonalGoalFormOpen(false);
    setGoalTemplateKey('');
    setEditingGoalId(null);
    resetPersonalGoalDraftFields();
  };

  const addPersonalAchievementFromTab = async () => {
    const title = newTitle.trim();
    const description = newDescription.trim();
    if (!title || !description) return;

    const isNumeric =
      achTrackingType === 'count' || achTrackingType === 'duration' || achTrackingType === 'amount';
    const target = Math.max(0, Number(achTargetValue) || 0);
    if (
      editingAchievementId &&
      requiresTrackingChangeConfirmation(
        editingAchievementOriginalTracking,
        achTrackingType,
        editingAchievementHasCheckIns
      ) &&
      !window.confirm('Changing the tracking method may affect this achievement’s historical progress. Continue?')
    ) {
      return;
    }
    if (isNumeric && !(target > 0)) {
      toast.error('Enter a target value greater than zero for this tracking method.');
      return;
    }

    try {
      if (editingAchievementId) {
        // Edit path: update the SAME record. Send ONLY metadata + target/tracking
        // — never `progress`/`unlocked`/`points`, so current progress, completion
        // state, and reward flags are preserved. If the new target makes progress
        // reach it, the BACKEND completes + rewards (once) via the completion
        // service — the client computes/awards nothing.
        await api.customAchievements.update(editingAchievementId, {
          title,
          description,
          trackingType: achTrackingType,
          trackingUnit: isNumeric ? achTrackingUnit.trim() || undefined : undefined,
          total: isNumeric ? target : 100,
        });
      } else {
        const next: Achievement = {
          id: `personal-achievement-${Date.now()}`,
          title,
          description,
          icon: 'trophy',
          category: 'personal',
          progress: 0,
          // Manual milestone uses 100 (backend normalizes); numeric uses the target.
          total: isNumeric ? target : 100,
          unlocked: false,
          points: 0,
          rarity: 'common',
          goalType: 'custom',
          syncWithGoals: false,
          trackingType: achTrackingType,
          trackingUnit: isNumeric ? achTrackingUnit.trim() || undefined : undefined,
        };
        await api.customAchievements.create(mapAchievementToApiPayload(next));
      }
    } catch (error) {
      console.error('Failed to save personal achievement in database', error);
      toast.error(editingAchievementId ? 'Failed to update achievement.' : 'Failed to save personal achievement.');
      return;
    }
    // Refetch so the card grid reflects the change immediately (points/level too).
    await Promise.all([reloadCustomAchievements(), reloadPoints()]);
    setEditingAchievementId(null);
    setNewTitle('');
    setNewDescription('');
    setAchTrackingType('count');
    setAchTargetValue('');
    setAchTrackingUnit('');
    setShowCreateModal(false);
  };

  // Personal Goals come from the authoritative goals API (personal_goals),
  // normalized into the existing card shape so the approved cards are reused.
  const goalRowToDisplay = (g: Record<string, unknown>): Achievement => {
    const tracking = ((g.tracking_type as string) || 'manual_milestone') as NonNullable<Achievement['trackingType']>;
    const isNumeric = tracking === 'count' || tracking === 'duration' || tracking === 'amount';
    const pct = Math.max(0, Math.min(100, Math.round(Number(g.progress_percentage) || 0)));
    const target = g.target_value != null ? Number(g.target_value) : undefined;
    const current = g.current_value != null ? Number(g.current_value) : 0;
    return {
      id: String(g.id),
      title: String(g.goal_title || ''),
      description: String(g.goal_description || ''),
      icon: 'target',
      category: 'personal',
      progress: isNumeric && target ? Math.min(current, target) : pct,
      total: isNumeric && target ? target : 100,
      unlocked: String(g.status) === 'completed',
      points: 20,
      rarity: 'common',
      goalType: 'custom',
      lastCheckInDate: (g.last_check_in_date as string) || undefined,
      whyItMatters: (g.why_this_goal_matters as string) || undefined,
      targetOutcome: (g.target_outcome as string) || undefined,
      notes: (g.notes as string) || undefined,
      __source: 'goal',
      trackingType: tracking,
      targetValue: target,
      currentValue: current,
      trackingUnit: (g.tracking_unit as string) || undefined,
    };
  };

  // Backend-owned display rows used ONLY to resolve a Detail Workspace check-in
  // back to its source record. Covers personal goals + every custom achievement
  // (the check-in itself is submitted + validated by the existing handler).
  const allTrackItems: Achievement[] = [
    ...personalGoals.map(goalRowToDisplay),
    ...customAchievements.map((a) => ({ ...a, __source: 'achievement' as const })),
  ];

  const handleDailyGoalCheckIn = async (itemId: string) => {
    const entry: DailyGoalCheckInFields = {
      ...emptyDailyGoalCheckIn(),
      ...dailyCheckInInputs[itemId],
    };
    const source = allTrackItems.find((a) => a.id === itemId);
    if (!source) return;

    // Submit ONLY the user action (value or milestone). The backend derives the
    // official progress, completion, and reward — never the client.
    const tracking = source.trackingType ?? (source.__source === 'goal' ? 'manual_milestone' : 'count');
    const isManual = tracking === 'manual_milestone';
    const note =
      [entry.reflection, entry.challenges, entry.wins, entry.notes]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' · ') || undefined;

    const payload: { value?: number; milestone?: string; note?: string } = { note };
    if (isManual) {
      if (!entry.milestone) {
        toast.error('Select a progress milestone for this check-in.');
        return;
      }
      payload.milestone = entry.milestone;
    } else {
      const value = Number(entry.amount);
      if (!(value > 0)) {
        toast.error('Enter a value greater than zero for this check-in.');
        return;
      }
      payload.value = value;
    }

    try {
      if (source.__source === 'goal') {
        // Personal Goal: authoritative personal_goals record. Backend enforces
        // one check-in per calendar day (409 -> message), owns progress + reward.
        await api.goals.addCheckIn(source.id, {
          ...payload,
          mood: parseMoodForApi(entry.mood, source.moodTag),
          reflection: entry.reflection.trim() || undefined,
          challenges_faced: entry.challenges.trim() || undefined,
          wins: entry.wins.trim() || undefined,
        });
      } else {
        // Personal Achievement: DB-backed check-in table + backend-owned reward.
        await api.customAchievements.addCheckIn(source.id, payload);
      }
    } catch (error) {
      // Surfaces the backend validation message (e.g. duplicate daily check-in).
      const message = error instanceof Error ? error.message : 'Check-in failed to save.';
      console.error('Daily check-in failed', error);
      toast.error(message);
      return;
    }

    // Backend is the source of truth: refresh progress, unlocked, points, level.
    await Promise.all([reloadGoals(), reloadCustomAchievements(), reloadPoints()]);
    // If a detail modal is open, refetch its history so it updates immediately.
    setDetailRefreshKey((k) => k + 1);
    setDailyCheckInInputs((prev) => ({
      ...prev,
      [itemId]: emptyDailyGoalCheckIn(),
    }));
  };

  const checkInInputReady = (item: Achievement, inputState: DailyGoalCheckInFields): boolean => {
    const tracking = (item.trackingType ??
      (item.__source === 'goal' ? 'manual_milestone' : 'count')) as TrackingMethod;
    return tracking === 'manual_milestone'
      ? Boolean(inputState.milestone)
      : Number(inputState.amount) > 0;
  };

  // Tracking-aware check-in input: a numeric value or a milestone selector.
  // The client submits the raw action; the backend derives official progress.
  const renderCheckInValueField = (
    item: Achievement,
    inputState: DailyGoalCheckInFields,
    patchFields: (patch: Partial<DailyGoalCheckInFields>) => void,
    checkedToday: boolean
  ) => {
    const tracking = (item.trackingType ??
      (item.__source === 'goal' ? 'manual_milestone' : 'count')) as TrackingMethod;
    if (tracking === 'manual_milestone') {
      return (
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`ms-${item.id}`} className="text-zinc-300">
            Progress milestone
          </Label>
          <SolaceSelect
            value={inputState.milestone || '__none__'}
            onValueChange={(v) => patchFields({ milestone: v === '__none__' ? '' : v })}
            disabled={checkedToday}
            ariaLabel="Progress milestone"
            placeholder="Select milestone"
            variant="default"
            size="sm"
            triggerClassName="h-9"
            options={[
              { value: '__none__', label: 'Select milestone' },
              ...MILESTONE_STAGES.map((s) => ({ value: s.value, label: s.label })),
            ]}
          />
          <p className="text-[11px] text-zinc-500">
            A note is strongly encouraged for milestone check-ins — capture what changed.
          </p>
        </div>
      );
    }
    const unit = item.trackingUnit ? ` (${item.trackingUnit})` : '';
    return (
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`val-${item.id}`} className="text-zinc-300">
          {CHECK_IN_FIELD_LABELS[tracking]}
          {unit}
        </Label>
        <input
          id={`val-${item.id}`}
          type="number"
          min={0}
          value={inputState.amount}
          onChange={(e) => patchFields({ amount: e.target.value })}
          placeholder="0"
          disabled={checkedToday}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
        />
      </div>
    );
  };

  // Today's Check-In for the Detail Workspace. Relocates (does NOT rewrite) the
  // existing daily check-in form: the tracking-aware field + the same optional
  // detail fields. Goals + custom achievements share the same submit handler,
  // validation, and backend endpoints. Live updates happen inside that handler.
  const renderTodayCheckIn = (item: Achievement) => {
    const checkedToday = item.lastCheckInDate === new Date().toISOString().slice(0, 10);
    const inputState = { ...emptyDailyGoalCheckIn(), ...dailyCheckInInputs[item.id] };
    const patchFields = (patch: Partial<DailyGoalCheckInFields>) => {
      setDailyCheckInInputs((prev) => ({
        ...prev,
        [item.id]: { ...emptyDailyGoalCheckIn(), ...prev[item.id], ...patch },
      }));
    };
    const isGoal = item.__source === 'goal';
    return (
      <div className="mt-6 border-t border-white/10 pt-5" data-testid="detail-checkin">
        <h3 className="mb-1 text-sm font-semibold text-white">Today's Check-In</h3>
        <p className="mb-3 text-xs text-zinc-500">
          {checkedToday
            ? 'You already checked in today. Come back tomorrow to keep the streak going.'
            : 'Log today’s progress — the backend updates your progress, reward, points, and level.'}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {renderCheckInValueField(item, inputState, patchFields, checkedToday)}
          {isGoal ? (
            <>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`detail-mood-${item.id}`} className="text-zinc-300">
                  Emotion tag
                </Label>
                <SolaceSelect
                  value={inputState.mood || '__none__'}
                  onValueChange={(mood) => patchFields({ mood: mood === '__none__' ? '' : mood })}
                  disabled={checkedToday}
                  ariaLabel="Emotion tag"
                  placeholder="How are you feeling? (optional)"
                  variant="default"
                  size="sm"
                  triggerClassName="h-9"
                  options={[
                    { value: '__none__', label: 'How are you feeling? (optional)' },
                    ...GOAL_EMOTION_TAG_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
                  ]}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`detail-refl-${item.id}`} className="text-zinc-300">
                  Reflection
                </Label>
                <Textarea
                  id={`detail-refl-${item.id}`}
                  value={inputState.reflection}
                  onChange={(e) => patchFields({ reflection: e.target.value })}
                  placeholder="What stood out today?"
                  disabled={checkedToday}
                  rows={3}
                  className="min-h-[80px] border-white/15 bg-black/40 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`detail-chal-${item.id}`} className="text-zinc-300">
                  Challenges faced
                </Label>
                <Textarea
                  id={`detail-chal-${item.id}`}
                  value={inputState.challenges}
                  onChange={(e) => patchFields({ challenges: e.target.value })}
                  placeholder="Optional"
                  disabled={checkedToday}
                  rows={3}
                  className="border-white/15 bg-black/40 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`detail-wins-${item.id}`} className="text-zinc-300">
                  Wins
                </Label>
                <Textarea
                  id={`detail-wins-${item.id}`}
                  value={inputState.wins}
                  onChange={(e) => patchFields({ wins: e.target.value })}
                  placeholder="Optional"
                  disabled={checkedToday}
                  rows={3}
                  className="border-white/15 bg-black/40 text-white"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`detail-notes-${item.id}`} className="text-zinc-300">
                  Notes for this check-in
                </Label>
                <Textarea
                  id={`detail-notes-${item.id}`}
                  value={inputState.notes}
                  onChange={(e) => patchFields({ notes: e.target.value })}
                  placeholder="Optional"
                  disabled={checkedToday}
                  rows={2}
                  className="border-white/15 bg-black/40 text-white"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`detail-note-${item.id}`} className="text-zinc-300">
                Note for this check-in
              </Label>
              <Textarea
                id={`detail-note-${item.id}`}
                value={inputState.notes}
                onChange={(e) => patchFields({ notes: e.target.value })}
                placeholder="Optional"
                disabled={checkedToday}
                rows={2}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="detail-checkin-submit"
          onClick={() => void handleDailyGoalCheckIn(item.id)}
          disabled={checkedToday || !checkInInputReady(item, inputState)}
          className="mt-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkedToday ? 'Checked in today' : 'Submit check-in'}
        </button>
      </div>
    );
  };

  // Phase 12: the create modal must not dismiss on outside click, and must
  // protect unsaved changes. It closes only via Close/Cancel (guarded) or a
  // successful save (which sets showCreateModal false directly).
  const isCreateFormDirty = () =>
    Boolean(
      newTitle.trim() ||
        newDescription.trim() ||
        goalTitle.trim() ||
        goalDescription.trim() ||
        goalWhyItMatters.trim() ||
        goalTargetOutcome.trim() ||
        goalActionSteps.trim() ||
        goalNotes.trim()
    );

  const requestCloseCreateModal = () => {
    if (isCreateFormDirty() && !window.confirm('Discard your unsaved changes?')) return;
    setShowCreateModal(false);
  };

  const generateThirtyDayReport = () => {
    const now = new Date();
    const lastThirtyDaysStart = new Date(now);
    lastThirtyDaysStart.setDate(now.getDate() - 29);
    const startKey = lastThirtyDaysStart.toISOString().slice(0, 10);
    const endKey = now.toISOString().slice(0, 10);

    const goals = customAchievements.filter((a) =>
      ['personal', 'self_improvement', 'professional'].includes(a.category)
    );

    const reportLines = goals.map((goal) => {
      const history = Array.isArray(goal.checkInHistory) ? goal.checkInHistory : [];
      const checkInsInRange = history.filter((d) => d >= startKey && d <= endKey);
      return `- ${goal.title} (${goal.goalType ? goalTypeLabels[goal.goalType] : 'Personal Goal'}): ${checkInsInRange.length} check-ins, progress ${goal.progress}/${goal.total}${goal.unlocked ? ' (completed)' : ''}`;
    });

    const generated = [
      '30-Day Personal Goals Report',
      `Period: ${lastThirtyDaysStart.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      '',
      `Total goals tracked: ${goals.length}`,
      `Completed goals: ${goals.filter((g) => g.unlocked).length}`,
      '',
      'Goal details:',
      ...(reportLines.length ? reportLines : ['- No personal goals added yet.']),
    ].join('\n');

    const fileDate = now.toISOString().slice(0, 10);
    const fileName = `personal-goals-report-${fileDate}.txt`;
    const blob = new Blob([generated], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setReportText(generated);
  };

  const copyReport = async () => {
    if (!reportText.trim()) return;
    try {
      await navigator.clipboard.writeText(reportText);
    } catch (error) {
      console.error('Failed to copy report', error);
    }
  };

  const scrollToAchievement = (id: string) => {
    document.getElementById(`ach-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const journeyNodes: {
    key: string;
    label: string;
    sub: string;
    icon: LucideIcon;
  }[] = [
    { key: 'start', label: 'Start', sub: 'Your story begins', icon: User },
    { key: 'explore', label: 'Explore', sub: 'Discover what supports you', icon: Compass },
    { key: 'grow', label: 'Grow', sub: 'Small wins compound', icon: Trophy },
    { key: 'inspire', label: 'Inspire', sub: 'Lift others as you rise', icon: Sparkles },
    { key: 'transform', label: 'Transform', sub: 'Become who you are meant to be', icon: Crown },
  ];

  const unlockPct =
    stats.totalCount > 0 ? Math.min(100, (stats.unlockedCount / stats.totalCount) * 100) : 0;

  const FeaturedIcon = recentUnlocked ? getIcon(recentUnlocked.icon) : Trophy;

  return (
    <>
      <div className={cn(achievementsPageRoot, 'relative min-h-full pb-12')}>
        <div className={achievementsPageGlowTop} aria-hidden />
        <div className={achievementsPageFogMid} aria-hidden />
        <div className={achievementsPageVignette} aria-hidden />
        <div className="relative z-10 mx-auto max-w-[1580px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/app/settings"
              className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to Settings
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex min-h-[44px] w-fit items-center justify-center rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-semibold text-zinc-100 transition hover:border-fuchsia-400/25 hover:bg-white/[0.09]"
            >
              Add personal milestone
            </button>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-10">
            <div className="min-w-0 space-y-8 sm:space-y-10">
              {/* Hero — full-bleed lotus scene */}
              <section className={achievementsHeroShell}>
                <img
                  src={ACHIEVEMENTS_IMAGES.hero}
                  alt="Glowing lotus on a moonlit lake with mountains at twilight"
                  className={cn(achievementsHeroImage, 'object-[58%_50%]')}
                  width={1600}
                  height={520}
                  loading="eager"
                  decoding="async"
                />
                <div className={achievementsHeroLightScrim} aria-hidden />
                <div className={cn(achievementsHeroOverlay, 'pointer-events-none absolute inset-0 z-[1]')} aria-hidden />
                <div className={cn(achievementsHeroOverlayBottom, 'pointer-events-none absolute inset-0 z-[1]')} aria-hidden />
                <div
                  className={cn(
                    achievementsHeroContent,
                    'flex min-h-[280px] flex-col justify-center px-6 py-10 sm:min-h-[320px] sm:px-10 sm:py-12 lg:min-h-[340px] lg:px-12'
                  )}
                >
                  <h1 className={achievementsHeroTitle}>Achievements</h1>
                  <p className={achievementsHeroSubtitle}>
                    Celebrate your growth and the milestones that shape your best self.
                  </p>
                </div>
              </section>

              {/* Progress summary strip */}
              <section className={achievementsStatStrip}>
                <div className="grid grid-cols-2 divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                  <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-4 sm:py-3">
                    <div className={achievementsStatIconChip('amber')} aria-hidden>
                      <Award className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Unlocked</p>
                      <p className="truncate font-serif text-lg text-white sm:text-xl">
                        {stats.unlockedCount}
                        <span className="text-zinc-500">/{stats.totalCount}</span>
                      </p>
                      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400/90 to-orange-500/90"
                          style={{ width: `${unlockPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-4 sm:py-3">
                    <div className={achievementsStatIconChip('violet')} aria-hidden>
                      <Star className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total points</p>
                      <p className="font-serif text-lg text-white sm:text-xl">{stats.totalPoints.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-4 sm:py-3">
                    <div className={achievementsStatIconChip('emerald')} aria-hidden>
                      <Flame className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Current streak
                      </p>
                      <p className="font-serif text-lg text-white sm:text-xl">
                        {stats.currentStreak}
                        <span className="text-sm font-sans font-normal text-zinc-500"> days</span>
                      </p>
                      <p className="text-[11px] text-zinc-500">Keep going!</p>
                    </div>
                  </div>
                  <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-4 sm:py-3">
                    <div className={achievementsStatIconChip('blue')} aria-hidden>
                      <Crown className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Longest streak
                      </p>
                      <p className="font-serif text-lg text-white sm:text-xl">
                        {stats.longestStreak}
                        <span className="text-sm font-sans font-normal text-zinc-500"> days</span>
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Category filters */}
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isActive = selectedCategory === category.id;
                  return (
                    <motion.button
                      key={category.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCategory(category.id)}
                      className={achievementsCategoryPill(isActive)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      {category.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Recently unlocked */}
              <section className={achievementsRecentSection}>
                {recentUnlocked ? (
                  <>
                    <VaultParticles className="opacity-35" />
                    <div className="relative z-10 grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                      <div className="flex justify-center lg:justify-start">
                        <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
                          <div className="absolute inset-0 rotate-45 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/15 via-fuchsia-900/20 to-violet-950/50" />
                          <div className="absolute inset-2.5 rotate-45 rounded-xl border border-white/10 bg-black/35" />
                          <FeaturedIcon className={achievementsRecentBadgeIcon} aria-hidden />
                        </div>
                      </div>
                      <div className="min-w-0 space-y-2 text-center lg:text-left">
                        <p className={achievementsRecentLabel}>Recently Unlocked</p>
                        <h2 className="font-serif text-2xl font-semibold text-white sm:text-3xl">{recentUnlocked.title}</h2>
                        <p className="text-sm leading-relaxed text-zinc-400">{recentUnlocked.description}</p>
                      </div>
                      <div className="flex flex-col items-center gap-4 lg:items-end">
                        <p className="text-center text-xs text-zinc-500 lg:text-right">
                          {formatUnlockDate(recentUnlocked) ? (
                            <>
                              <span className="block text-zinc-500">Unlocked</span>
                              <span className="text-zinc-300">{formatUnlockDate(recentUnlocked)}</span>
                            </>
                          ) : (
                            <span className="text-zinc-500">Earned on your journey</span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => scrollToAchievement(recentUnlocked.id)}
                          className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-full border border-fuchsia-400/28 bg-fuchsia-950/50 px-5 text-sm font-semibold text-fuchsia-50 transition hover:border-fuchsia-300/40 hover:bg-fuchsia-900/55"
                        >
                          View Achievement
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative z-10 py-6 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Recently Unlocked
                    </p>
                    <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">
                      When you unlock your next milestone, it will take center stage here—quietly celebrating what you
                      have earned.
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-5" data-testid="goals-achievements-section">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-white sm:text-3xl">Goals &amp; Achievements</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {combinedItems.length} shown · {stats.unlockedCount} of {stats.totalCount} achievements unlocked
                    </p>
                  </div>
                  <div
                    role="group"
                    aria-label="Filter goals and achievements"
                    className="inline-flex rounded-full border border-white/12 bg-white/[0.04] p-1"
                  >
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'goals', label: 'Goals' },
                        { id: 'achievements', label: 'Achievements' },
                      ] as const
                    ).map((f) => {
                      const active = gamificationFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          data-testid={`gamification-filter-${f.id}`}
                          aria-pressed={active}
                          onClick={() => setGamificationFilter(f.id)}
                          className={cn(
                            'min-h-[36px] rounded-full px-4 text-sm font-medium transition',
                            active ? 'bg-white/[0.12] text-white' : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {combinedItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {combinedItems.map((item, index) =>
                      item.itemType === 'goal'
                        ? renderGoalCard(item.data)
                        : renderAchievementCard(item.data, index)
                    )}
                  </div>
                ) : initialLoadDone ? (
                  <div
                    data-testid="gamification-empty-state"
                    className="rounded-3xl border border-dashed border-white/[0.12] bg-[var(--solace-card-bg)] py-16 text-center backdrop-blur-xl"
                  >
                    <Trophy className="mx-auto mb-4 h-14 w-14 text-fuchsia-400/35" aria-hidden />
                    <h3 className="font-serif text-xl font-semibold text-white">{combinedEmptyMessage}</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                      Create a personal goal or achievement to get started.
                    </p>
                  </div>
                ) : null}

                {gamificationFilter !== 'goals' && filteredAchievements.length > 8 ? (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllAchievements((v) => !v)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-medium text-zinc-200 transition hover:border-fuchsia-400/25 hover:bg-white/[0.07]"
                    >
                      {showAllAchievements ? 'Show fewer achievements' : 'Show More Achievements'}
                    </button>
                  </div>
                ) : null}
              </section>

          {/* Achievement Journey */}
          <section className={achievementsJourneySection}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.06),transparent_42%)] [html[data-ezri-theme=light]_&]:opacity-40 [html[data-theme=light]_&]:opacity-40" />
            <h2 className={achievementsJourneyTitle}>Achievement Journey</h2>
            <p className={achievementsJourneySubtitle}>
              A gentle arc from your first brave step to the future you are building — one unlock at a time.
            </p>

            {selectedAchievement ? (
              <div className={achievementsJourneyFocusCard}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 [html[data-ezri-theme=light]_&]:text-[var(--text-muted)] [html[data-theme=light]_&]:text-[var(--text-muted)]">
                  Journey focus
                </p>
                <p className="mt-1 text-sm font-semibold text-white [html[data-ezri-theme=light]_&]:text-[var(--text-primary)] [html[data-theme=light]_&]:text-[var(--text-primary)]">
                  {selectedAchievement.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400 [html[data-ezri-theme=light]_&]:text-[var(--text-secondary)] [html[data-theme=light]_&]:text-[var(--text-secondary)]">
                  {selectedAchievement.unlocked ? (
                    <>
                      Earned and held — the path ahead stays lit through{' '}
                      <span className="text-zinc-300">{journeyNodes[journeyHighlightIndex]?.label ?? 'today'}</span>.
                    </>
                  ) : (
                    <>
                      Still unfolding: you are oriented toward{' '}
                      <span className="text-zinc-300">{journeyNodes[journeyHighlightIndex]?.label ?? 'the next step'}</span>
                      {' '}
                      <span className="tabular-nums text-zinc-500">
                        ({selectedAchievement.progress}/{Math.max(1, selectedAchievement.total)} toward unlock).
                      </span>
                    </>
                  )}
                </p>
              </div>
            ) : null}

            <div className="relative mt-8 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible">
              <div className="relative mx-auto flex min-w-[520px] justify-between gap-3 px-1 sm:min-w-0 sm:gap-2 sm:px-0">
                <div
                  className="pointer-events-none absolute left-[10%] right-[10%] top-[22px] hidden h-px sm:block"
                  style={{
                    background:
                      'repeating-linear-gradient(90deg, rgba(168,85,247,0.45) 0, rgba(168,85,247,0.45) 5px, transparent 5px, transparent 11px), linear-gradient(90deg, rgba(34,211,238,0.12), rgba(251,191,36,0.12))',
                  }}
                  aria-hidden
                />
                {journeyNodes.map((node, idx) => {
                  const JIcon = node.icon;
                  const highlightIdx = journeyHighlightIndex;
                  const active = idx === highlightIdx;
                  const passed = idx < highlightIdx;
                  const isFinal = idx === journeyNodes.length - 1;
                  const nodeState = active ? 'active' : passed ? 'passed' : 'upcoming';
                  return (
                    <div key={node.key} className="relative z-10 flex min-w-[88px] flex-1 flex-col items-center text-center sm:min-w-0">
                      <div className="relative mb-2 flex h-12 w-12 items-center justify-center">
                        {active ? (
                          <span
                            className="absolute inset-0 rounded-full bg-fuchsia-500/15 blur-md [html[data-ezri-theme=light]_&]:bg-violet-300/25 [html[data-theme=light]_&]:bg-violet-300/25"
                            aria-hidden
                          />
                        ) : null}
                        {isFinal && active ? (
                          <span
                            className="absolute -inset-1 rounded-full bg-amber-400/10 blur-md [html[data-ezri-theme=light]_&]:bg-amber-300/20 [html[data-theme=light]_&]:bg-amber-300/20"
                            aria-hidden
                          />
                        ) : null}
                        <div className={achievementsJourneyNodeCircle(nodeState)}>
                          <JIcon aria-hidden />
                        </div>
                      </div>
                      <p className={achievementsJourneyNodeLabel(active)}>{node.label}</p>
                      <p className={achievementsJourneyNodeSub}>{node.sub}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>


          <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[var(--solace-card-bg)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold text-white">30-day reflection export</h2>
                <p className="text-sm text-zinc-400">A quiet text snapshot of your personal goal check-ins.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={generateThirtyDayReport}
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]"
                >
                  Generate
                </button>
                <button
                  type="button"
                  onClick={copyReport}
                  disabled={!reportText}
                  className="rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy
                </button>
              </div>
            </div>
            <textarea
              value={reportText}
              readOnly
              placeholder="Generate to view your last 30 days summary."
              className="min-h-40 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-zinc-200"
            />
          </div>
            </div>

            <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-3xl border border-white/[0.08] bg-[var(--solace-card-bg)] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Your Progress</p>
                <div className="relative mx-auto mt-4 size-36 overflow-hidden sm:size-40">
                  <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={`url(#${journeyRingId})`}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(overallCompletionPct / 100) * 251.2} 251.2`}
                    />
                    <defs>
                      <linearGradient id={journeyRingId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d8b4fe" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <p className="font-serif text-xl font-semibold leading-none tabular-nums text-white sm:text-2xl">
                      {overallCompletionPct}%
                    </p>
                    <p className="mt-1 max-w-[4.5rem] text-[9px] font-medium uppercase leading-tight tracking-wide text-zinc-500 sm:max-w-[5rem] sm:text-[10px]">
                      Overall completion
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-zinc-400">
                  {stats.unlockedCount} of {stats.totalCount} achievements unlocked
                </p>
              </div>

              <div className="rounded-3xl border border-white/[0.08] bg-[var(--solace-card-bg)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className={achievementsRailIconChip('violet')} aria-hidden>
                    <Diamond className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Total Points · Level {currentLevel}</p>
                    <p className="font-serif text-xl text-white sm:text-2xl">{stats.totalPoints.toLocaleString()}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {`${pointsToNext.toLocaleString()} pts to Level ${currentLevel + 1}`}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500/90 to-cyan-400/90"
                    style={{ width: `${Math.min(100, Math.max(0, levelProgressPct))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  Current level · Level {currentLevel}
                </p>
              </div>

              <div className="rounded-3xl border border-orange-400/15 bg-[var(--solace-card-bg)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl [html[data-ezri-theme=light]_&:border-amber-200/50 [html[data-theme=light]_&:border-amber-200/50">
                <div className="flex items-start gap-3">
                  <div className={cn(achievementsRailIconChip('amber'), 'mt-0.5 !h-10 !w-10')} aria-hidden>
                    <Flame className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="font-serif text-base font-semibold text-white">Keep Going!</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-300">
                      Consistency is the key to transformation.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      {nextClosestAchievement ? (
                        <>
                          Next milestone in reach:{' '}
                          <span className="text-zinc-400">{nextClosestAchievement.title}</span>
                          <span className="tabular-nums text-zinc-600">
                            {' '}
                            ({nextClosestAchievement.progress}/{Math.max(1, nextClosestAchievement.total)}).
                          </span>
                        </>
                      ) : (
                        'Your next milestone is forming as you return to what supports you.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[var(--solace-card-bg)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(251,191,36,0.08),transparent_48%)]" />
                <div className="relative flex items-start gap-3">
                  <div className={cn(achievementsRailIconChip('cyan'), 'mt-0.5 !h-10 !w-10')} aria-hidden>
                    <Headphones className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-serif text-base font-semibold text-white">Need Help?</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      We&apos;re here to support your journey, always.
                    </p>
                  </div>
                </div>
                <Link
                  to="/app/settings/help-support"
                  className="relative mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-cyan-400/22 bg-white/[0.05] py-2.5 text-sm font-semibold text-cyan-100/95 transition hover:border-cyan-300/35 hover:bg-white/[0.08]"
                >
                  Contact Support
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {showCreateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={modalOverlay}
          /* Phase 12: outside-click must NOT dismiss the create modal. */
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className={cn(modalPanelLg, "max-h-[90vh] overflow-y-auto p-6")}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className={modalTitle}>Add your own achievement</h2>
              <button
                type="button"
                onClick={requestCloseCreateModal}
                className={modalCloseButton}
              >
                Close
              </button>
            </div>
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveAddTab('personal_goals');
                  setPersonalGoalFormOpen(false);
                  setGoalTemplateKey('');
                }}
                className={activeAddTab === 'personal_goals' ? modalTabActive : modalTabInactive}
              >
                Personal Goals
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAddTab('personal_achievements');
                  setPersonalGoalFormOpen(false);
                  setGoalTemplateKey('');
                }}
                className={activeAddTab === 'personal_achievements' ? modalTabActive : modalTabInactive}
              >
                Personal Achievements
              </button>
            </div>

            {activeAddTab === 'personal_goals' ? (
              <>
                {!personalGoalFormOpen ? (
                  <div className="space-y-3">
                    <p className={modalBodyText}>
                      Select a goal from the catalog (grouped by area), then continue to the form to add details and save.
                    </p>
                    <label htmlFor="achievement-goal-template" className="sr-only">
                      Goal template
                    </label>
                    <SolaceSelect
                      id="achievement-goal-template"
                      value={goalTemplateKey}
                      onValueChange={(v) => setGoalTemplateKey(v as PersonalGoalTemplateKey)}
                      ariaLabel="Goal template"
                      placeholder="Select a goal…"
                      variant="form"
                      groups={achievementGoalTemplateGroups}
                      options={[{ value: "custom", label: "Custom goal (write your own)" }]}
                    />
                    <button
                      type="button"
                      disabled={!goalTemplateKey}
                      onClick={openPersonalGoalFormFromTemplate}
                      className={cn(modalPrimaryButton, "w-full sm:w-auto")}
                    >
                      Continue to form
                    </button>
                  </div>
                ) : (
                  <>
                <button
                  type="button"
                  onClick={backToPersonalGoalTemplatePicker}
                  className={cn("mb-3", modalLink)}
                >
                  ← Change goal template
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-title" className={modalLabel}>Goal Title</label>
                    <input id="pg-title" type="text" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. Build a daily meditation habit" className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-category" className={modalLabel}>Category</label>
                    <SolaceSelect
                      id="pg-category"
                      value={goalCategory}
                      onValueChange={(v) => setGoalCategory(v as NonNullable<Achievement['goalCategory']>)}
                      ariaLabel="Goal category"
                      variant="form"
                      options={[
                        { value: "Mental", label: "Mental" },
                        { value: "Emotional", label: "Emotional" },
                        { value: "Productivity", label: "Productivity" },
                        { value: "Relationships", label: "Relationships" },
                        { value: "Wellness", label: "Wellness" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-description" className={modalLabel}>Goal Description</label>
                    <input id="pg-description" type="text" value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Briefly describe your goal" className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-why" className={modalLabel}>Why This Goal Matters</label>
                    <input id="pg-why" type="text" value={goalWhyItMatters} onChange={(e) => setGoalWhyItMatters(e.target.value)} placeholder="What motivates you to pursue this?" className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-outcome" className={modalLabel}>Target Outcome</label>
                    <input id="pg-outcome" type="text" value={goalTargetOutcome} onChange={(e) => setGoalTargetOutcome(e.target.value)} placeholder="What does success look like?" className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-priority" className={modalLabel}>Priority Level</label>
                    <SolaceSelect
                      id="pg-priority"
                      value={goalPriority}
                      onValueChange={(v) => setGoalPriority(v as NonNullable<Achievement['priority']>)}
                      ariaLabel="Priority level"
                      variant="form"
                      options={[
                        { value: "Low", label: "Low" },
                        { value: "Medium", label: "Medium" },
                        { value: "High", label: "High" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-start" className={modalLabel}>Start Date</label>
                    <input id="pg-start" type="date" value={goalStartDate} onChange={(e) => setGoalStartDate(e.target.value)} className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-target" className={modalLabel}>Target Date</label>
                    <input id="pg-target" type="date" value={goalTargetDate} onChange={(e) => setGoalTargetDate(e.target.value)} className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-tracking" className={modalLabel}>How would you like to track your progress?</label>
                    <SolaceSelect
                      id="pg-tracking"
                      value={goalTrackingType}
                      onValueChange={(v) => {
                        const t = v as typeof goalTrackingType;
                        setGoalTrackingType(t);
                        setGoalAmountCustom(false);
                        setGoalTrackingUnit(t === 'duration' ? 'minutes' : t === 'amount' ? 'currency' : '');
                      }}
                      ariaLabel="How would you like to track your progress?"
                      variant="form"
                      options={[
                        { value: "count", label: TRACKING_METHOD_LABELS.count },
                        { value: "duration", label: TRACKING_METHOD_LABELS.duration },
                        { value: "amount", label: TRACKING_METHOD_LABELS.amount },
                        { value: "manual_milestone", label: TRACKING_METHOD_LABELS.manual_milestone },
                      ]}
                    />
                  </div>
                  {goalTrackingType !== 'manual_milestone' ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="pg-target-value" className={modalLabel}>Target Value</label>
                        <input id="pg-target-value" type="number" min={1} value={goalTargetValue} onChange={(e) => setGoalTargetValue(e.target.value)} placeholder="e.g. 10" className={modalInput} />
                      </div>
                      {goalTrackingType === 'duration' ? (
                        <div className="flex flex-col gap-1">
                          <label htmlFor="pg-duration-unit" className={modalLabel}>Unit</label>
                          <SolaceSelect
                            id="pg-duration-unit"
                            value={goalTrackingUnit || 'minutes'}
                            onValueChange={(v) => setGoalTrackingUnit(v)}
                            ariaLabel="Duration unit"
                            variant="form"
                            options={DURATION_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                          />
                        </div>
                      ) : null}
                      {goalTrackingType === 'amount' ? (
                        <>
                          <div className="flex flex-col gap-1">
                            <label htmlFor="pg-amount-unit" className={modalLabel}>Unit</label>
                            <SolaceSelect
                              id="pg-amount-unit"
                              value={goalAmountCustom ? 'custom' : goalTrackingUnit || 'currency'}
                              onValueChange={(v) => {
                                if (v === 'custom') {
                                  setGoalAmountCustom(true);
                                  setGoalTrackingUnit('');
                                } else {
                                  setGoalAmountCustom(false);
                                  setGoalTrackingUnit(v);
                                }
                              }}
                              ariaLabel="Amount unit"
                              variant="form"
                              options={AMOUNT_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                            />
                          </div>
                          {goalAmountCustom ? (
                            <div className="flex flex-col gap-1">
                              <label htmlFor="pg-custom-unit" className={modalLabel}>Custom unit</label>
                              <input id="pg-custom-unit" type="text" value={goalTrackingUnit} onChange={(e) => setGoalTrackingUnit(e.target.value)} placeholder="e.g. reps, pages, glasses" className={modalInput} />
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-frequency" className={modalLabel}>Check-in Frequency</label>
                    <SolaceSelect
                      id="pg-frequency"
                      value={goalCheckInFrequency}
                      onValueChange={(v) =>
                        setGoalCheckInFrequency(v as NonNullable<Achievement['checkInFrequency']>)
                      }
                      ariaLabel="Check-in frequency"
                      variant="form"
                      options={[
                        { value: "Daily", label: "Daily" },
                        { value: "Weekly", label: "Weekly" },
                        { value: "Custom", label: "Custom" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-actions" className={modalLabel}>Small Action Steps</label>
                    <input id="pg-actions" type="text" value={goalActionSteps} onChange={(e) => setGoalActionSteps(e.target.value)} placeholder="Comma-separated steps, e.g. Read 10 pages, Journal 5 min" className={modalInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-mood" className={modalLabel}>Emotion Tag</label>
                    <SolaceSelect
                      id="pg-mood"
                      value={goalMoodTag}
                      onValueChange={(v) => setGoalMoodTag(v as NonNullable<Achievement['moodTag']>)}
                      ariaLabel="Emotion tag"
                      variant="form"
                      options={[
                        { value: "Stress", label: "Stress" },
                        { value: "Sadness", label: "Sadness" },
                        { value: "Fear", label: "Fear" },
                        { value: "Confidence", label: "Confidence" },
                        { value: "Motivation", label: "Motivation" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-support" className={modalLabel}>Support Type Needed</label>
                    <SolaceSelect
                      id="pg-support"
                      value={goalSupportType}
                      onValueChange={(v) =>
                        setGoalSupportType(v as NonNullable<Achievement['supportType']>)
                      }
                      ariaLabel="Support type needed"
                      variant="form"
                      options={[
                        { value: "Encouragement", label: "Encouragement" },
                        { value: "Accountability", label: "Accountability" },
                        { value: "Reflection", label: "Reflection" },
                        { value: "Coping Help", label: "Coping Help" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-notes" className={modalLabel}>Notes / Journal Entry</label>
                    <input id="pg-notes" type="text" value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} placeholder="Any additional notes (optional)" className={modalInput} />
                  </div>
                </div>
                <label className={cn("mt-3", modalCheckboxLabel)}>
                  <input type="checkbox" checked={goalReminderEnabled} onChange={(e) => setGoalReminderEnabled(e.target.checked)} />
                  Reminder Enabled
                </label>
                <p className="mt-3 text-xs text-zinc-400">
                  Goal Completion Reward: <span className="font-semibold text-white">20 Points</span> — awarded automatically by the backend at 100%.
                </p>
                <button type="button" onClick={addPersonalGoalFromTab} className={cn(modalPrimaryButton, "mt-4")}>
                  {editingGoalId ? 'Update Personal Goal' : 'Save Personal Goal'}
                </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Achievement Title" className={modalInput} />
                  <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Achievement Description" className={modalInput} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pa-tracking" className={modalLabel}>How would you like to track your progress?</label>
                    <SolaceSelect
                      id="pa-tracking"
                      value={achTrackingType}
                      onValueChange={(v) => {
                        const t = v as typeof achTrackingType;
                        setAchTrackingType(t);
                        setAchAmountCustom(false);
                        setAchTrackingUnit(t === 'duration' ? 'minutes' : t === 'amount' ? 'currency' : '');
                      }}
                      ariaLabel="How would you like to track your progress?"
                      variant="form"
                      options={[
                        { value: "count", label: TRACKING_METHOD_LABELS.count },
                        { value: "duration", label: TRACKING_METHOD_LABELS.duration },
                        { value: "amount", label: TRACKING_METHOD_LABELS.amount },
                        { value: "manual_milestone", label: TRACKING_METHOD_LABELS.manual_milestone },
                      ]}
                    />
                  </div>
                  {achTrackingType !== 'manual_milestone' ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input type="number" min={1} value={achTargetValue} onChange={(e) => setAchTargetValue(e.target.value)} placeholder="Target value (e.g. 10)" className={modalInput} />
                      {achTrackingType === 'duration' ? (
                        <SolaceSelect
                          id="pa-duration-unit"
                          value={achTrackingUnit || 'minutes'}
                          onValueChange={(v) => setAchTrackingUnit(v)}
                          ariaLabel="Duration unit"
                          variant="form"
                          options={DURATION_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                        />
                      ) : null}
                      {achTrackingType === 'amount' ? (
                        <SolaceSelect
                          id="pa-amount-unit"
                          value={achAmountCustom ? 'custom' : achTrackingUnit || 'currency'}
                          onValueChange={(v) => {
                            if (v === 'custom') {
                              setAchAmountCustom(true);
                              setAchTrackingUnit('');
                            } else {
                              setAchAmountCustom(false);
                              setAchTrackingUnit(v);
                            }
                          }}
                          ariaLabel="Amount unit"
                          variant="form"
                          options={AMOUNT_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                        />
                      ) : null}
                      {achTrackingType === 'amount' && achAmountCustom ? (
                        <input id="pa-custom-unit" type="text" value={achTrackingUnit} onChange={(e) => setAchTrackingUnit(e.target.value)} placeholder="Custom unit (e.g. reps)" className={modalInput} />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  Achievement Completion Reward: <span className="font-semibold text-white">10 Points</span> — awarded automatically by the backend at 100%.
                </p>
                <button type="button" onClick={addPersonalAchievementFromTab} className={cn(modalPrimaryButton, "mt-4")}>
                  {editingAchievementId ? 'Update Personal Achievement' : 'Save Personal Achievement'}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}

      {detailItem
        ? (() => {
            const isGoal = detailItem.itemType === 'goal';
            const goalRaw = isGoal
              ? personalGoals.find((g) => String((g as { id?: unknown }).id) === detailItem.id)
              : undefined;
            const ach = !isGoal ? achievements.find((a) => a.id === detailItem.id) : undefined;
            if ((isGoal && !goalRaw) || (!isGoal && !ach)) return null;
            const view = isGoal
              ? buildGoalDetail(goalRaw as Record<string, unknown>)
              : buildAchievementDetail(ach as Achievement, customAchievementIds.has(detailItem.id));
            const fmtDate = (d: string | null) => {
              if (!d) return null;
              try {
                return format(new Date(d.length <= 10 ? `${d}T12:00:00` : d), 'MMM d, yyyy');
              } catch {
                return d;
              }
            };
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={modalOverlay}
                data-testid="detail-modal"
                /* Phase 5: outside-click / focus-loss must NOT dismiss. */
              >
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                  className={cn(modalPanelLg, 'max-h-[90vh] overflow-y-auto p-6')}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{view.typeLabel}</p>
                      <h2 className={modalTitle}>{view.title}</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isGoal || customAchievementIds.has(detailItem.id) ? (
                        <button
                          type="button"
                          data-testid="detail-edit"
                          onClick={() => {
                            // Phase 5: reuse the existing edit form. Close the
                            // workspace first (chosen: no stacked modals).
                            setDetailItem(null);
                            if (isGoal && goalRaw) openEditGoal(goalRaw as Record<string, unknown>);
                            else if (ach) openEditAchievement(ach);
                          }}
                          className={modalCloseButton}
                        >
                          Edit
                        </button>
                      ) : null}
                      <button type="button" data-testid="detail-close" onClick={() => setDetailItem(null)} className={modalCloseButton}>
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-zinc-300">
                    {view.category ? (<p><span className="text-zinc-500">Category: </span>{view.category}</p>) : null}
                    {view.description ? (<p><span className="text-zinc-500">Description: </span>{view.description}</p>) : null}
                    <p className="capitalize"><span className="text-zinc-500">Status: </span>{view.completed ? 'Completed' : view.status.replace(/_/g, ' ')}</p>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Progress · {view.trackingMethodLabel}</span>
                      <span className="tabular-nums text-zinc-300">{view.progressPct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 to-teal-400/90" style={{ width: `${view.progressPct}%` }} />
                    </div>
                    {view.targetValue != null ? (
                      <p className="text-xs text-zinc-400">{view.currentValue ?? 0}/{view.targetValue}{view.trackingUnit ? ` ${view.trackingUnit}` : ''}</p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm" data-testid="detail-reward">
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500">Reward</p>
                      <p className="font-semibold text-white">{view.rewardPoints} Points</p>
                    </div>
                    {view.completed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300" data-testid="detail-completed-badge">
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Completed
                      </span>
                    ) : null}
                    {view.rewardAwarded ? (
                      <span className="text-xs text-emerald-300/80">Reward awarded{view.completedAt ? ` · ${fmtDate(view.completedAt)}` : ''}</span>
                    ) : null}
                  </div>

                  {view.startDate || view.targetDate || view.completedAt ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                      {view.startDate ? (<p><span className="text-zinc-500">Start: </span>{fmtDate(view.startDate)}</p>) : null}
                      {view.targetDate ? (<p><span className="text-zinc-500">Target: </span>{fmtDate(view.targetDate)}</p>) : null}
                      {view.completedAt ? (<p><span className="text-zinc-500">Completion: </span>{fmtDate(view.completedAt)}</p>) : null}
                    </div>
                  ) : null}

                  {view.additional.length > 0 ? (
                    <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300" data-testid="detail-additional">
                      {view.additional.map((s) => (
                        <p key={s.label}><span className="text-zinc-500">{s.label}: </span>{s.value}</p>
                      ))}
                    </div>
                  ) : null}

                  {view.checkInable ? (
                    <div className="mt-5" data-testid="detail-history">
                      <h3 className="mb-2 text-sm font-semibold text-white">Check-in history</h3>
                      {detailHistoryLoading ? (
                        <p className="text-sm text-zinc-500">Loading…</p>
                      ) : detailHistory.length === 0 ? (
                        <p className="text-sm text-zinc-500">No check-ins yet.</p>
                      ) : (
                        <ol className="space-y-2">
                          {detailHistory.map((c) => (
                            <li key={c.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400">{fmtDate(c.checkInDate || c.createdAt)}</span>
                                <span className="tabular-nums text-zinc-500">
                                  {c.progressBefore != null && c.progressAfter != null
                                    ? `${c.progressBefore}% → ${c.progressAfter}%`
                                    : c.progressAfter != null
                                      ? `${c.progressAfter}%`
                                      : ''}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-400">
                                {c.milestone ? <span>Milestone: {c.milestone}</span> : null}
                                {c.valueAdded != null ? <span>+{c.valueAdded}</span> : null}
                              </div>
                              {c.note ? <p className="mt-1 text-zinc-300">{c.note}</p> : null}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ) : null}

                  {view.checkInable
                    ? renderTodayCheckIn(
                        isGoal
                          ? goalRowToDisplay(goalRaw as Record<string, unknown>)
                          : ({ ...(ach as Achievement), __source: 'achievement' as const })
                      )
                    : null}

                  <div className="mt-6 flex justify-end">
                    <button type="button" onClick={() => setDetailItem(null)} className={modalPrimaryButton}>
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()
        : null}
    </>
  );
}