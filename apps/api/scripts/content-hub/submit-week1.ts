/**
 * Week 1 — submit the three drafts for review (Phase 5B Task 19).
 *
 * `draft → in_review` through the REAL state-machine service, so the transition revision and the
 * audit event are written exactly as they would be from the admin UI. Nothing here approves,
 * publishes, or touches `status` directly.
 *
 * Dry run by default:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/submit-week1.ts --actor=<id>
 * Apply:
 *   … --apply --actor=<id>
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { transitionContent } from '../../src/modules/content-hub/content-hub.publish.service';
import type { Actor } from '../../src/modules/content-hub/content-hub.service';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ACTOR_ID = argv.find((a) => a.startsWith('--actor='))?.split('=')[1];

const REFS = ['W1-A001', 'W1-G001', 'W1-B001'];

async function main() {
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  if (!ACTOR_ID) {
    console.log('REFUSED: --actor=<profile-id> is required so the transition is attributable.');
    await prisma.$disconnect();
    process.exit(2);
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: ACTOR_ID },
    select: { id: true, full_name: true, role: true },
  });
  if (!profile) {
    console.log(`REFUSED: --actor=${ACTOR_ID} does not match any profile.`);
    await prisma.$disconnect();
    process.exit(2);
  }
  const actor: Actor = { id: profile.id, role: 'super_admin' };
  console.log(`actor: ${profile.full_name} (${profile.role})\n`);

  for (const ref of REFS) {
    const row = await prisma.content_items.findFirst({
      where: { editorial_ref: ref, deleted_at: null },
      select: { id: true, status: true, current_revision_number: true },
    });

    if (!row) {
      console.log(`${ref}: NOT FOUND`);
      continue;
    }
    if (row.status !== 'draft') {
      console.log(`${ref}: already "${row.status}" — nothing to do`);
      continue;
    }
    if (!APPLY) {
      console.log(`${ref}: would submit  draft → in_review  (id=${row.id})`);
      continue;
    }

    await transitionContent(row.id, 'submit', actor);

    const after = await prisma.content_items.findUniqueOrThrow({
      where: { id: row.id },
      select: { status: true, current_revision_number: true },
    });
    const revisions = await prisma.content_revisions.count({ where: { content_id: row.id } });
    // `audit_logs` has no entity column — the subject lives in `details`, so match on that.
    const audits = await prisma.audit_logs.count({
      where: { action: { contains: 'content' }, details: { path: ['contentId'], equals: row.id } },
    });

    console.log(
      `${ref}: ${after.status}  revisions=${revisions} (was ${row.current_revision_number}) audit_transitions=${audits}`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('submit-week1 failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
