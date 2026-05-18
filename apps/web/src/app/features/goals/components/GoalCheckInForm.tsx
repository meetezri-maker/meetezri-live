import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { GOAL_CATEGORY_OPTIONS, GOAL_EMOTION_TAG_OPTIONS } from '../constants';
import type { EmotionTag, Goal, GoalCheckInValues } from '../types';

function categoryLabel(category: Goal['goal_category']) {
  return GOAL_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category;
}

export function GoalCheckInForm({
  goal,
  initialProgress,
  onSubmit,
}: {
  goal: Goal;
  initialProgress: number;
  onSubmit: (values: GoalCheckInValues) => void | Promise<void>;
}) {
  const [progress, setProgress] = useState(String(initialProgress));
  const [mood, setMood] = useState('');
  const [reflection, setReflection] = useState('');
  const [challenges, setChallenges] = useState('');
  const [wins, setWins] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setProgress(String(initialProgress));
  }, [goal.id, initialProgress]);

  useEffect(() => {
    setMood(goal.emotion_tag ?? '');
  }, [goal.id, goal.emotion_tag]);

  const submit = () => {
    void onSubmit({
      progress_percentage: Math.max(0, Math.min(100, Number(progress) || 0)),
      mood: mood ? (mood as EmotionTag) : undefined,
      reflection: reflection.trim() || undefined,
      challenges_faced: challenges.trim() || undefined,
      wins: wins.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h3 className="font-bold text-gray-900 dark:text-white mb-1">Daily check-in</h3>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
        Log how this goal is going using the same kinds of detail as when you created it.
      </p>

      <div className="mb-5 p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-2 text-sm">
        <p className="font-semibold text-gray-900 dark:text-white">{goal.goal_title}</p>
        <p className="text-gray-600 dark:text-slate-400">
          <span className="text-gray-500 dark:text-slate-500">Category: </span>
          {categoryLabel(goal.goal_category)}
        </p>
        {goal.why_this_goal_matters ? (
          <p className="text-gray-700 dark:text-slate-300">
            <span className="font-medium text-gray-900 dark:text-white">Why it matters: </span>
            {goal.why_this_goal_matters}
          </p>
        ) : null}
        {goal.target_outcome ? (
          <p className="text-gray-700 dark:text-slate-300">
            <span className="font-medium text-gray-900 dark:text-white">Target outcome: </span>
            {goal.target_outcome}
          </p>
        ) : null}
        {goal.small_action_steps?.length ? (
          <p className="text-gray-700 dark:text-slate-300">
            <span className="font-medium text-gray-900 dark:text-white">Action steps: </span>
            {goal.small_action_steps.join(', ')}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`checkin-progress-${goal.id}`}>Progress %</Label>
          <Input
            id={`checkin-progress-${goal.id}`}
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            placeholder="0–100"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`checkin-mood-${goal.id}`}>Emotion tag</Label>
          <select
            id={`checkin-mood-${goal.id}`}
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
          >
            <option value="">How are you feeling? (optional)</option>
            {GOAL_EMOTION_TAG_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor={`checkin-reflection-${goal.id}`}>Reflection</Label>
          <Textarea
            id={`checkin-reflection-${goal.id}`}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What stood out today? What did you notice about your progress?"
            rows={3}
            className="min-h-[88px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`checkin-challenges-${goal.id}`}>Challenges faced</Label>
          <Textarea
            id={`checkin-challenges-${goal.id}`}
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            placeholder="Obstacles or friction (optional)"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`checkin-wins-${goal.id}`}>Wins</Label>
          <Textarea
            id={`checkin-wins-${goal.id}`}
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            placeholder="Small wins to celebrate (optional)"
            rows={3}
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor={`checkin-notes-${goal.id}`}>Notes for this check-in</Label>
          <Textarea
            id={`checkin-notes-${goal.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else to remember (optional)"
            rows={2}
          />
        </div>
      </div>

      <Button className="mt-4" type="button" onClick={submit}>
        Submit check-in
      </Button>
    </div>
  );
}
