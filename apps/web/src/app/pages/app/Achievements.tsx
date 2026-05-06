import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AppLayout } from '@/app/components/AppLayout';
import { Trophy, Award, Star, Lock, Calendar, TrendingUp, Target, Zap, Heart, Brain, Moon, CheckCircle, ArrowLeft, Users } from 'lucide-react';
import { AnimatedCard } from '@/app/components/AnimatedCard';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { GOAL_CATEGORY_OPTIONS, GOAL_EMOTION_TAG_OPTIONS } from '@/app/features/goals/constants';
import { PREDEFINED_GOALS } from '@/app/features/goals/seedGoals';
import type { GoalCategory } from '@/app/features/goals/types';

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

export function Achievements() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [wellnessExercises, setWellnessExercises] = useState(0);
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
      description: 'Complete your first session with Ezri',
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
      description: 'Complete 10 sessions with Ezri',
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
    { id: 'sessions', label: 'Talk it out', icon: Target },
    { id: 'mood', label: 'Mood', icon: Heart },
    { id: 'journal', label: 'Journal', icon: Brain },
    { id: 'wellness', label: 'Wellness', icon: Zap },
    { id: 'streak', label: 'Streaks', icon: TrendingUp },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'personal', label: 'Personal Achievements', icon: Star },
    { id: 'self_improvement', label: 'Self Improvement', icon: Star },
    { id: 'professional', label: 'Professional', icon: Star }
  ];

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-500'
  };

  const rarityBorders = {
    common: 'border-gray-500/30',
    rare: 'border-blue-500/30',
    epic: 'border-purple-500/30',
    legendary: 'border-yellow-500/30'
  };

  const getIcon = (iconName: string) => {
    const icons: any = {
      footprints: Target,
      target: Target,
      heart: Heart,
      book: Brain,
      zap: Zap,
      moon: Moon,
      trophy: Trophy,
      sunrise: Calendar,
      users: Users
    };
    return icons[iconName] || Trophy;
  };

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

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Achievements</h1>
                  <p className="text-gray-600 dark:text-slate-400">Your journey and milestones</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-95 w-fit"
              >
                Add Achievement
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Achievements are activity-based milestones. They unlock as you complete sessions, check-ins, journals, and community goals.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <AnimatedCard delay={0.1}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unlockedCount}/{stats.totalCount}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Unlocked</p>
                </div>
                <div className="mt-3 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                    style={{ width: `${(stats.unlockedCount / stats.totalCount) * 100}%` }}
                  />
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.2}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Star className="w-8 h-8 text-purple-600 dark:text-purple-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPoints}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Total Points</p>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.3}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.currentStreak}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Current Streak</p>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.4}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Trophy className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.longestStreak}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Longest Streak</p>
                </div>
              </div>
            </AnimatedCard>
          </div>

          {/* Category Filters */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                const categoryButton = (
                  <motion.button
                    key={category.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-purple-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {category.label}
                  </motion.button>
                );
                return (
                  <React.Fragment key={category.id}>
                    {categoryButton}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Daily check-ins: goals sync to the goals API; personal achievements stay on this page only */}
          <div className="mb-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 space-y-6">
            {personalTrackItems.length === 0 ? (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Daily tracking</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Add a personal goal or personal achievement first, then check in here daily.
                </p>
              </>
            ) : null}

            {personalGoalsSynced.length > 0 ? (
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Daily Goal Check-in</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                  These items sync with your personal goals planner and goal check-in history (one check-in per item each day).
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
                        className="flex flex-col gap-4 p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40"
                      >
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{goal.title}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                            {goal.goalType ? goalTypeLabels[goal.goalType] : 'Personal Goal'} • Progress {goal.progress}/
                            {goal.total}
                            {goal.goalCategory ? ` • ${goal.goalCategory}` : ''}
                          </p>
                        </div>

                        {(goal.whyItMatters || goal.targetOutcome || goal.actionSteps) && (
                          <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 text-sm space-y-1.5">
                            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">From your goal</p>
                            {goal.whyItMatters ? (
                              <p className="text-gray-800 dark:text-slate-200">
                                <span className="font-medium text-gray-900 dark:text-white">Why it matters: </span>
                                {goal.whyItMatters}
                              </p>
                            ) : null}
                            {goal.targetOutcome ? (
                              <p className="text-gray-800 dark:text-slate-200">
                                <span className="font-medium text-gray-900 dark:text-white">Target outcome: </span>
                                {goal.targetOutcome}
                              </p>
                            ) : null}
                            {goal.actionSteps ? (
                              <p className="text-gray-800 dark:text-slate-200">
                                <span className="font-medium text-gray-900 dark:text-white">Action steps: </span>
                                {goal.actionSteps}
                              </p>
                            ) : null}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {goal.goalType === 'money_management' && (
                            <div className="space-y-1.5">
                              <Label htmlFor={`amt-${goal.id}`}>Amount added today ($)</Label>
                              <input
                                id={`amt-${goal.id}`}
                                type="number"
                                min={0}
                                value={inputState.amount}
                                onChange={(e) => patchFields({ amount: e.target.value })}
                                placeholder="0"
                                disabled={checkedToday}
                                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-60"
                              />
                            </div>
                          )}
                          <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor={`mood-${goal.id}`}>Emotion tag</Label>
                            <select
                              id={`mood-${goal.id}`}
                              value={inputState.mood}
                              onChange={(e) => patchFields({ mood: e.target.value })}
                              disabled={checkedToday}
                              className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm disabled:opacity-60"
                            >
                              <option value="">How are you feeling? (optional)</option>
                              {GOAL_EMOTION_TAG_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            {goal.moodTag ? (
                              <p className="text-xs text-gray-500 dark:text-slate-500">
                                Default on your goal: {goal.moodTag} (applied when you leave this blank)
                              </p>
                            ) : null}
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor={`refl-${goal.id}`}>Reflection</Label>
                            <Textarea
                              id={`refl-${goal.id}`}
                              value={inputState.reflection}
                              onChange={(e) => patchFields({ reflection: e.target.value })}
                              placeholder="What stood out today?"
                              disabled={checkedToday}
                              rows={3}
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`chal-${goal.id}`}>Challenges faced</Label>
                            <Textarea
                              id={`chal-${goal.id}`}
                              value={inputState.challenges}
                              onChange={(e) => patchFields({ challenges: e.target.value })}
                              placeholder="Optional"
                              disabled={checkedToday}
                              rows={3}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`wins-${goal.id}`}>Wins</Label>
                            <Textarea
                              id={`wins-${goal.id}`}
                              value={inputState.wins}
                              onChange={(e) => patchFields({ wins: e.target.value })}
                              placeholder="Optional"
                              disabled={checkedToday}
                              rows={3}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor={`notes-${goal.id}`}>Notes for this check-in</Label>
                            <Textarea
                              id={`notes-${goal.id}`}
                              value={inputState.notes}
                              onChange={(e) => patchFields({ notes: e.target.value })}
                              placeholder="Optional"
                              disabled={checkedToday}
                              rows={2}
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
                          className="self-start px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checkedToday ? 'Checked Today' : 'Daily Check-in'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {personalAchievementsOnly.length > 0 ? (
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Daily Achievements</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                  Streaks for achievements you added under Personal Achievements. These stay here and do not use the goals API.
                </p>
                <div className="space-y-3">
                  {personalAchievementsOnly.map((goal) => {
                    const checkedToday = goal.lastCheckInDate === new Date().toISOString().slice(0, 10);
                    const inputState = { ...emptyDailyGoalCheckIn(), ...dailyCheckInInputs[goal.id] };
                    return (
                      <div
                        key={goal.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40"
                      >
                        <div className="w-full">
                          <p className="font-semibold text-gray-900 dark:text-white">{goal.title}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            Personal achievement • {goal.progress}/{goal.total}
                          </p>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
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
                                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-60"
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
                              className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-60"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDailyGoalCheckIn(goal.id)}
                          disabled={checkedToday || (goal.goalType === 'money_management' && !(Number(inputState.amount) > 0))}
                          className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checkedToday ? 'Checked Today' : 'Daily Achievements'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* 30 Day Report */}
          <div className="mb-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">30-Day Report</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Generate your last 30 days personal goals report.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateThirtyDayReport}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                >
                  Generate Report
                </button>
                <button
                  type="button"
                  onClick={copyReport}
                  disabled={!reportText}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Copy
                </button>
              </div>
            </div>
            <textarea
              value={reportText}
              readOnly
              placeholder="Generate report to view your 30-day summary."
              className="w-full min-h-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm text-gray-800 dark:text-slate-200"
            />
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAchievements.map((achievement, index) => {
              const Icon = getIcon(achievement.icon);
              const isUnlocked = achievement.unlocked;
              
              return (
                <AnimatedCard key={achievement.id} delay={index * 0.05}>
                  <div
                    className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 h-full flex flex-col ${
                      isUnlocked ? rarityBorders[achievement.rarity] : 'border-gray-200 dark:border-slate-800'
                    } p-6 overflow-hidden hover:shadow-lg transition-all ${!isUnlocked && 'opacity-60'}`}
                  >
                    {/* Rarity Gradient Overlay */}
                    {isUnlocked && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${rarityColors[achievement.rarity]} opacity-5`} />
                    )}

                    {/* Content */}
                    <div className="relative flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                          isUnlocked 
                            ? `bg-gradient-to-br ${rarityColors[achievement.rarity]}` 
                            : 'bg-gray-100 dark:bg-slate-800'
                        }`}>
                          {isUnlocked ? (
                            <Icon className="w-8 h-8 text-white" />
                          ) : (
                            <Icon className="w-8 h-8 text-gray-400 dark:text-slate-600" />
                          )}
                        </div>
                        {isUnlocked && (
                          <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-lg">
                            <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
                            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-500">{achievement.points}</span>
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{achievement.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{achievement.description}</p>
                      {achievement.goalType && (
                        <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
                          Goal: {goalTypeLabels[achievement.goalType]}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400 mb-1">
                          <span>Progress</span>
                          <span>{achievement.progress}/{achievement.total}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (achievement.progress / achievement.total) * 100)}%` }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className={`h-full ${
                              isUnlocked 
                                ? `bg-gradient-to-r ${rarityColors[achievement.rarity]}` 
                                : 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-slate-600 dark:to-slate-500'
                            } rounded-full`}
                          />
                        </div>
                      </div>

                      {isUnlocked ? (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
                          <span>Unlocked</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                          <Lock className="w-4 h-4 text-gray-500 dark:text-slate-500" />
                          <span>In progress</span>
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredAchievements.length === 0 && (
            <div className="text-center py-16">
              <Trophy className="w-16 h-16 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No achievements in this category yet</h3>
              <p className="text-gray-600 dark:text-slate-400">Keep going! Your achievements are waiting to be unlocked.</p>
            </div>
          )}
        </div>
      </div>
      {showCreateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add your own achievement</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
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
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${activeAddTab === 'personal_goals' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'}`}
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
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${activeAddTab === 'personal_achievements' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'}`}
              >
                Personal Achievements
              </button>
            </div>

            {activeAddTab === 'personal_goals' ? (
              <>
                {!personalGoalFormOpen ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Select a goal from the catalog (grouped by area), then continue to the form to add details and save.
                    </p>
                    <label htmlFor="achievement-goal-template" className="sr-only">
                      Goal template
                    </label>
                    <select
                      id="achievement-goal-template"
                      value={goalTemplateKey}
                      onChange={(e) => setGoalTemplateKey(e.target.value as PersonalGoalTemplateKey)}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Select a goal…</option>
                      {GOAL_CATEGORY_OPTIONS.map((cat) => (
                        <optgroup key={cat.value} label={cat.label}>
                          {PREDEFINED_GOALS.map((g, i) =>
                            g.goal_category === cat.value ? (
                              <option key={`${cat.value}-${i}`} value={`pre:${i}`}>
                                {g.goal_title}
                              </option>
                            ) : null
                          )}
                        </optgroup>
                      ))}
                      <option value="custom">Custom goal (write your own)</option>
                    </select>
                    <button
                      type="button"
                      disabled={!goalTemplateKey}
                      onClick={openPersonalGoalFormFromTemplate}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Continue to form
                    </button>
                  </div>
                ) : (
                  <>
                <button
                  type="button"
                  onClick={backToPersonalGoalTemplatePicker}
                  className="mb-3 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
                >
                  ← Change goal template
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-title" className="text-xs font-medium text-gray-600 dark:text-slate-400">Goal Title</label>
                    <input id="pg-title" type="text" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. Build a daily meditation habit" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-category" className="text-xs font-medium text-gray-600 dark:text-slate-400">Category</label>
                    <select id="pg-category" value={goalCategory} onChange={(e) => setGoalCategory(e.target.value as NonNullable<Achievement['goalCategory']>)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white">
                      <option value="Mental">Mental</option><option value="Emotional">Emotional</option><option value="Productivity">Productivity</option><option value="Relationships">Relationships</option><option value="Wellness">Wellness</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-description" className="text-xs font-medium text-gray-600 dark:text-slate-400">Goal Description</label>
                    <input id="pg-description" type="text" value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Briefly describe your goal" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-why" className="text-xs font-medium text-gray-600 dark:text-slate-400">Why This Goal Matters</label>
                    <input id="pg-why" type="text" value={goalWhyItMatters} onChange={(e) => setGoalWhyItMatters(e.target.value)} placeholder="What motivates you to pursue this?" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-outcome" className="text-xs font-medium text-gray-600 dark:text-slate-400">Target Outcome</label>
                    <input id="pg-outcome" type="text" value={goalTargetOutcome} onChange={(e) => setGoalTargetOutcome(e.target.value)} placeholder="What does success look like?" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-priority" className="text-xs font-medium text-gray-600 dark:text-slate-400">Priority Level</label>
                    <select id="pg-priority" value={goalPriority} onChange={(e) => setGoalPriority(e.target.value as NonNullable<Achievement['priority']>)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white">
                      <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-start" className="text-xs font-medium text-gray-600 dark:text-slate-400">Start Date</label>
                    <input id="pg-start" type="date" value={goalStartDate} onChange={(e) => setGoalStartDate(e.target.value)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-target" className="text-xs font-medium text-gray-600 dark:text-slate-400">Target Date</label>
                    <input id="pg-target" type="date" value={goalTargetDate} onChange={(e) => setGoalTargetDate(e.target.value)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-progress" className="text-xs font-medium text-gray-600 dark:text-slate-400">Current Progress (0–100%)</label>
                    <input id="pg-progress" type="number" min={0} max={100} value={goalProgress} onChange={(e) => setGoalProgress(e.target.value)} placeholder="0" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-frequency" className="text-xs font-medium text-gray-600 dark:text-slate-400">Check-in Frequency</label>
                    <select id="pg-frequency" value={goalCheckInFrequency} onChange={(e) => setGoalCheckInFrequency(e.target.value as NonNullable<Achievement['checkInFrequency']>)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white">
                      <option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Custom">Custom</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-actions" className="text-xs font-medium text-gray-600 dark:text-slate-400">Small Action Steps</label>
                    <input id="pg-actions" type="text" value={goalActionSteps} onChange={(e) => setGoalActionSteps(e.target.value)} placeholder="Comma-separated steps, e.g. Read 10 pages, Journal 5 min" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-mood" className="text-xs font-medium text-gray-600 dark:text-slate-400">Emotion Tag</label>
                    <select id="pg-mood" value={goalMoodTag} onChange={(e) => setGoalMoodTag(e.target.value as NonNullable<Achievement['moodTag']>)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white">
                      <option value="Stress">Stress</option><option value="Sadness">Sadness</option><option value="Fear">Fear</option><option value="Confidence">Confidence</option><option value="Motivation">Motivation</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-support" className="text-xs font-medium text-gray-600 dark:text-slate-400">Support Type Needed</label>
                    <select id="pg-support" value={goalSupportType} onChange={(e) => setGoalSupportType(e.target.value as NonNullable<Achievement['supportType']>)} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white">
                      <option value="Encouragement">Encouragement</option><option value="Accountability">Accountability</option><option value="Reflection">Reflection</option><option value="Coping Help">Coping Help</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pg-notes" className="text-xs font-medium text-gray-600 dark:text-slate-400">Notes / Journal Entry</label>
                    <input id="pg-notes" type="text" value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} placeholder="Any additional notes (optional)" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                  <input type="checkbox" checked={goalReminderEnabled} onChange={(e) => setGoalReminderEnabled(e.target.checked)} />
                  Reminder Enabled
                </label>
                <button type="button" onClick={addPersonalGoalFromTab} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-95">
                  Save Personal Goal
                </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Achievement Title" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                  <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Achievement Description" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white" />
                </div>
                <button type="button" onClick={addPersonalAchievementFromTab} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-95">
                  Save Personal Achievement
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AppLayout>
  );
}