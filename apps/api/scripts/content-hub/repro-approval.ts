/**
 * Reproduce the approval 500. WRITES NOTHING.
 *
 * Two probes, in order of how much they touch:
 *
 *   1. Can Prisma run an INTERACTIVE transaction at all against the configured connection?
 *      `setApprovalGate` wraps its work in `prisma.$transaction(async (tx) => …)`, which needs a
 *      session held across statements. Supabase's PgBouncer transaction pooler (port 6543) does
 *      not hold one — Phase 5B already hit `P2028` there from an operator script.
 *
 *   2. The approval statement sequence itself — the same reads, the same `content_items.update`,
 *      the same audit insert — inside a transaction that is DELIBERATELY ROLLED BACK. That
 *      exercises the exact failing path against the real record and leaves nothing behind.
 *
 * Run against whichever DATABASE_URL you want to test; the target is printed first.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { writeAuditLog } from '../../src/lib/auditLog';

const WEEK1 = [
  ['W1-A001', '26ee725d-d6e3-44b9-9093-ab70084d925b'],
  ['W1-G001', '4085de42-9b76-4b42-b73d-4cdfaf0b3b3e'],
  ['W1-B001', '7d95e2a0-a480-48a2-99ac-3aad2b0946ef'],
] as const;

const ACTOR_ID = '6874e034-a3e9-45a0-835f-cfe21fdda65d';

/** Sentinel used to abort the probe transaction after the real statements have run. */
class RollbackProbe extends Error {}

function target(): string {
  const raw = process.env.DATABASE_URL ?? '';
  const match = raw.match(/@([^/?]+)\//);
  return match ? match[1] : '(unparseable)';
}

async function probeInteractiveTransaction(attempts: number) {
  console.log(`\n─── PROBE 1: interactive transaction × ${attempts} (read-only) ───`);
  let ok = 0;
  let failed = 0;

  for (let i = 1; i <= attempts; i += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        // Two statements is the minimum that requires the session to persist between them.
        await tx.content_items.count();
        await tx.profiles.count();
      });
      ok += 1;
    } catch (error) {
      failed += 1;
      const err = error as { code?: string; message?: string };
      console.log(`  attempt ${i}: FAILED  code=${err.code ?? '?'}  ${(err.message ?? '').split('\n')[0]}`);
    }
  }
  console.log(`  ${ok}/${attempts} succeeded, ${failed} failed`);
  return failed === 0;
}

async function probeApprovalStatements(label: string, contentId: string, gate: string) {
  console.log(`\n─── PROBE 2: approval statements for ${label} (rolled back) ───`);

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.content_items.findFirstOrThrow({
        where: { id: contentId, deleted_at: null },
      });
      const previous = (row as unknown as Record<string, string>)[`${gate}_approval`];
      console.log(`  read row: status=${row.status} ${gate}_approval=${previous}`);

      // The same update the service performs.
      await tx.content_items.update({
        where: { id: contentId },
        data: {
          [`${gate}_approval`]: 'approved',
          updated_by: ACTOR_ID,
          updated_at: new Date(),
        },
      });
      console.log('  content_items.update: OK');

      // The same audit write the service performs, through the same writer.
      await writeAuditLog(
        {
          actorId: ACTOR_ID,
          action: 'content.approval_set',
          details: { contentId, gate, from: previous, to: 'approved' },
        },
        { tx }
      );
      console.log('  writeAuditLog: OK');

      throw new RollbackProbe('probe complete — rolling back');
    });
  } catch (error) {
    if (error instanceof RollbackProbe) {
      console.log('  transaction ROLLED BACK — nothing persisted');
      return true;
    }
    const err = error as { code?: string; message?: string; stack?: string };
    console.log(`  FAILED  code=${err.code ?? '?'}`);
    console.log(`  ${(err.message ?? String(error)).split('\n').slice(0, 6).join('\n  ')}`);
    return false;
  }
  return false;
}

/**
 * The FINAL-GATE path.
 *
 * W1-B001 already has founder and seo approved, so approving marketing is the transition that
 * flips the item to `approved` — and that is the only branch which calls `captureRevision`. The
 * first two approvals never reached it, which is exactly the asymmetry the bug report describes.
 *
 * Replays the whole branch, then rolls back.
 */
async function probeFinalGate(label: string, contentId: string, gate: string) {
  console.log(`\n─── PROBE 3: FINAL-gate approval for ${label} (rolled back) ───`);

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.content_items.findFirstOrThrow({
        where: { id: contentId, deleted_at: null },
      });
      const previous = (row as unknown as Record<string, string>)[`${gate}_approval`];
      console.log(
        `  read row: status=${row.status} gates=[${row.founder_approval}/${row.marketing_approval}/${row.seo_approval}]`
      );

      await tx.content_items.update({
        where: { id: contentId },
        data: {
          [`${gate}_approval`]: 'approved',
          status: 'approved',
          updated_by: ACTOR_ID,
          updated_at: new Date(),
        },
      });
      console.log('  content_items.update (gate + status=approved): OK');

      await writeAuditLog(
        {
          actorId: ACTOR_ID,
          action: 'content.approval_set',
          details: { contentId, gate, from: previous, to: 'approved' },
        },
        { tx }
      );
      console.log('  writeAuditLog(approval_set): OK');

      // The branch only the last gate reaches.
      const { captureRevision } = await import('../../src/modules/content-hub/content-hub.revision');
      const result = await captureRevision(tx, {
        contentId,
        trigger: 'transition',
        changeSummary: 'All gates approved',
        actorId: ACTOR_ID,
        statusOverride: 'approved',
      });
      console.log(`  captureRevision: OK (revision ${result.revisionNumber})`);

      await writeAuditLog(
        { actorId: ACTOR_ID, action: 'content.approved', details: { contentId } },
        { tx }
      );
      console.log('  writeAuditLog(approved): OK');

      throw new RollbackProbe('probe complete');
    });
  } catch (error) {
    if (error instanceof RollbackProbe) {
      console.log('  transaction ROLLED BACK — nothing persisted');
      return true;
    }
    const err = error as { code?: string; message?: string; meta?: unknown };
    console.log(`\n  *** FAILED HERE ***  code=${err.code ?? '?'}`);
    console.log(`  ${(err.message ?? String(error)).split('\n').slice(0, 14).join('\n  ')}`);
    if (err.meta) console.log(`  meta: ${JSON.stringify(err.meta)}`);
    return false;
  }
  return false;
}

async function main() {
  console.log('═══ APPROVAL REPRO ═══');
  console.log(`  target: ${target()}`);

  await probeInteractiveTransaction(6);
  await probeApprovalStatements('W1-A001', WEEK1[0][1], 'marketing');
  await probeFinalGate('W1-B001', WEEK1[2][1], 'marketing');

  // Confirm nothing changed.
  console.log('\n─── STATE AFTER PROBES (must be unchanged) ───');
  for (const [label, id] of WEEK1) {
    const row = await prisma.content_items.findUniqueOrThrow({
      where: { id },
      select: { status: true, founder_approval: true, marketing_approval: true, seo_approval: true, updated_by: true },
    });
    console.log(
      `  ${label}: status=${row.status} gates=[${row.founder_approval}/${row.marketing_approval}/${row.seo_approval}]`
    );
  }

  const audits = await prisma.audit_logs.count({ where: { action: 'content.approval_set' } });
  console.log(`  audit rows with action=content.approval_set: ${audits}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
