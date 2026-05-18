export type GoalStatus = 'not_started' | 'active' | 'paused' | 'completed' | 'archived';
export type GoalPriority = 'low' | 'medium' | 'high';
export type GoalCheckInFrequency = 'daily' | 'weekly' | 'twice_weekly' | 'custom';
export type GoalCategory =
  | 'mental_emotional'
  | 'social_relationships'
  | 'personal_growth'
  | 'daily_productivity'
  | 'wellness';
export type EmotionTag =
  | 'stress'
  | 'anxiety'
  | 'confidence'
  | 'motivation'
  | 'loneliness'
  | 'focus'
  | 'sadness'
  | 'overwhelm'
  | 'discipline'
  | 'calm';
export type SupportType =
  | 'encouragement'
  | 'accountability'
  | 'reflection'
  | 'coping_help'
  | 'motivation'
  | 'partner_support';

export interface Goal {
  id: string;
  user_id: string;
  goal_title: string;
  goal_category: GoalCategory;
  goal_description: string;
  why_this_goal_matters: string;
  target_outcome: string;
  priority_level: GoalPriority;
  status: GoalStatus;
  start_date: string;
  target_date?: string;
  progress_percentage: number;
  check_in_frequency: GoalCheckInFrequency;
  reminder_enabled: boolean;
  reminder_time?: string;
  small_action_steps: string[];
  emotion_tag?: EmotionTag;
  support_type_needed?: SupportType;
  notes?: string;
  last_check_in_date?: string;
  streak_count: number;
  ai_suggestions: string[];
  partner_visibility: boolean;
  partner_comment_enabled: boolean;
  completion_note?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalCheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  progress_percentage: number;
  mood?: EmotionTag;
  reflection?: string;
  challenges_faced?: string;
  wins?: string;
  notes?: string;
  created_at: string;
}

export interface GoalSeedItem {
  goal_title: string;
  goal_category: GoalCategory;
  goal_description: string;
}

export interface GoalFilters {
  status: 'all' | GoalStatus;
  category: 'all' | GoalCategory;
  sortBy: 'newest' | 'oldest' | 'highest_priority' | 'nearest_target_date' | 'most_progress' | 'least_progress';
}

export interface GoalFormValues {
  goal_title: string;
  goal_category: GoalCategory;
  goal_description: string;
  why_this_goal_matters: string;
  target_outcome: string;
  priority_level: GoalPriority;
  start_date: string;
  target_date?: string;
  progress_percentage?: number;
  check_in_frequency?: GoalCheckInFrequency;
  reminder_enabled?: boolean;
  reminder_time?: string;
  small_action_steps?: string[];
  emotion_tag?: EmotionTag;
  support_type_needed?: SupportType;
  notes?: string;
  partner_visibility?: boolean;
  partner_comment_enabled?: boolean;
}

export interface GoalCheckInValues {
  progress_percentage: number;
  mood?: EmotionTag;
  reflection?: string;
  challenges_faced?: string;
  wins?: string;
  notes?: string;
}
