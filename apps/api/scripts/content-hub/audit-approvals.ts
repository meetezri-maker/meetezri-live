/**
 * Approval audit history — READ ONLY.
 *
 * Answers Task 11: which approvals actually landed, when, by whom, and whether any gate/status
 * disagreement exists that would indicate a partial write.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

const REFS = ['W1-A001', 'W1-G001', 'W1-B001'];

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
    orderBy: { editorial_ref: 'asc' },
    select: {
      id: true,
      editorial_ref: true,
      status: true,
      founder_approval: true,
      marketing_approval: true,
      seo_approval: true,
      current_revision_number: true,
      updated_by: true,
      updated_at: true,
    },
  });

  const idToRef = new Map(rows.map((r) => [r.id, r.editorial_ref!]));

  console.log('═══ CURRENT STATE ═══');
  for (const row of rows) {
    const gates = [row.founder_approval, row.marketing_approval, row.seo_approval];
    const allApproved = gates.every((g) => g === 'approved');
    const disagreement = allApproved && row.status !== 'approved';
    console.log(
      `  ${row.editorial_ref}  status=${row.status}  gates=[${gates.join('/')}]  rev=${row.current_revision_number}` +
        `  updated=${row.updated_at.toISOString()}${disagreement ? '   *** GATE/STATUS DISAGREEMENT ***' : ''}`
    );
  }

  console.log('\n═══ APPROVAL AUDIT TRAIL ═══');
  const audits = await prisma.audit_logs.findMany({
    where: { action: { in: ['content.approval_set', 'content.approved', 'content.transitioned'] } },
    orderBy: { created_at: 'asc' },
    select: { id: true, action: true, actor_id: true, details: true, created_at: true },
  });

  if (audits.length === 0) console.log('  (none)');

  for (const audit of audits) {
    const details = (audit.details ?? {}) as Record<string, unknown>;
    const ref = idToRef.get(String(details.contentId)) ?? String(details.contentId ?? '?').slice(0, 8);
    const actor = await prisma.profiles.findUnique({
      where: { id: audit.actor_id ?? '' },
      select: { full_name: true, role: true },
    });
    const who = actor ? `${actor.full_name} (${actor.role})` : `UNKNOWN actor ${audit.actor_id}`;
    const change = details.gate ? `${details.gate}: ${details.from} -> ${details.to}` : '';
    console.log(`  ${audit.created_at.toISOString()}  ${audit.action.padEnd(24)} ${ref.padEnd(10)} ${change.padEnd(34)} ${who}`);
  }

  console.log('\n═══ REVISIONS ═══');
  for (const row of rows) {
    const revisions = await prisma.content_revisions.findMany({
      where: { content_id: row.id },
      orderBy: { revision_number: 'asc' },
      select: { revision_number: true, trigger: true, status_at_capture: true, change_summary: true, created_at: true },
    });
    console.log(`  ${row.editorial_ref}: ${revisions.length} revision(s)`);
    for (const rev of revisions) {
      console.log(
        `    #${rev.revision_number} ${rev.trigger} status=${rev.status_at_capture} "${rev.change_summary ?? ''}" ${rev.created_at.toISOString()}`
      );
    }
  }

  console.log('\n═══ ADMIN PROFILES (possible actors) ═══');
  const admins = await prisma.profiles.findMany({
    where: { role: { in: ['super_admin', 'org_admin', 'team_admin'] } },
    select: { id: true, full_name: true, role: true },
  });
  for (const a of admins) console.log(`  ${a.role?.padEnd(12)} ${a.full_name} ${a.id}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
