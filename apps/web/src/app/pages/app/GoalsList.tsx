import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { GoalCard } from '@/app/features/goals/components/GoalCard';
import { GoalForm } from '@/app/features/goals/components/GoalForm';
import { GOAL_CATEGORY_OPTIONS, GOAL_STATUS_OPTIONS } from '@/app/features/goals/constants';
import { useGoals, useFilteredGoals } from '@/app/features/goals/hooks';
import { PREDEFINED_GOALS } from '@/app/features/goals/seedGoals';
import type { GoalFilters, GoalSeedItem } from '@/app/features/goals/types';
import { SolaceSelect } from '@/app/solace';

/** Dropdown value: empty, catalog index, or custom */
type GoalTemplateKey = '' | `pre:${number}` | 'custom';

export function GoalsList() {
  const { user } = useAuth();
  const [templateKey, setTemplateKey] = useState<GoalTemplateKey>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState<GoalFilters>({
    status: 'all',
    category: 'all',
    sortBy: 'newest',
  });
  const { loading, error, createGoal } = useGoals(user?.id);
  const filteredGoals = useFilteredGoals(user?.id, filters);

  const hasGoals = useMemo(() => filteredGoals.length > 0, [filteredGoals.length]);

  const goalTemplateGroups = useMemo(
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

  const selectedSeed: GoalSeedItem | null = useMemo(() => {
    if (!templateKey || templateKey === 'custom') return null;
    const idx = Number(templateKey.slice(4));
    if (!Number.isFinite(idx) || idx < 0 || idx >= PREDEFINED_GOALS.length) return null;
    return PREDEFINED_GOALS[idx] ?? null;
  }, [templateKey]);

  const canOpenForm = templateKey !== '';
  const resetCreateFlow = () => {
    setShowCreateForm(false);
    setTemplateKey('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/app/settings" className="inline-flex items-center gap-2 text-gray-700 dark:text-slate-300 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Settings
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Personal Goals</h1>
              <p className="text-gray-600 dark:text-slate-400">Create, track, and review your personal growth goals.</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">New goal</h2>
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
              Choose a goal from the list, then open the form to fill in details and save.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 min-w-0">
                <label htmlFor="goal-template" className="sr-only">
                  Select goal type
                </label>
                <SolaceSelect
                  id="goal-template"
                  value={templateKey}
                  onValueChange={(v) => {
                    setTemplateKey(v as GoalTemplateKey);
                    setShowCreateForm(false);
                  }}
                  ariaLabel="Select goal type"
                  placeholder="Select a goal…"
                  variant="default"
                  groups={goalTemplateGroups}
                  options={[{ value: 'custom', label: 'Custom goal (write your own)' }]}
                />
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button type="button" disabled={!canOpenForm} onClick={() => setShowCreateForm(true)}>
                  Open form
                </Button>
                {showCreateForm && (
                  <Button type="button" variant="outline" onClick={resetCreateFlow}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {showCreateForm && (
            <div className="mb-6 space-y-3">
              <GoalForm
                key={templateKey}
                mode="create"
                initialSeed={selectedSeed}
                hidePredefinedPicklist
                submitLabel="Create Goal"
                onSubmit={async (values) => {
                  await createGoal(values);
                  resetCreateFlow();
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <SolaceSelect
              value={filters.status}
              onValueChange={(status) => setFilters((f) => ({ ...f, status: status as GoalFilters['status'] }))}
              ariaLabel="Filter by status"
              variant="default"
              options={[
                { value: 'all', label: 'All statuses' },
                ...GOAL_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
            <SolaceSelect
              value={filters.category}
              onValueChange={(category) => setFilters((f) => ({ ...f, category: category as GoalFilters['category'] }))}
              ariaLabel="Filter by category"
              variant="default"
              options={[
                { value: 'all', label: 'All categories' },
                ...GOAL_CATEGORY_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
            <SolaceSelect
              value={filters.sortBy}
              onValueChange={(sortBy) => setFilters((f) => ({ ...f, sortBy: sortBy as GoalFilters['sortBy'] }))}
              ariaLabel="Sort goals"
              variant="default"
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'highest_priority', label: 'Highest priority' },
                { value: 'nearest_target_date', label: 'Nearest target date' },
                { value: 'most_progress', label: 'Most progress' },
                { value: 'least_progress', label: 'Least progress' },
              ]}
            />
          </div>

          {loading && <div className="p-10 text-center text-gray-500">Loading goals...</div>}
          {error && <div className="p-4 rounded-xl bg-red-50 text-red-700">{error}</div>}
          {!loading && !error && !hasGoals && (
            <div className="p-10 text-center rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-400">
              No goals yet. Create your first personal goal to get started.
            </div>
          )}

          {!loading && !error && hasGoals && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
            </div>
          )}
        </div>
      </div>
  );
}
