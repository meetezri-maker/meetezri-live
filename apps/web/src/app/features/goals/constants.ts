import type {
  EmotionTag,
  GoalCategory,
  GoalCheckInFrequency,
  GoalPriority,
  GoalStatus,
  SupportType,
} from './types';

export const GOAL_STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const GOAL_PRIORITY_OPTIONS: { value: GoalPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const GOAL_CATEGORY_OPTIONS: { value: GoalCategory; label: string }[] = [
  { value: 'mental_emotional', label: 'Mental & Emotional' },
  { value: 'social_relationships', label: 'Social & Relationships' },
  { value: 'personal_growth', label: 'Personal Growth' },
  { value: 'daily_productivity', label: 'Daily Life & Productivity' },
  { value: 'wellness', label: 'Wellness' },
];

export const GOAL_CHECKIN_FREQUENCY_OPTIONS: { value: GoalCheckInFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'twice_weekly', label: 'Twice Weekly' },
  { value: 'custom', label: 'Custom' },
];

export const GOAL_EMOTION_TAG_OPTIONS: { value: EmotionTag; label: string }[] = [
  { value: 'stress', label: 'Stress' },
  { value: 'anxiety', label: 'Anxiety' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'loneliness', label: 'Loneliness' },
  { value: 'focus', label: 'Focus' },
  { value: 'sadness', label: 'Sadness' },
  { value: 'overwhelm', label: 'Overwhelm' },
  { value: 'discipline', label: 'Discipline' },
  { value: 'calm', label: 'Calm' },
];

export const GOAL_SUPPORT_TYPE_OPTIONS: { value: SupportType; label: string }[] = [
  { value: 'encouragement', label: 'Encouragement' },
  { value: 'accountability', label: 'Accountability' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'coping_help', label: 'Coping Help' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'partner_support', label: 'Partner Support' },
];
