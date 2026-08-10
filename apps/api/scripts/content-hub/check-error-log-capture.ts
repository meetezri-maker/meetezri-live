/**
 * Why is `error_logs` empty? READ ONLY except for one self-cleaning probe row.
 *
 * Two candidate reasons a 500 leaves no trace:
 *   1. the writer is fire-and-forget and the serverless function freezes first (known, fixed
 *      locally, not yet committed);
 *   2. the table rejects the insert — RLS, grants, or a constraint — in which case fixing (1)
 *      would change nothing.
 *
 * This distinguishes them, and reports the current approval state alongside.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

async function main() {
  console.log('═══ error_logs ═══');
  console.log(`  rows: ${await prisma.error_logs.count()}`);

  const rls = await prisma.$queryRawUnsafe<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('error_logs','audit_logs')`
  );
  for (const row of rls) {
    console.log(`  ${row.relname}: rls=${row.relrowsecurity} forced=${row.relforcerowsecurity}`);
  }

  const policies = await prisma.$queryRawUnsafe<Array<{ tablename: string; policyname: string; cmd: string }>>(
    `SELECT tablename, policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('error_logs','audit_logs')`
  );
  console.log(`  policies: ${policies.length === 0 ? '(none)' : ''}`);
  for (const p of policies) console.log(`    ${p.tablename}.${p.policyname} (${p.cmd})`);

  console.log(`\n  current role: ${(await prisma.$queryRawUnsafe<Array<{ current_user: string }>>('SELECT current_user'))[0].current_user}`);

  // Can this connection insert at all? Written then removed.
  console.log('\n═══ INSERT PROBE ═══');
  try {
    const probe = await prisma.error_logs.create({
      data: {
        message: 'capture probe — safe to ignore',
        severity: 'info',
        status: 'resolved',
        context: { probe: true } as never,
      },
      select: { id: true },
    });
    console.log('  insert: OK');
    await prisma.error_logs.delete({ where: { id: probe.id } });
    console.log('  probe row removed');
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.log(`  insert FAILED code=${err.code ?? '?'} — ${(err.message ?? '').split('\n')[0]}`);
    console.log('  >>> fixing the fire-and-forget writer alone would NOT make errors appear.');
  }

  console.log('\n═══ APPROVAL STATE (unchanged by this script) ═══');
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: ['W1-A001', 'W1-G001', 'W1-B001'] }, deleted_at: null },
    orderBy: { editorial_ref: 'asc' },
    select: {
      id: true,
      editorial_ref: true,
      status: true,
      founder_approval: true,
      marketing_approval: true,
      seo_approval: true,
      current_revision_number: true,
      updated_at: true,
    },
  });
  for (const row of rows) {
    const revisions = await prisma.content_revisions.count({ where: { content_id: row.id } });
    console.log(
      `  ${row.editorial_ref}  status=${row.status}  ` +
        `gates=[founder:${row.founder_approval} marketing:${row.marketing_approval} seo:${row.seo_approval}]  ` +
        `revisions=${revisions}  updated=${row.updated_at.toISOString()}`
    );
  }

  console.log('\n═══ APPROVAL AUDIT TRAIL ═══');
  const audits = await prisma.audit_logs.findMany({
    where: { action: { in: ['content.approval_set', 'content.approved'] } },
    orderBy: { created_at: 'asc' },
    select: { action: true, details: true, created_at: true },
  });
  for (const a of audits) {
    const d = (a.details ?? {}) as Record<string, unknown>;
    console.log(`  ${a.created_at.toISOString()}  ${a.action}  ${d.gate ?? ''} ${d.from ?? ''}->${d.to ?? ''}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
