import { useCallback, useEffect, useMemo, useState } from 'react';
import { goalsService } from './service';
import type { Goal, GoalCheckIn, GoalFilters, GoalFormValues, GoalStatus } from './types';

export function useGoals(userId?: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setGoals(await goalsService.list(userId));
      setError(null);
    } catch {
      setError('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createGoal = useCallback(async (values: GoalFormValues) => {
    if (!userId) return;
    await goalsService.create(userId, values);
    await reload();
  }, [reload, userId]);

  const updateGoal = useCallback(async (goalId: string, patch: Partial<Goal>) => {
    if (!userId) return;
    await goalsService.update(userId, goalId, patch);
    await reload();
  }, [reload, userId]);

  const updateGoalStatus = useCallback(async (goalId: string, status: GoalStatus) => {
    if (!userId) return;
    await goalsService.updateStatus(userId, goalId, status);
    await reload();
  }, [reload, userId]);

  const removeGoal = useCallback(async (goalId: string) => {
    if (!userId) return;
    await goalsService.remove(userId, goalId);
    await reload();
  }, [reload, userId]);

  const value = useMemo(
    () => ({
      goals,
      loading,
      error,
      reload,
      createGoal,
      updateGoal,
      updateGoalStatus,
      removeGoal,
    }),
    [createGoal, error, goals, loading, reload, removeGoal, updateGoal, updateGoalStatus]
  );

  return value;
}

export function useGoalCheckIns(userId?: string, goalId?: string) {
  const [checkIns, setCheckIns] = useState<GoalCheckIn[]>([]);

  const reload = useCallback(async () => {
    if (!userId || !goalId) {
      setCheckIns([]);
      return;
    }
    setCheckIns(await goalsService.listCheckIns(userId, goalId));
  }, [goalId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addCheckIn = useCallback(async (payload: Omit<GoalCheckIn, 'id' | 'goal_id' | 'user_id' | 'created_at'>) => {
    if (!userId || !goalId) return;
    await goalsService.addCheckIn(userId, goalId, payload);
    await reload();
  }, [goalId, reload, userId]);

  return { checkIns, addCheckIn, reload };
}

export function useFilteredGoals(userId: string | undefined, filters: GoalFilters) {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      return;
    }
    let cancelled = false;
    goalsService.listFiltered(userId, filters)
      .then((rows) => {
        if (!cancelled) setGoals(rows);
      })
      .catch(() => {
        if (!cancelled) setGoals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, userId]);

  return goals;
}
