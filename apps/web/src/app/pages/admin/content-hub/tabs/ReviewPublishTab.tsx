/**
 * Review & Publish tab — status, gates, checklist, schedule, workflow, revisions.
 *
 * WORKFLOW ACTIONS ARE CONTEXTUAL: only transitions that are legal from the current status are
 * rendered. A wall of disabled buttons is clutter that teaches nobody anything.
 *
 * SCHEDULING IS "PLANNED PUBLICATION", NOT AUTOMATION. Version One has no cron; the date is a
 * reminder and the item must still be published by hand. The copy says so explicitly, because a
 * badge that implies automatic publishing would let someone stop watching.
 */

import { useState } from 'react';
import { CalendarClock, Layers, ShieldCheck } from 'lucide-react';
import type { ContentHubDetail, ContentHubTransitionAction } from '@/lib/api';
import {
  adminBtnPrimary,
  adminBtnSecondary,
  adminCardStatic,
  adminInput,
} from '@/app/admin';
import { cn } from '@/lib/utils';
import {
  useCancelSchedule,
  useContentHubChecklist,
  useSetApproval,
  useSetSchedule,
  useTransitionContent,
} from '@/lib/queries/contentHubQueries';
import { ApprovalDialog } from '../components/ApprovalDialog';
import { ApprovalDots } from '../components/ApprovalDots';
import { ChecklistPanel } from '../components/ChecklistPanel';
import { ClusterPublishDialog } from '../components/ClusterPublishDialog';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { ContentStatusPill } from '../components/ContentStatusPill';
import { RevisionPanel } from '../components/RevisionPanel';

/** Legal transitions per status — mirrors the backend state machine. */
const ACTIONS_BY_STATUS: Record<string, ContentHubTransitionAction[]> = {
  draft: ['submit', 'archive'],
  in_review: ['withdraw', 'archive'],
  changes_requested: ['submit', 'archive'],
  approved: ['publish', 'withdraw', 'archive'],
  published: ['unpublish'],
  unpublished: ['publish', 'archive'],
  archived: ['restore'],
};

const ACTION_LABEL: Record<ContentHubTransitionAction, string> = {
  submit: 'Submit for review',
  withdraw: 'Withdraw to draft',
  publish: 'Publish',
  unpublish: 'Unpublish',
  archive: 'Archive',
  restore: 'Restore to draft',
};

/** Actions only a super admin may perform — mirrored from the backend, re-checked there. */
const SUPER_ADMIN_ONLY: ContentHubTransitionAction[] = ['publish', 'unpublish', 'archive'];

const CONFIRM_COPY: Partial<Record<ContentHubTransitionAction, { title: string; body: string }>> = {
  publish: {
    title: 'Publish this content?',
    body: 'It becomes visible at its public URL immediately. The checklist is re-run on the server before anything is published.',
  },
  unpublish: {
    title: 'Unpublish this content?',
    body: 'The public page will return 404 straight away. Inbound links and citations will stop working until it is published again.',
  },
  archive: {
    title: 'Archive this content?',
    body: 'It is removed from the default list and cannot be published until it is restored. Nothing is deleted.',
  },
};

export interface ReviewPublishTabProps {
  contentId: string;
  content: ContentHubDetail;
  role: string;
}

export function ReviewPublishTab({ contentId, content, role }: ReviewPublishTabProps) {
  const checklist = useContentHubChecklist(contentId);
  const transition = useTransitionContent(contentId);
  const approval = useSetApproval(contentId);
  const setSchedule = useSetSchedule(contentId);
  const cancelSchedule = useCancelSchedule(contentId);

  const [pendingAction, setPendingAction] = useState<ContentHubTransitionAction | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [clusterOpen, setClusterOpen] = useState(false);
  const [plannedDate, setPlannedDate] = useState(
    content.scheduledFor ? content.scheduledFor.slice(0, 16) : '',
  );

  const isSuperAdmin = role === 'super_admin';
  const available = (ACTIONS_BY_STATUS[content.status] ?? []).filter(
    (action) => !SUPER_ADMIN_ONLY.includes(action) || isSuperAdmin,
  );

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const checklistBlocked = checklist.data ? !checklist.data.passed : true;

  const runAction = (action: ContentHubTransitionAction) => {
    if (CONFIRM_COPY[action]) {
      setPendingAction(action);
      return;
    }
    transition.mutate({ action });
  };

  return (
    <div className="space-y-4">
      <div className={cn(adminCardStatic, 'space-y-4 p-6')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">Status</h2>
          <ContentStatusPill
            status={content.status}
            schedule={content.schedule}
            scheduledFor={content.scheduledFor}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--admin-text)]">Approval gates</p>
            <button type="button" onClick={() => setApprovalOpen(true)} className={adminBtnSecondary}>
              Set approval
            </button>
          </div>
          <ApprovalDots approvals={content.approvals} variant="list" />
          {content.approvalActors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--admin-text-muted)]">
              {content.approvalActors
                .filter((actor) => actor.at)
                .map((actor) => (
                  <li key={actor.gate}>
                    {actor.gate}: {actor.actorName ?? 'Unknown'} ·{' '}
                    {actor.at ? new Date(actor.at).toLocaleString() : ''}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className={cn(adminCardStatic, 'p-6')}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Publish checklist
        </h2>
        <p className="mb-3 text-xs text-[var(--admin-text-muted)]">
          Evaluated by the server and re-run inside the publish transaction — this is what will
          actually be enforced.
        </p>
        <ChecklistPanel
          checklist={checklist.data}
          isLoading={checklist.isLoading}
          isError={checklist.isError}
        />
      </div>

      <div className={cn(adminCardStatic, 'space-y-3 p-6')}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
          <CalendarClock aria-hidden="true" className="h-4 w-4" />
          Planned publication
        </h2>

        <div
          role="note"
          className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-[var(--admin-text-secondary)]"
        >
          Version One does not publish automatically. This is a planned date to help the team
          coordinate — someone still has to press Publish. Times are shown in{' '}
          <strong className="text-[var(--admin-text)]">{timezone}</strong>.
        </div>

        {content.status !== 'approved' ? (
          <p className="text-sm text-[var(--admin-text-muted)]">
            A planned date can only be set once every approval gate has passed.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="planned-date" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
                Planned date and time
              </label>
              <input
                id="planned-date"
                type="datetime-local"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className={cn(adminInput, 'w-64')}
              />
            </div>
            <button
              type="button"
              disabled={!isSuperAdmin || !plannedDate || setSchedule.isPending}
              onClick={() => setSchedule.mutate(new Date(plannedDate).toISOString())}
              className={adminBtnPrimary}
              title={isSuperAdmin ? undefined : 'Only a super admin can set a planned date'}
            >
              {content.scheduledFor ? 'Reschedule' : 'Set planned date'}
            </button>
            {content.scheduledFor ? (
              <button
                type="button"
                disabled={cancelSchedule.isPending}
                onClick={() => {
                  cancelSchedule.mutate();
                  setPlannedDate('');
                }}
                className={adminBtnSecondary}
              >
                Clear
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className={cn(adminCardStatic, 'space-y-3 p-6')}>
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">Workflow</h2>

        {available.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-secondary)]">
            No actions are available to you from this status.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => runAction(action)}
                disabled={transition.isPending || (action === 'publish' && checklistBlocked)}
                title={
                  action === 'publish' && checklistBlocked
                    ? 'The checklist has blocking failures — resolve them first.'
                    : undefined
                }
                className={action === 'publish' ? adminBtnPrimary : adminBtnSecondary}
              >
                {ACTION_LABEL[action]}
              </button>
            ))}
          </div>
        )}

        {content.status === 'approved' && isSuperAdmin ? (
          <div className="border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => setClusterOpen(true)}
              className={cn(adminBtnSecondary, 'inline-flex items-center gap-2')}
            >
              <Layers aria-hidden="true" className="h-4 w-4" />
              Publish as cluster
            </button>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              Use this when items link to each other and must go live together.
            </p>
          </div>
        ) : null}
      </div>

      <RevisionPanel contentId={contentId} currentUpdatedAt={content.updatedAt} />

      <ApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        contentTitle={content.title}
        approvals={content.approvals}
        isSubmitting={approval.isPending}
        onSubmit={(input) => approval.mutate(input, { onSuccess: () => setApprovalOpen(false) })}
      />

      <ConfirmActionDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction ? CONFIRM_COPY[pendingAction]?.title ?? 'Are you sure?' : ''}
        body={pendingAction ? CONFIRM_COPY[pendingAction]?.body ?? '' : ''}
        confirmLabel={pendingAction ? ACTION_LABEL[pendingAction] : 'Confirm'}
        isSubmitting={transition.isPending}
        onConfirm={() => {
          if (pendingAction) {
            transition.mutate({ action: pendingAction }, { onSettled: () => setPendingAction(null) });
          }
        }}
      />

      <ClusterPublishDialog
        open={clusterOpen}
        onOpenChange={setClusterOpen}
        seedId={contentId}
        role={role}
      />
    </div>
  );
}
