/**
 * req-y: draft → in_review 500 — READ ONLY forensic.
 *
 * Answers, from production data rather than inference:
 *   which content item, whether its status moved, whether a transition revision was captured,
 *   whether an audit event was written, and whether ANY partial write survived the 500.
 *
 * Nothing here writes, transitions, approves or publishes.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

const REQUEST_ID = 'req-y';
/** The transition failure recorded under req-y. */
const FAILURE_AT = new Date('2026-08-18T13:13:06.875Z');
const WINDOW_MS = 10 * 60 * 1000;

async function main() {
  const matches = await prisma.error_logs.findMany({
    where: { context: { path: ['requestId'], equals: REQUEST_ID } },
    orderBy: { created_at: 'desc' },
    select: { id: true, message: true, context: true, created_at: true },
  });

  console.log('═══ 1. FULL ERROR CONTEXT ═══');
  for (const row of matches) {
    const ctx = (row.context ?? {}) as Record<string, unknown>;
    if (ctx.endpoint !== '/api/admin/content/:id/transition') continue;
    console.log(`  logged_at : ${row.created_at.toISOString()}`);
    console.log(`  message   : ${row.message}`);
    console.log('  context   :');
    console.log(JSON.stringify(ctx, null, 4).split('\n').map((l) => `    ${l}`).join('\n'));
  }

  // ── Which item was it? ────────────────────────────────────────────────────
  console.log('\n═══ 2. CANDIDATE CONTENT ITEMS (drafts owned by the actor) ═══');
  const drafts = await prisma.content_items.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      editorial_ref: true,
      title: true,
      slug: true,
      status: true,
      created_by: true,
      updated_by: true,
      updated_at: true,
      current_revision_number: true,
    },
    orderBy: { updated_at: 'desc' },
  });
  for (const row of drafts) {
    console.log(
      `  ${(row.editorial_ref ?? '(no ref)').padEnd(10)} ${row.status.padEnd(10)} rev=${row.current_revision_number} ` +
        `updated=${row.updated_at.toISOString()} ${row.id}`,
    );
  }

  // ── Did anything move in the failure window? ──────────────────────────────
  const from = new Date(FAILURE_AT.getTime() - WINDOW_MS);
  const to = new Date(FAILURE_AT.getTime() + WINDOW_MS);
  console.log(`\n═══ 3. WRITES IN THE WINDOW ${from.toISOString()} .. ${to.toISOString()} ═══`);

  const touched = await prisma.content_items.findMany({
    where: { updated_at: { gte: from, lte: to } },
    select: { id: true, editorial_ref: true, status: true, updated_at: true, updated_by: true },
  });
  console.log(`  content_items updated : ${touched.length}`);
  for (const row of touched) {
    console.log(`    ${row.editorial_ref} → ${row.status} at ${row.updated_at.toISOString()} by ${row.updated_by}`);
  }

  const revisions = await prisma.content_revisions.findMany({
    where: { created_at: { gte: from, lte: to } },
    select: {
      id: true,
      content_id: true,
      revision_number: true,
      trigger: true,
      status_at_capture: true,
      created_at: true,
      created_by: true,
    },
    orderBy: { created_at: 'asc' },
  });
  console.log(`  content_revisions created : ${revisions.length}`);
  for (const row of revisions) {
    console.log(
      `    #${row.revision_number} ${row.trigger} status=${row.status_at_capture} ` +
        `content=${row.content_id} at ${row.created_at.toISOString()}`,
    );
  }

  // ── Audit events ──────────────────────────────────────────────────────────
  console.log('\n═══ 4. AUDIT EVENTS IN THE WINDOW ═══');
  try {
    const audits = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `select id, action, actor_id, details, created_at
         from audit_logs
        where created_at between $1 and $2
        order by created_at asc`,
      from,
      to,
    );
    console.log(`  audit_logs rows : ${audits.length}`);
    for (const row of audits) {
      console.log(`    ${row.created_at} ${row.action} actor=${row.actor_id} ${JSON.stringify(row.details)}`);
    }
  } catch (error) {
    console.log(`  audit_logs query failed: ${(error as Error).message}`);
  }

  // ── Transition history for every Week 2 draft ─────────────────────────────
  console.log('\n═══ 5. REVISION HISTORY OF THE WEEK 2 DRAFTS ═══');
  const week2 = drafts.filter((row) => (row.editorial_ref ?? '').startsWith('W2-'));
  for (const row of week2) {
    const revs = await prisma.content_revisions.findMany({
      where: { content_id: row.id },
      select: { revision_number: true, trigger: true, status_at_capture: true, created_at: true },
      orderBy: { revision_number: 'asc' },
    });
    console.log(`  ${row.editorial_ref}: status=${row.status} revisions=${revs.length}`);
    for (const rev of revs) {
      console.log(`     #${rev.revision_number} ${rev.trigger} ${rev.status_at_capture} ${rev.created_at.toISOString()}`);
    }
  }

  /**
   * The control case: W2-G001's transition at 01:26 SUCCEEDED on this same code path. If its
   * status change, revision and audit event are all present, then the schema, the foreign keys,
   * the revision snapshot and the audit writer are all working — and req-y cannot be explained by
   * any of them.
   */
  console.log('\n═══ 6. CONTROL — THE TRANSITION THAT SUCCEEDED ═══');
  const succeeded = drafts.find((row) => row.editorial_ref === 'W2-G001');
  if (succeeded) {
    const audits = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `select action, actor_id, details, created_at
         from audit_logs
        where details->>'contentId' = $1
        order by created_at asc`,
      succeeded.id,
    );
    console.log(`  audit rows for W2-G001 : ${audits.length}`);
    for (const row of audits) {
      console.log(`    ${row.created_at} ${row.action} actor=${row.actor_id} ${JSON.stringify(row.details)}`);
    }

    const snapshot = await prisma.content_revisions.findFirst({
      where: { content_id: succeeded.id, trigger: 'transition' },
      select: { revision_number: true, snapshot: true, created_by: true, created_at: true },
    });
    if (snapshot) {
      const size = JSON.stringify(snapshot.snapshot ?? {}).length;
      console.log(
        `  revision #${snapshot.revision_number} snapshot=${size} bytes created_by=${snapshot.created_by}`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
