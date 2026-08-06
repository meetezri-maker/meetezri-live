/**
 * Content Hub — scheduling.
 *
 * V1 SCOPE: `scheduled_for` is a PLANNED PUBLISH DATE, not a promise. There is no cron, no queue
 * and no automated publication in this phase — an admin publishes manually and the
 * `dueToPublish` list filter makes sure nothing is forgotten. Automation is a v1.1 follow-up
 * (plan §8.7.6) and needs only a secured cron endpoint plus a Vercel entry; no schema change.
 *
 * THERE IS NO `scheduled` STATUS. Scheduling is `status === 'approved'` AND a non-null
 * `scheduled_for`, surfaced as a derived badge — which makes the inconsistent state (a
 * `scheduled` status with no date, or a date with no approval) unrepresentable.
 */

import prisma, { type PrismaClientLike } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/auditLog';
import { contentNotFound, forbiddenAction, scheduleInPast, scheduleNotApproved } from './content-hub.errors';
import { deriveScheduleState, type Actor } from './content-hub.service';

/** A schedule must be far enough ahead to be meaningful and cancellable. */
const MIN_LEAD_MS = 5 * 60 * 1000;

export interface ScheduleResult {
  scheduledFor: string | null;
  status: string;
  schedule: { scheduled: boolean; overdue: boolean };
}

/**
 * Set or reschedule.
 *
 * `super_admin` only — scheduling IS publishing, deferred, so it takes the publish permission.
 */
export async function setSchedule(
  contentId: string,
  scheduledForIso: string,
  actor: Actor
): Promise<ScheduleResult> {
  if (actor.role !== 'super_admin') throw forbiddenAction('schedule content');

  const existing = await prisma.content_items.findFirst({ where: { id: contentId, deleted_at: null } });
  if (!existing) throw contentNotFound(contentId);

  // Scheduling can never bypass approval: the item must already be approved, and any later
  // withdrawal auto-clears the date (see clearScheduleWithinTx).
  if (existing.status !== 'approved') throw scheduleNotApproved(existing.status);

  const scheduledFor = new Date(scheduledForIso);
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() - Date.now() < MIN_LEAD_MS) {
    throw scheduleInPast();
  }

  const previous = existing.scheduled_for;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.content_items.update({
      where: { id: contentId },
      data: { scheduled_for: scheduledFor, updated_by: actor.id, updated_at: new Date() },
    });

    await writeAuditLog(
      {
        actorId: actor.id,
        action: previous ? 'content.schedule_changed' : 'content.schedule_set',
        details: previous
          ? { contentId, from: previous.toISOString(), to: scheduledFor.toISOString() }
          : { contentId, scheduledFor: scheduledFor.toISOString() },
      },
      { tx }
    );

    return row;
  });

  return {
    scheduledFor: updated.scheduled_for?.toISOString() ?? null,
    status: updated.status,
    schedule: deriveScheduleState(updated.status, updated.scheduled_for),
  };
}

/**
 * Cancel a schedule.
 *
 * DELIBERATELY WIDER THAN SETTING IT: `org_admin` may cancel although only `super_admin` may
 * schedule. Cancelling is a brake — stopping a publication that should not happen must not wait
 * for one specific person to be available. Making the safe action easier than the risky one is
 * the point.
 */
export async function cancelSchedule(contentId: string, actor: Actor): Promise<ScheduleResult> {
  if (actor.role !== 'super_admin' && actor.role !== 'org_admin') {
    throw forbiddenAction('cancel a schedule');
  }

  const existing = await prisma.content_items.findFirst({ where: { id: contentId, deleted_at: null } });
  if (!existing) throw contentNotFound(contentId);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.content_items.update({
      where: { id: contentId },
      // Status is untouched — cancelling a schedule does not un-approve the content.
      data: { scheduled_for: null, updated_by: actor.id, updated_at: new Date() },
    });

    if (existing.scheduled_for) {
      await writeAuditLog(
        {
          actorId: actor.id,
          action: 'content.schedule_cancelled',
          details: { contentId, from: existing.scheduled_for.toISOString() },
        },
        { tx }
      );
    }

    return row;
  });

  return {
    scheduledFor: null,
    status: updated.status,
    schedule: deriveScheduleState(updated.status, null),
  };
}

/**
 * Auto-clear helper for other services.
 *
 * Clears the date IN THE SAME TRANSACTION as the change that invalidated it, and records why.
 * Called from the approval and transition paths; exported so cluster publishing can reuse it.
 *
 * (The publish and approval services inline the equivalent logic where they already hold the row,
 * to avoid a redundant read; this helper exists for callers that do not.)
 */
export async function clearScheduleWithinTx(
  tx: PrismaClientLike,
  contentId: string,
  previous: Date | null,
  reason: 'approval_withdrawn' | 'status_changed' | 'published',
  actorId: string | null,
  extra: Record<string, unknown> = {}
): Promise<void> {
  if (!previous) return;

  await tx.content_items.update({ where: { id: contentId }, data: { scheduled_for: null } });
  await writeAuditLog(
    {
      actorId,
      action: 'content.schedule_cleared',
      details: { contentId, from: previous.toISOString(), reason, ...extra },
    },
    { tx }
  );
}
