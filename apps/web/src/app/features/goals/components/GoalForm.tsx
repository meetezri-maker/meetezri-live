import { useMemo, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  GOAL_CATEGORY_OPTIONS,
  GOAL_CHECKIN_FREQUENCY_OPTIONS,
  GOAL_EMOTION_TAG_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  GOAL_SUPPORT_TYPE_OPTIONS,
} from '../constants';
import { PREDEFINED_GOALS } from '../seedGoals';
import { goalFormSchema } from '../validation';
import type { Goal, GoalFormValues, GoalSeedItem } from '../types';

type FormMode = 'create' | 'edit';

const defaultValues: GoalFormValues = {
  goal_title: '',
  goal_category: 'mental_emotional',
  goal_description: '',
  why_this_goal_matters: '',
  target_outcome: '',
  priority_level: 'medium',
  start_date: new Date().toISOString().slice(0, 10),
  target_date: '',
  progress_percentage: 0,
  check_in_frequency: 'daily',
  reminder_enabled: false,
  reminder_time: '',
  small_action_steps: [],
  emotion_tag: undefined,
  support_type_needed: undefined,
  notes: '',
  partner_visibility: false,
  partner_comment_enabled: false,
};

function valuesFromSeed(seed: GoalSeedItem): GoalFormValues {
  return {
    ...defaultValues,
    goal_title: seed.goal_title,
    goal_category: seed.goal_category,
    goal_description: seed.goal_description,
  };
}

function fromGoal(goal: Goal): GoalFormValues {
  return {
    goal_title: goal.goal_title,
    goal_category: goal.goal_category,
    goal_description: goal.goal_description,
    why_this_goal_matters: goal.why_this_goal_matters,
    target_outcome: goal.target_outcome,
    priority_level: goal.priority_level,
    start_date: goal.start_date,
    target_date: goal.target_date || '',
    progress_percentage: goal.progress_percentage,
    check_in_frequency: goal.check_in_frequency,
    reminder_enabled: goal.reminder_enabled,
    reminder_time: goal.reminder_time || '',
    small_action_steps: goal.small_action_steps,
    emotion_tag: goal.emotion_tag,
    support_type_needed: goal.support_type_needed,
    notes: goal.notes || '',
    partner_visibility: goal.partner_visibility,
    partner_comment_enabled: goal.partner_comment_enabled,
  };
}

function initialFormValues(initialGoal: Goal | undefined, initialSeed: GoalSeedItem | null | undefined): GoalFormValues {
  if (initialGoal) return fromGoal(initialGoal);
  if (initialSeed) return valuesFromSeed(initialSeed);
  return defaultValues;
}

export function GoalForm({
  mode,
  initialGoal,
  initialSeed,
  hidePredefinedPicklist,
  onSubmit,
  submitLabel,
}: {
  mode: FormMode;
  initialGoal?: Goal;
  /** When creating, pre-fills title, description, and category from a catalog goal */
  initialSeed?: GoalSeedItem | null;
  /** Hide the in-form catalog shortcuts (e.g. when the parent already picked a template) */
  hidePredefinedPicklist?: boolean;
  onSubmit: (values: GoalFormValues) => void;
  submitLabel: string;
}) {
  const [values, setValues] = useState<GoalFormValues>(() => initialFormValues(initialGoal, mode === 'create' ? initialSeed : undefined));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const actionStepsString = useMemo(() => (values.small_action_steps || []).join(', '), [values.small_action_steps]);

  const categorySeeds = useMemo(
    () => PREDEFINED_GOALS.filter((g) => g.goal_category === values.goal_category),
    [values.goal_category]
  );

  const save = () => {
    try {
      goalFormSchema.parse({
        ...values,
        progress_percentage: Number(values.progress_percentage || 0),
      });
      setErrors({});
      onSubmit({
        ...values,
        progress_percentage: Number(values.progress_percentage || 0),
        small_action_steps: actionStepsString
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const next: Record<string, string> = {};
        err.issues.forEach((issue) => {
          const key = String(issue.path[0] || 'form');
          next[key] = issue.message;
        });
        setErrors(next);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">{mode === 'create' ? 'Create Goal' : 'Edit Goal'}</h3>

      {mode === 'create' && !hidePredefinedPicklist && (
        <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">Predefined goals in this category:</p>
          <div className="space-y-1 max-h-28 overflow-auto">
            {categorySeeds.slice(0, 6).map((seed) => (
              <button
                key={seed.goal_title}
                className="text-left w-full text-sm text-purple-700 dark:text-purple-300 hover:underline"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    goal_title: seed.goal_title,
                    goal_description: seed.goal_description,
                  }))
                }
                type="button"
              >
                {seed.goal_title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Input value={values.goal_title} onChange={(e) => setValues((v) => ({ ...v, goal_title: e.target.value }))} placeholder="Goal Title" />
          {errors.goal_title && <p className="text-xs text-red-500 mt-1">{errors.goal_title}</p>}
        </div>
        <select value={values.goal_category} onChange={(e) => setValues((v) => ({ ...v, goal_category: e.target.value as any }))} className="h-9 rounded-md border border-input bg-input-background px-3 text-sm">
          {GOAL_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Input value={values.goal_description} onChange={(e) => setValues((v) => ({ ...v, goal_description: e.target.value }))} placeholder="Goal Description" />
        <Input value={values.why_this_goal_matters} onChange={(e) => setValues((v) => ({ ...v, why_this_goal_matters: e.target.value }))} placeholder="Why This Goal Matters" />
        <Input value={values.target_outcome} onChange={(e) => setValues((v) => ({ ...v, target_outcome: e.target.value }))} placeholder="Target Outcome" />
        <select value={values.priority_level} onChange={(e) => setValues((v) => ({ ...v, priority_level: e.target.value as any }))} className="h-9 rounded-md border border-input bg-input-background px-3 text-sm">
          {GOAL_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Input type="date" value={values.start_date} onChange={(e) => setValues((v) => ({ ...v, start_date: e.target.value }))} />
        <Input type="date" value={values.target_date || ''} onChange={(e) => setValues((v) => ({ ...v, target_date: e.target.value }))} />
        <Input type="number" min={0} max={100} value={String(values.progress_percentage ?? 0)} onChange={(e) => setValues((v) => ({ ...v, progress_percentage: Number(e.target.value) }))} placeholder="Progress %" />
        <select value={values.check_in_frequency} onChange={(e) => setValues((v) => ({ ...v, check_in_frequency: e.target.value as any }))} className="h-9 rounded-md border border-input bg-input-background px-3 text-sm">
          {GOAL_CHECKIN_FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Input value={actionStepsString} onChange={(e) => setValues((v) => ({ ...v, small_action_steps: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} placeholder="Action Steps (comma separated)" />
        <select value={values.emotion_tag || ''} onChange={(e) => setValues((v) => ({ ...v, emotion_tag: (e.target.value || undefined) as any }))} className="h-9 rounded-md border border-input bg-input-background px-3 text-sm">
          <option value="">Emotion Tag (optional)</option>
          {GOAL_EMOTION_TAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={values.support_type_needed || ''} onChange={(e) => setValues((v) => ({ ...v, support_type_needed: (e.target.value || undefined) as any }))} className="h-9 rounded-md border border-input bg-input-background px-3 text-sm">
          <option value="">Support Type (optional)</option>
          {GOAL_SUPPORT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Input value={values.notes || ''} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} placeholder="Notes" />
        <div className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!values.reminder_enabled} onChange={(e) => setValues((v) => ({ ...v, reminder_enabled: e.target.checked }))} />
          Reminder Enabled
        </div>
        <Input type="time" value={values.reminder_time || ''} onChange={(e) => setValues((v) => ({ ...v, reminder_time: e.target.value }))} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!values.partner_visibility} onChange={(e) => setValues((v) => ({ ...v, partner_visibility: e.target.checked }))} />
          Partner visibility
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!values.partner_comment_enabled} onChange={(e) => setValues((v) => ({ ...v, partner_comment_enabled: e.target.checked }))} />
          Partner comments enabled
        </label>
      </div>

      <Button onClick={save} className="mt-4">{submitLabel}</Button>
    </div>
  );
}
