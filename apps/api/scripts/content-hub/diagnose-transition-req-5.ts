/**
 * req-5: TypeError on draft → in_review — READ ONLY forensic.
 *
 * The stack points at RESPONSE SERIALIZATION, which runs after the database transaction has
 * already committed. So unlike req-y (where the transaction never started), the interesting
 * question here is the opposite one: did the write land even though the caller was told it failed?
 *
 * Nothing here writes, transitions, approves or publishes.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

/** The TypeError recorded under req-5. */
const FAILURE_AT = new Date('2026-08-18T15:27:45.573Z');
const WINDOW_MS = 5 * 60 * 1000;

async function main() {
  // ── How often has this endpoint thrown, and with what? ────────────────────
  const transitionErrors = await prisma.error_logs.findMany({
    where: { context: { path: ['endpoint'], equals: '/api/admin/content/:id/transition' } },
    orderBy: { created_at: 'asc' },
    select: { id: true, message: true, context: true, created_at: true },
  });

  console.log('═══ 1. EVERY RECORDED FAILURE OF THIS ENDPOINT ═══');
  console.log(`  rows: ${transitionErrors.length}`);
  for (const row of transitionErrors) {
    const ctx = (row.context ?? {}) as Record<string, unknown>;
    console.log(
      `  ${row.created_at.toISOString()}  req=${String(ctx.requestId).padEnd(6)} ` +
        `${String(ctx.title).padEnd(30)} ${row.message.split('\n')[0].slice(0, 60)}`,
    );
  }

  // ── Did the write land despite the 500? ───────────────────────────────────
  const from = new Date(FAILURE_AT.getTime() - WINDOW_MS);
  const to = new Date(FAILURE_AT.getTime() + WINDOW_MS);

  console.log(`\n═══ 2. PRODUCTION STATE AROUND ${FAILURE_AT.toISOString()} ═══`);

  const items = await prisma.content_items.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      editorial_ref: true,
      status: true,
      current_revision_number: true,
      updated_at: true,
      updated_by: true,
      published_at: true,
      founder_approval: true,
      marketing_approval: true,
      seo_approval: true,
    },
    orderBy: { updated_at: 'desc' },
  });
  for (const row of items) {
    const inWindow = row.updated_at >= from && row.updated_at <= to;
    console.log(
      `  ${(row.editorial_ref ?? '(no ref)').padEnd(10)} ${row.status.padEnd(11)} rev=${row.current_revision_number} ` +
        `gates=${row.founder_approval}/${row.marketing_approval}/${row.seo_approval} ` +
        `updated=${row.updated_at.toISOString()}${inWindow ? '   <<< IN THE FAILURE WINDOW' : ''}`,
    );
  }

  const revisions = await prisma.content_revisions.findMany({
    where: { created_at: { gte: from, lte: to } },
    select: {
      content_id: true,
      revision_number: true,
      trigger: true,
      status_at_capture: true,
      created_at: true,
      created_by: true,
    },
    orderBy: { created_at: 'asc' },
  });
  console.log(`\n  revisions created in the window: ${revisions.length}`);
  for (const row of revisions) {
    console.log(
      `    #${row.revision_number} ${row.trigger} → ${row.status_at_capture} content=${row.content_id} ` +
        `at ${row.created_at.toISOString()}`,
    );
  }

  const audits = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `select action, actor_id, details, created_at
       from audit_logs
      where created_at between $1 and $2
      order by created_at asc`,
    from,
    to,
  );
  console.log(`\n  audit rows in the window: ${audits.length}`);
  for (const row of audits) {
    console.log(`    ${row.created_at} ${row.action} ${JSON.stringify(row.details)}`);
  }

  // ── The verdict on partial writes ─────────────────────────────────────────
  console.log('\n═══ 3. WAS THE TRANSACTION COMPLETE? ═══');
  const moved = items.filter((row) => row.updated_at >= from && row.updated_at <= to);
  for (const row of moved) {
    const revs = await prisma.content_revisions.count({
      where: { content_id: row.id, created_at: { gte: from, lte: to } },
    });
    const auditRows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `select count(*)::bigint as n from audit_logs
        where created_at between $1 and $2 and details->>'contentId' = $3`,
      from,
      to,
      row.id,
    );
    console.log(
      `  ${row.editorial_ref}: status=${row.status}  revisions=${revs}  auditRows=${auditRows[0]?.n}` +
        `  → ${revs === 1 && Number(auditRows[0]?.n ?? 0) >= 1 ? 'COMPLETE (all three parts landed)' : 'INCOMPLETE'}`,
    );
  }
  if (moved.length === 0) console.log('  no content_items were updated in the window');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
