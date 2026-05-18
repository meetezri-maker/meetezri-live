import { Link } from 'react-router-dom';
import { Calendar, Flag, Target } from 'lucide-react';
import type { Goal } from '../types';

function prettyStatus(status: Goal['status']) {
  switch (status) {
    case 'not_started': return 'Not Started';
    case 'active': return 'Active';
    case 'paused': return 'Paused';
    case 'completed': return 'Completed';
    case 'archived': return 'Archived';
    default: return status;
  }
}

export function GoalCard({ goal }: { goal: Goal }) {
  return (
    <Link
      to={`/app/settings/goals/${goal.id}`}
      className="block rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-gray-900 dark:text-white">{goal.goal_title}</h3>
        <span className="text-xs px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          {goal.priority_level}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">{goal.goal_description}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400 mb-3">
        <div className="flex items-center gap-1"><Target className="w-3 h-3" /> {goal.goal_category}</div>
        <div className="flex items-center gap-1"><Flag className="w-3 h-3" /> {prettyStatus(goal.status)}</div>
        <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(goal.start_date).toLocaleDateString()}</div>
        <div>{goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'No target date'}</div>
      </div>
      <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-slate-400">
        <span>Progress</span>
        <span>{goal.progress_percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${goal.progress_percentage}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
        Last check-in: {goal.last_check_in_date ? new Date(goal.last_check_in_date).toLocaleDateString() : 'No check-ins yet'}
      </p>
    </Link>
  );
}
