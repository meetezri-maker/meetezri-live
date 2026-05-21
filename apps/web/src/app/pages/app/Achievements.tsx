import React, { useEffect, useId, useMemo, useState } from 'react';
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
import { PREDEFINED_GOALS } from '@/app/features/goals/seedGoals';
import type { GoalCategory } from '@/app/features/goals/types';
import { SolaceSelect } from '@/app/solace';

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
  linkedGoalId?: string;
  /** When true (default), daily check-ins also write to the personal goals API. False = streak only on this achievement. */
  syncWithGoals?: boolean;
}

type PersonalGoalTemplateKey = '' | `pre:${number}` | 'custom';

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
  mood: string;
  reflection: string;
  challenges: string;
  wins: string;
  notes: string;
};

function emptyDailyGoalCheckIn(): DailyGoalCheckInFields {
  return {
    amount: '',
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
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [wellnessExercises, setWellnessExercises] = useState(0);
  const journeyRingId = useId().replace(/:/g, '');

  useEffect(() => {
    setShowAllAchievements(false);
    setSelectedAchievement(null);
  }, [selectedCategory]);

  const [communityPosts, setCommunityPosts] = useState(0);
  const [customAchievements, setCustomAchievements] = useState<Achievement[]>([]);
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
  const [personalGoalFormOpen, setPersonalGoalFormOpen] = useState(false);
  const [dailyCheckInInputs, setDailyCheckInInputs] = useState<Record<string, DailyGoalCheckInFields>>({});
  const customStorageKey = useMemo(
    () => `ezri_custom_achievements_${profile?.id || 'guest'}`,
    [profile?.id]
  );

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
  });

  const mapAchievementToApiPayload = (item: Achievement) => ({
    title: item.title,
    description: item.description,
    icon: item.icon,
    category: item.category,
    progress: item.progress,
    total: item.total,
    unlocked: item.unlocked,
    points: item.points,
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
    }
  }, [showCreateModal]);

  useEffect(() => {
    let cancelled = false;
    const loadCustomAchievements = async () => {
      try {
        const rows = await api.customAchievements.list();
        if (cancelled) return;
        setCustomAchievements(Array.isArray(rows) ? rows.map(mapApiCustomAchievement) : []);
      } catch (error) {
        console.error('Failed to load custom achievements from database', error);
        try {
          const stored = localStorage.getItem(customStorageKey);
          if (!stored) {
            if (!cancelled) setCustomAchievements([]);
            return;
          }
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && !cancelled) {
            setCustomAchievements(
              parsed.map((item: Achievement) => ({
                ...item,
                goalType: item.goalType || 'custom',
                checkInHistory: Array.isArray(item.checkInHistory) ? item.checkInHistory : [],
                checkInEntries: Array.isArray(item.checkInEntries) ? item.checkInEntries : [],
              })) as Achievement[]
            );
          }
        } catch (storageError) {
          console.error('Failed to load custom achievements fallback cache', storageError);
        }
      }
    };

    void loadCustomAchievements();
    return () => {
      cancelled = true;
    };
  }, [customStorageKey]);

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

  const stats = {
    totalPoints: achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0),
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

  const nextPointsMilestone = useMemo(() => {
    const step = 250;
    return Math.max(step, Math.ceil(stats.totalPoints / step) * step);
  }, [stats.totalPoints]);

  const pointsToNext = Math.max(0, nextPointsMilestone - stats.totalPoints);

  const unlockedEmblemClass =
    'border-white/10 bg-gradient-to-br from-white/[0.07] to-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

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

  const saveCustomAchievements = (items: Achievement[]) => {
    setCustomAchievements(items);
    try {
      localStorage.setItem(customStorageKey, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save custom achievements', error);
    }
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
    const progress = Math.max(0, Math.min(100, Number(goalProgress) || 0));
    if (!title || !description) return;

    const next: Achievement = {
      id: `goal-${Date.now()}`,
      title,
      description,
      icon: 'target',
      category: 'personal',
      progress,
      total: 100,
      unlocked: progress >= 100,
      points: 0,
      rarity: 'common',
      goalType: 'custom',
      goalCategory,
      whyItMatters: goalWhyItMatters.trim(),
      targetOutcome: goalTargetOutcome.trim(),
      startDate: goalStartDate || undefined,
      targetDate: goalTargetDate || undefined,
      priority: goalPriority,
      progressStatus: progress >= 100 ? 'Achieved' : progress > 0 ? 'In Progress' : 'Not Started',
      checkInFrequency: goalCheckInFrequency,
      reminderEnabled: goalReminderEnabled,
      actionSteps: goalActionSteps.trim(),
      moodTag: goalMoodTag,
      supportType: goalSupportType,
      notes: goalNotes.trim(),
      syncWithGoals: true,
    };

    try {
      const created = await api.goals.create({
        goal_title: ensureMinText(title, 2, 'Personal Goal'),
        goal_category: mapAchievementCategoryToGoalCategory(goalCategory),
        goal_description: ensureMinText(description, 10, 'Personal growth goal to track progress over time.'),
        why_this_goal_matters: ensureMinText(goalWhyItMatters, 5, 'Improve wellbeing'),
        target_outcome: ensureMinText(goalTargetOutcome, 5, 'Steady progress'),
        priority_level: mapAchievementPriorityToGoalPriority(goalPriority),
        start_date: goalStartDate || new Date().toISOString().slice(0, 10),
        target_date: goalTargetDate || undefined,
        progress_percentage: progress,
        check_in_frequency: mapAchievementFrequencyToGoalFrequency(goalCheckInFrequency),
        reminder_enabled: goalReminderEnabled,
        small_action_steps: goalActionSteps
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        emotion_tag: mapMoodTagToGoalEmotionTag(goalMoodTag),
        support_type_needed: mapSupportTypeToGoalSupportType(goalSupportType),
        notes: goalNotes.trim() || undefined,
      });
      if (created?.id) {
        next.linkedGoalId = created.id;
      }
    } catch (error) {
      console.error('Failed to create linked goal in database', error);
      toast.error('Failed to create linked goal in database.');
      return;
    }

    try {
      const createdAchievement = await api.customAchievements.create(mapAchievementToApiPayload(next));
      saveCustomAchievements([mapApiCustomAchievement(createdAchievement), ...customAchievements]);
    } catch (error) {
      console.error('Failed to save personal goal in custom achievements table', error);
      toast.error('Failed to save personal goal.');
      return;
    }
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
    resetPersonalGoalDraftFields();
  };

  const addPersonalAchievementFromTab = async () => {
    const title = newTitle.trim();
    const description = newDescription.trim();
    if (!title || !description) return;

    const next: Achievement = {
      id: `personal-achievement-${Date.now()}`,
      title,
      description,
      icon: 'trophy',
      category: 'personal',
      progress: 0,
      total: 1,
      unlocked: false,
      points: 0,
      rarity: 'common',
      goalType: 'custom',
      syncWithGoals: false,
    };

    try {
      const created = await api.customAchievements.create(mapAchievementToApiPayload(next));
      saveCustomAchievements([mapApiCustomAchievement(created), ...customAchievements]);
    } catch (error) {
      console.error('Failed to save personal achievement in database', error);
      toast.error('Failed to save personal achievement.');
      return;
    }
    setNewTitle('');
    setNewDescription('');
    setShowCreateModal(false);
  };

  const personalTrackItems = customAchievements.filter((a) =>
    ['personal', 'self_improvement', 'professional'].includes(a.category)
  );
  const personalGoalsSynced = personalTrackItems.filter((a) => a.syncWithGoals !== false);
  const personalAchievementsOnly = personalTrackItems.filter((a) => a.syncWithGoals === false);

  const handleDailyGoalCheckIn = async (achievementId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const entry: DailyGoalCheckInFields = {
      ...emptyDailyGoalCheckIn(),
      ...dailyCheckInInputs[achievementId],
    };
    const deltaAmount = Math.max(0, Number(entry.amount) || 0);
    const legacyCheckInNote = [entry.reflection, entry.challenges, entry.wins, entry.notes]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' · ') || undefined;
    const source = customAchievements.find((a) => a.id === achievementId);
    if (!source) return;
    if (source.lastCheckInDate === today) return;

    const buildUpdated = (linkedGoalIdForRow: string | undefined) =>
      customAchievements.map((achievement) => {
        if (achievement.id !== achievementId) return achievement;
        if (achievement.lastCheckInDate === today) return achievement;

        const increment = achievement.goalType === 'money_management'
          ? (deltaAmount > 0 ? deltaAmount : 0)
          : 1;
        const nextProgress = Math.min(achievement.total, achievement.progress + increment);
        const nextHistory = Array.isArray(achievement.checkInHistory)
          ? [...achievement.checkInHistory, today]
          : [today];
        const nextEntries = Array.isArray(achievement.checkInEntries)
          ? [
              ...achievement.checkInEntries,
              {
                date: today,
                amount: achievement.goalType === 'money_management' ? deltaAmount : undefined,
                note: legacyCheckInNote,
              },
            ]
          : [
              {
                date: today,
                amount: achievement.goalType === 'money_management' ? deltaAmount : undefined,
                note: legacyCheckInNote,
              },
            ];
        return {
          ...achievement,
          progress: nextProgress,
          unlocked: nextProgress >= achievement.total,
          lastCheckInDate: today,
          checkInHistory: nextHistory,
          checkInEntries: nextEntries,
          linkedGoalId: linkedGoalIdForRow ?? achievement.linkedGoalId,
        };
      });

    if (source.syncWithGoals === false) {
      const updated = buildUpdated(undefined);
      const updatedGoal = updated.find((a) => a.id === achievementId);
      if (!updatedGoal) return;
      try {
        await api.customAchievements.update(achievementId, mapAchievementToApiPayload(updatedGoal));
      } catch (error) {
        console.error('Failed to save daily achievement check-in', error);
        toast.error('Check-in failed to save.');
        return;
      }
      saveCustomAchievements(updated);
      setDailyCheckInInputs((prev) => ({
        ...prev,
        [achievementId]: emptyDailyGoalCheckIn(),
      }));
      return;
    }

    let linkedGoalId = source.linkedGoalId;
    if (!linkedGoalId) {
      try {
        const created = await api.goals.create({
          goal_title: ensureMinText(source.title, 2, 'Personal Goal'),
          goal_category: mapAchievementCategoryToGoalCategory(source.goalCategory),
          goal_description: ensureMinText(
            source.description,
            10,
            'Custom personal goal to track progress over time.'
          ),
          why_this_goal_matters: ensureMinText(source.whyItMatters, 5, 'Improve wellbeing'),
          target_outcome: ensureMinText(source.targetOutcome, 5, 'Steady progress'),
          priority_level: mapAchievementPriorityToGoalPriority(source.priority),
          start_date: source.startDate || new Date().toISOString().slice(0, 10),
          target_date: source.targetDate || undefined,
          progress_percentage: Math.max(0, Math.min(100, Math.round((source.progress / Math.max(1, source.total)) * 100))),
          check_in_frequency: mapAchievementFrequencyToGoalFrequency(source.checkInFrequency),
          reminder_enabled: Boolean(source.reminderEnabled),
          small_action_steps: (source.actionSteps || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          emotion_tag: mapMoodTagToGoalEmotionTag(source.moodTag),
          support_type_needed: mapSupportTypeToGoalSupportType(source.supportType),
          notes: source.notes || undefined,
        });
        linkedGoalId = created?.id;
      } catch (error) {
        console.error('Failed to create linked goal before check-in', error);
        toast.error('Check-in not saved. Could not create DB goal.');
        return;
      }
    }

    const updated = buildUpdated(linkedGoalId);

    if (!linkedGoalId) {
      toast.error('Check-in not saved. Missing linked goal id.');
      return;
    }

    const updatedGoal = updated.find((a) => a.id === achievementId);
    if (!updatedGoal) return;
    try {
      await api.goals.addCheckIn(linkedGoalId, {
        progress_percentage: Math.max(
          0,
          Math.min(100, Math.round((updatedGoal.progress / Math.max(1, updatedGoal.total)) * 100))
        ),
        mood: parseMoodForApi(entry.mood, source.moodTag),
        reflection: entry.reflection.trim() || undefined,
        challenges_faced: entry.challenges.trim() || undefined,
        wins: entry.wins.trim() || undefined,
        notes: entry.notes.trim() || undefined,
      });
    } catch (error) {
      console.error('Failed to save daily check-in to database', error);
      toast.error('Check-in failed to save in database.');
      return;
    }

    try {
      await api.customAchievements.update(achievementId, mapAchievementToApiPayload(updatedGoal));
    } catch (error) {
      console.error('Failed to update custom achievement after check-in', error);
      toast.error('Check-in saved in goal history, but custom achievement sync failed.');
      return;
    }

    saveCustomAchievements(updated);
    setDailyCheckInInputs((prev) => ({
      ...prev,
      [achievementId]: emptyDailyGoalCheckIn(),
    }));
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
      <div
        className={cn(
          'min-h-full pb-12',
          'bg-[radial-gradient(ellipse_110%_70%_at_50%_-18%,rgba(124,58,237,0.12),transparent_52%),radial-gradient(ellipse_50%_38%_at_100%_0%,rgba(236,72,153,0.06),transparent_40%),linear-gradient(180deg,#080b14_0%,#060912_55%,#05070f_100%)]',
          'text-zinc-100'
        )}
      >
        <div className="relative mx-auto max-w-[1580px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
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
              <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_-48px_rgba(0,0,0,0.85)]">
                <img
                  src={ACHIEVEMENTS_IMAGES.hero}
                  alt="Glowing lotus on a moonlit lake with mountains at twilight"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[58%_50%]"
                  width={1600}
                  height={520}
                  loading="eager"
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0618]/68 via-[#0a0618]/32 to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070f]/50 via-transparent to-transparent"
                  aria-hidden
                />
                <div className="relative z-10 flex min-h-[280px] flex-col justify-center px-6 py-10 sm:min-h-[320px] sm:px-10 sm:py-12 lg:min-h-[340px] lg:px-12">
                  <h1 className="max-w-xl font-serif text-4xl font-semibold tracking-tight text-white sm:text-[2.75rem] sm:leading-tight [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]">
                    Achievements
                  </h1>
                  <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-200/95 [text-shadow:0_1px_16px_rgba(0,0,0,0.45)]">
                    Celebrate your growth and the milestones that shape your best self.
                  </p>
                </div>
              </section>

              {/* Progress summary strip */}
              <section className="rounded-2xl border border-white/[0.07] bg-[#0b101c]/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:p-0">
                <div className="grid grid-cols-2 divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                  <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-4 sm:py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-400/20">
                      <Award className="h-4 w-4 text-amber-200/90" aria-hidden />
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/10 ring-1 ring-fuchsia-400/18">
                      <Star className="h-4 w-4 text-fuchsia-200/90" aria-hidden />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total points</p>
                      <p className="font-serif text-lg text-white sm:text-xl">{stats.totalPoints.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-4 sm:py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/18">
                      <Flame className="h-4 w-4 text-emerald-200/90" aria-hidden />
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10 ring-1 ring-sky-400/18">
                      <Crown className="h-4 w-4 text-sky-200/90" aria-hidden />
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
                      className={cn(
                        'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-1.5',
                        isActive
                          ? 'border-fuchsia-400/30 bg-fuchsia-950/40 text-white shadow-[0_0_20px_-8px_rgba(168,85,247,0.35)]'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.05] hover:text-zinc-200'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      {category.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Recently unlocked */}
              <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(120deg,rgba(251,191,36,0.06),rgba(88,28,135,0.08),#0a0f1a)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:p-7">
                {recentUnlocked ? (
                  <>
                    <VaultParticles className="opacity-35" />
                    <div className="relative z-10 grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                      <div className="flex justify-center lg:justify-start">
                        <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
                          <div className="absolute inset-0 rotate-45 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/15 via-fuchsia-900/20 to-violet-950/50" />
                          <div className="absolute inset-2.5 rotate-45 rounded-xl border border-white/10 bg-black/35" />
                          <FeaturedIcon
                            className="relative z-10 h-12 w-12 text-amber-100/95"
                            aria-hidden
                          />
                        </div>
                      </div>
                      <div className="min-w-0 space-y-2 text-center lg:text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">
                          Recently Unlocked
                        </p>
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

              <section className="space-y-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-white sm:text-3xl">Your achievements</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {filteredAchievements.length} visible · {stats.unlockedCount} of {stats.totalCount} unlocked
                      overall
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {visibleAchievementList.map((achievement, index) => {
                    const Icon = getIcon(achievement.icon);
                    const isUnlocked = achievement.unlocked;
                    const total = Math.max(1, achievement.total);
                    const pct = Math.min(100, (achievement.progress / total) * 100);
                    const isSelected = selectedAchievement?.id === achievement.id;
                    const showProgressBar = !isUnlocked && achievement.progress < total;

                    return (
                      <motion.article
                        key={achievement.id}
                        id={`ach-${achievement.id}`}
                        layout={false}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24) }}
                        className={cn(
                          'group relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border bg-[#0c1018]/95 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition',
                          isUnlocked
                            ? 'border-emerald-400/12 hover:border-emerald-400/22'
                            : 'border-white/[0.06] hover:border-white/12',
                          isSelected && 'ring-2 ring-fuchsia-400/30 ring-offset-2 ring-offset-[#05070d]'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAchievement((prev) =>
                              prev?.id === achievement.id ? null : achievement
                            )
                          }
                          className="flex flex-1 flex-col items-center gap-3 p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/45"
                          aria-pressed={isSelected}
                          aria-label={`${achievement.title}. ${isUnlocked ? 'Unlocked' : 'Locked'}. Tap to preview your journey.`}
                        >
                          <div
                            className={cn(
                              'relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border transition',
                              isUnlocked
                                ? unlockedEmblemClass
                                : 'border-white/[0.06] bg-black/50 opacity-75 saturate-[0.7]'
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-9 w-9',
                                isUnlocked
                                  ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                  : 'text-zinc-500'
                              )}
                              aria-hidden
                            />
                            {!isUnlocked ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
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
                  })}
                </div>

                {filteredAchievements.length > 8 ? (
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

          {filteredAchievements.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/[0.12] bg-[#0b101c]/50 py-16 text-center backdrop-blur-xl">
              <Trophy className="mx-auto mb-4 h-14 w-14 text-fuchsia-400/35" aria-hidden />
              <h3 className="font-serif text-xl font-semibold text-white">No trophies in this view</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                Adjust your filters—or keep showing up in Talk It Out, Mood, and Journal. Your next unlock is already
                forming.
              </p>
            </div>
          ) : null}

          {/* Achievement Journey */}
          <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(125deg,rgba(10,14,24,0.96),rgba(24,12,40,0.45))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_60px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.06),transparent_42%)]" />
            <h2 className="relative font-serif text-xl font-semibold text-white sm:text-2xl">Achievement Journey</h2>
            <p className="relative mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
              A gentle arc from your first brave step to the future you are building — one unlock at a time.
            </p>

            {selectedAchievement ? (
              <div className="relative mt-5 rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Journey focus</p>
                <p className="mt-1 text-sm font-semibold text-white">{selectedAchievement.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
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
                  return (
                    <div key={node.key} className="relative z-10 flex min-w-[88px] flex-1 flex-col items-center text-center sm:min-w-0">
                      <div className="relative mb-2 flex h-12 w-12 items-center justify-center">
                        {active ? (
                          <span
                            className="absolute inset-0 rounded-full bg-fuchsia-500/15 blur-md"
                            aria-hidden
                          />
                        ) : null}
                        {isFinal && active ? (
                          <span
                            className="absolute -inset-1 rounded-full bg-amber-400/10 blur-md"
                            aria-hidden
                          />
                        ) : null}
                        <div
                          className={cn(
                            'relative flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition',
                            active &&
                              'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100 shadow-[0_0_22px_-6px_rgba(168,85,247,0.45)]',
                            passed &&
                              !active &&
                              'border-cyan-400/28 bg-cyan-500/8 text-cyan-100/90 shadow-[0_0_14px_-8px_rgba(34,211,238,0.25)]',
                            !passed && !active && 'border-white/[0.09] bg-white/[0.03] text-zinc-500'
                          )}
                        >
                          <JIcon className="h-5 w-5" aria-hidden />
                        </div>
                      </div>
                      <p
                        className={cn(
                          'text-[11px] font-semibold uppercase tracking-wide',
                          active ? 'text-fuchsia-200/95' : 'text-zinc-500'
                        )}
                      >
                        {node.label}
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-zinc-600">{node.sub}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Daily check-ins: goals sync to the goals API; personal achievements stay on this page only */}
          <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#0b101c]/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl sm:p-6">
            {personalTrackItems.length === 0 ? (
              <>
                <h2 className="text-lg font-semibold text-white">Daily rhythm</h2>
                <p className="text-sm text-zinc-400">
                  Add a personal goal or personal achievement first—then return here to check in once a day.
                </p>
              </>
            ) : null}

            {personalGoalsSynced.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold text-white">Daily goal check-in</h2>
                <p className="mb-4 text-sm text-zinc-400">
                  These items sync with your personal goals planner (one check-in per item each day).
                </p>
                <div className="space-y-4">
                  {personalGoalsSynced.map((goal) => {
                    const checkedToday = goal.lastCheckInDate === new Date().toISOString().slice(0, 10);
                    const inputState = { ...emptyDailyGoalCheckIn(), ...dailyCheckInInputs[goal.id] };
                    const patchFields = (patch: Partial<DailyGoalCheckInFields>) => {
                      setDailyCheckInInputs((prev) => ({
                        ...prev,
                        [goal.id]: { ...emptyDailyGoalCheckIn(), ...prev[goal.id], ...patch },
                      }));
                    };
                    return (
                      <div
                        key={goal.id}
                        className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <div>
                          <p className="font-semibold text-white">{goal.title}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {goal.goalType ? goalTypeLabels[goal.goalType] : 'Personal Goal'} · Progress{' '}
                            {goal.progress}/{goal.total}
                            {goal.goalCategory ? ` · ${goal.goalCategory}` : ''}
                          </p>
                        </div>

                        {(goal.whyItMatters || goal.targetOutcome || goal.actionSteps) && (
                          <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
                            <p className="text-xs font-medium text-zinc-500">From your goal</p>
                            {goal.whyItMatters ? (
                              <p>
                                <span className="font-medium text-white">Why it matters: </span>
                                {goal.whyItMatters}
                              </p>
                            ) : null}
                            {goal.targetOutcome ? (
                              <p>
                                <span className="font-medium text-white">Target outcome: </span>
                                {goal.targetOutcome}
                              </p>
                            ) : null}
                            {goal.actionSteps ? (
                              <p>
                                <span className="font-medium text-white">Action steps: </span>
                                {goal.actionSteps}
                              </p>
                            ) : null}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {goal.goalType === 'money_management' && (
                            <div className="space-y-1.5">
                              <Label htmlFor={`amt-${goal.id}`} className="text-zinc-300">
                                Amount added today ($)
                              </Label>
                              <input
                                id={`amt-${goal.id}`}
                                type="number"
                                min={0}
                                value={inputState.amount}
                                onChange={(e) => patchFields({ amount: e.target.value })}
                                placeholder="0"
                                disabled={checkedToday}
                                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
                              />
                            </div>
                          )}
                          <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor={`mood-${goal.id}`} className="text-zinc-300">
                              Emotion tag
                            </Label>
                            <SolaceSelect
                              value={inputState.mood || "__none__"}
                              onValueChange={(mood) =>
                                patchFields({ mood: mood === "__none__" ? "" : mood })
                              }
                              disabled={checkedToday}
                              ariaLabel="Emotion tag"
                              placeholder="How are you feeling? (optional)"
                              variant="default"
                              size="sm"
                              triggerClassName="h-9"
                              options={[
                                { value: "__none__", label: "How are you feeling? (optional)" },
                                ...GOAL_EMOTION_TAG_OPTIONS.map((item) => ({
                                  value: item.value,
                                  label: item.label,
                                })),
                              ]}
                            />
                            {goal.moodTag ? (
                              <p className="text-xs text-zinc-500">
                                Default on your goal: {goal.moodTag} (when left blank)
                              </p>
                            ) : null}
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor={`refl-${goal.id}`} className="text-zinc-300">
                              Reflection
                            </Label>
                            <Textarea
                              id={`refl-${goal.id}`}
                              value={inputState.reflection}
                              onChange={(e) => patchFields({ reflection: e.target.value })}
                              placeholder="What stood out today?"
                              disabled={checkedToday}
                              rows={3}
                              className="min-h-[80px] border-white/15 bg-black/40 text-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`chal-${goal.id}`} className="text-zinc-300">
                              Challenges faced
                            </Label>
                            <Textarea
                              id={`chal-${goal.id}`}
                              value={inputState.challenges}
                              onChange={(e) => patchFields({ challenges: e.target.value })}
                              placeholder="Optional"
                              disabled={checkedToday}
                              rows={3}
                              className="border-white/15 bg-black/40 text-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`wins-${goal.id}`} className="text-zinc-300">
                              Wins
                            </Label>
                            <Textarea
                              id={`wins-${goal.id}`}
                              value={inputState.wins}
                              onChange={(e) => patchFields({ wins: e.target.value })}
                              placeholder="Optional"
                              disabled={checkedToday}
                              rows={3}
                              className="border-white/15 bg-black/40 text-white"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor={`notes-${goal.id}`} className="text-zinc-300">
                              Notes for this check-in
                            </Label>
                            <Textarea
                              id={`notes-${goal.id}`}
                              value={inputState.notes}
                              onChange={(e) => patchFields({ notes: e.target.value })}
                              placeholder="Optional"
                              disabled={checkedToday}
                              rows={2}
                              className="border-white/15 bg-black/40 text-white"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDailyGoalCheckIn(goal.id)}
                          disabled={
                            checkedToday ||
                            (goal.goalType === 'money_management' && !(Number(inputState.amount) > 0))
                          }
                          className="self-start rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {checkedToday ? 'Checked today' : 'Daily check-in'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {personalAchievementsOnly.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold text-white">Daily achievements</h2>
                <p className="mb-4 text-sm text-zinc-400">
                  Streak items you keep only on this page (no goals API sync).
                </p>
                <div className="space-y-3">
                  {personalAchievementsOnly.map((goal) => {
                    const checkedToday = goal.lastCheckInDate === new Date().toISOString().slice(0, 10);
                    const inputState = { ...emptyDailyGoalCheckIn(), ...dailyCheckInInputs[goal.id] };
                    return (
                      <div
                        key={goal.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="w-full">
                          <p className="font-semibold text-white">{goal.title}</p>
                          <p className="text-xs text-zinc-400">
                            Personal achievement · {goal.progress}/{goal.total}
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {goal.goalType === 'money_management' && (
                              <input
                                type="number"
                                min={0}
                                value={inputState.amount}
                                onChange={(e) =>
                                  setDailyCheckInInputs((prev) => ({
                                    ...prev,
                                    [goal.id]: {
                                      ...emptyDailyGoalCheckIn(),
                                      ...prev[goal.id],
                                      amount: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Amount added today ($)"
                                disabled={checkedToday}
                                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
                              />
                            )}
                            <input
                              type="text"
                              value={inputState.notes}
                              onChange={(e) =>
                                setDailyCheckInInputs((prev) => ({
                                  ...prev,
                                  [goal.id]: {
                                    ...emptyDailyGoalCheckIn(),
                                    ...prev[goal.id],
                                    notes: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Note (optional)"
                              disabled={checkedToday}
                              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDailyGoalCheckIn(goal.id)}
                          disabled={
                            checkedToday ||
                            (goal.goalType === 'money_management' && !(Number(inputState.amount) > 0))
                          }
                          className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {checkedToday ? 'Checked today' : 'Daily achievements'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0b101c]/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl sm:p-6">
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
              <div className="rounded-3xl border border-white/[0.08] bg-[#0b101c]/90 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
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

              <div className="rounded-3xl border border-white/[0.08] bg-[#0b101c]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/12 ring-1 ring-fuchsia-400/22">
                    <Diamond className="h-5 w-5 text-fuchsia-200/95" aria-hidden />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Achievement Points</p>
                    <p className="font-serif text-xl text-white sm:text-2xl">{stats.totalPoints.toLocaleString()}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {pointsToNext > 0
                    ? `${pointsToNext.toLocaleString()} pts to the next reward`
                    : 'You are at this reward threshold'}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500/90 to-cyan-400/90"
                    style={{
                      width: `${Math.min(
                        100,
                        stats.totalPoints > 0 ? (stats.totalPoints / nextPointsMilestone) * 100 : 0
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  Next reward · {nextPointsMilestone.toLocaleString()} pts
                </p>
              </div>

              <div className="rounded-3xl border border-orange-400/15 bg-[#0b101c]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <Flame
                    className="mt-0.5 h-6 w-6 shrink-0 text-amber-300/90"
                    aria-hidden
                  />
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

              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0a0f18] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(251,191,36,0.08),transparent_48%)]" />
                <div className="relative flex items-start gap-3">
                  <Headphones className="mt-0.5 h-6 w-6 shrink-0 text-cyan-200/80" aria-hidden />
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
          onClick={() => setShowCreateModal(false)}
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
                onClick={() => setShowCreateModal(false)}
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
                    <label htmlFor="pg-progress" className={modalLabel}>Current Progress (0–100%)</label>
                    <input id="pg-progress" type="number" min={0} max={100} value={goalProgress} onChange={(e) => setGoalProgress(e.target.value)} placeholder="0" className={modalInput} />
                  </div>
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
                <button type="button" onClick={addPersonalGoalFromTab} className={cn(modalPrimaryButton, "mt-4")}>
                  Save Personal Goal
                </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Achievement Title" className={modalInput} />
                  <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Achievement Description" className={modalInput} />
                </div>
                <button type="button" onClick={addPersonalAchievementFromTab} className={cn(modalPrimaryButton, "mt-4")}>
                  Save Personal Achievement
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}