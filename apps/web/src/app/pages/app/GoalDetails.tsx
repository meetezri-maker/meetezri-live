import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/app/components/AppLayout';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';
import { GoalCheckInForm } from '@/app/features/goals/components/GoalCheckInForm';
import { GoalForm } from '@/app/features/goals/components/GoalForm';
import { useGoalCheckIns, useGoals } from '@/app/features/goals/hooks';

export function GoalDetails() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { goals, updateGoal, updateGoalStatus, removeGoal } = useGoals(user?.id);
  const { checkIns, addCheckIn } = useGoalCheckIns(user?.id, goalId);
  const goal = goals.find((g) => g.id === goalId);

  if (!goal) {
    return (
      <AppLayout>
        <div className="p-10 text-center text-gray-600">Goal not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/app/settings/goals" className="inline-flex items-center gap-2 text-gray-700 dark:text-slate-300 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Goals
          </Link>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{goal.goal_title}</h1>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{goal.goal_description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p><strong>Status:</strong> {goal.status}</p>
              <p><strong>Priority:</strong> {goal.priority_level}</p>
              <p><strong>Category:</strong> {goal.goal_category}</p>
              <p><strong>Why it matters:</strong> {goal.why_this_goal_matters}</p>
              <p><strong>Target outcome:</strong> {goal.target_outcome}</p>
              <p><strong>Action steps:</strong> {goal.small_action_steps.join(', ') || 'None'}</p>
              <p><strong>Notes:</strong> {goal.notes || 'None'}</p>
              <p><strong>Last updated:</strong> {new Date(goal.updated_at).toLocaleString()}</p>
            </div>
            <div className="mt-4 h-3 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${goal.progress_percentage}%` }} />
            </div>
            <p className="text-xs mt-1 text-gray-600 dark:text-slate-400">Progress: {goal.progress_percentage}%</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void updateGoalStatus(goal.id, 'paused')}>Pause</Button>
              <Button variant="outline" onClick={() => void updateGoalStatus(goal.id, 'active')}>Resume</Button>
              <Button variant="outline" onClick={() => void updateGoalStatus(goal.id, 'completed')}>Mark Completed</Button>
              <Button variant="outline" onClick={() => void updateGoalStatus(goal.id, 'archived')}>Archive</Button>
              <Button variant="destructive" onClick={async () => { await removeGoal(goal.id); navigate('/app/settings/goals'); }}>Delete</Button>
            </div>
          </div>

          <div className="mb-6">
            <GoalForm
              mode="edit"
              initialGoal={goal}
              submitLabel="Update Goal"
              onSubmit={async (values) => {
                await updateGoal(goal.id, { ...values, progress_percentage: values.progress_percentage ?? goal.progress_percentage });
              }}
            />
          </div>

          <div className="mb-6">
            <GoalCheckInForm
              key={`${goal.id}-${checkIns.length}`}
              goal={goal}
              initialProgress={goal.progress_percentage}
              onSubmit={async (payload) => {
                await addCheckIn(payload);
              }}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Check-in History</h3>
            {checkIns.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">No check-ins yet.</p>
            ) : (
              <div className="space-y-3">
                {checkIns.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">{new Date(c.created_at).toLocaleString()}</p>
                    <p className="text-sm">Progress: {c.progress_percentage}% {c.mood ? `• Mood: ${c.mood}` : ''}</p>
                    {c.reflection && <p className="text-sm text-gray-700 dark:text-slate-300">Reflection: {c.reflection}</p>}
                    {c.challenges_faced && <p className="text-sm text-gray-700 dark:text-slate-300">Challenges: {c.challenges_faced}</p>}
                    {c.wins && <p className="text-sm text-gray-700 dark:text-slate-300">Wins: {c.wins}</p>}
                    {c.notes && <p className="text-sm text-gray-700 dark:text-slate-300">Notes: {c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
