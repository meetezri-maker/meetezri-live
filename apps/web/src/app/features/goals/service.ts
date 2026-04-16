import { api } from '@/lib/api';
import type { Goal, GoalCheckIn, GoalFilters, GoalFormValues, GoalStatus } from './types';

export const goalsService = {
  async list(_: string): Promise<Goal[]> {
    return api.goals.list();
  },

  async getById(_: string, goalId: string): Promise<Goal | undefined> {
    return api.goals.getById(goalId);
  },

  async listCheckIns(_: string, goalId: string): Promise<GoalCheckIn[]> {
    return api.goals.listCheckIns(goalId);
  },

  async create(_: string, values: GoalFormValues): Promise<Goal> {
    return api.goals.create(values);
  },

  async update(_: string, goalId: string, patch: Partial<Goal>): Promise<Goal | undefined> {
    return api.goals.update(goalId, patch as Record<string, unknown>);
  },

  async updateStatus(_: string, goalId: string, status: GoalStatus): Promise<Goal | undefined> {
    return api.goals.updateStatus(goalId, status);
  },

  async remove(_: string, goalId: string): Promise<void> {
    await api.goals.delete(goalId);
  },

  async addCheckIn(
    _: string,
    goalId: string,
    payload: Omit<GoalCheckIn, 'id' | 'goal_id' | 'user_id' | 'created_at'>
  ): Promise<GoalCheckIn | undefined> {
    return api.goals.addCheckIn(goalId, payload as Record<string, unknown>);
  },

  async listFiltered(userId: string, filters: GoalFilters): Promise<Goal[]> {
    const priorities = { high: 3, medium: 2, low: 1 };
    const goals = await goalsService.list(userId);
    return goals.filter((goal) => {
      const statusMatch = filters.status === 'all' || goal.status === filters.status;
      const categoryMatch = filters.category === 'all' || goal.goal_category === filters.category;
      return statusMatch && categoryMatch;
    }).sort((a, b) => {
      switch (filters.sortBy) {
        case 'oldest':
          return a.created_at.localeCompare(b.created_at);
        case 'highest_priority':
          return priorities[b.priority_level] - priorities[a.priority_level];
        case 'nearest_target_date':
          return (a.target_date || '9999-99-99').localeCompare(b.target_date || '9999-99-99');
        case 'most_progress':
          return b.progress_percentage - a.progress_percentage;
        case 'least_progress':
          return a.progress_percentage - b.progress_percentage;
        case 'newest':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
  },
};
