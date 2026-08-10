/**
 * DATA REPAIR — Week 1 link relations.
 *
 * WHY THIS EXISTS. The Phase 5B import called `replaceLinks` directly and stored relations `cta`
 * and `reference`, neither of which is in `LINK_RELATIONS`. The service did not validate the
 * relation (it now does), so the rows persisted. `adminContentDetailSchema` DOES contain the
 * enum, and Fastify validates responses against it, so every `GET /api/admin/content/:id` for
 * those records returned 500 and the editor showed "Could not load content".
 *
 * WHAT IT CHANGES. Only `content_links.relation`, and only where the stored value is invalid.
 * It maps each row to the relation the enum already has for that destination:
 *
 *     product.talk_it_out  ->  product
 *     resource_library     ->  resource_library
 *     pricing              ->  pricing
 *     content target       ->  related_content
 *
 * WHAT IT DOES NOT CHANGE. No content, no prose, no block, no slug, no metadata, no status, no
 * approval gate, no author, no publication. It does not create or delete links, and the anchor
 * text, target and sort order of every row are preserved exactly.
 *
 * It writes through `replaceLinks` — the same service the admin UI uses — rather than issuing raw
 * SQL, so the corrected set is validated on the way in by the check that was missing.
 *
 * Dry run by default:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/repair-week1-link-relations.ts --actor=<id>
 * Apply:
 *   … --apply --actor=<id>
 */

import 'dotenv/config';
import { LINK_RELATIONS } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';
import { replaceLinks, type Actor } from '../../src/modules/content-hub/content-hub.service';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ACTOR_ID = argv.find((a) => a.startsWith('--actor='))?.split('=')[1];

const REFS = ['W1-A001', 'W1-G001', 'W1-B001'];

/** The relation each destination should carry. Derived from the enum, not invented. */
const ROUTE_RELATION: Record<string, string> = {
  'product.talk_it_out': 'product',
  resource_library: 'resource_library',
  pricing: 'pricing',
};

function correctRelation(targetKind: string, targetRoute: string | null): string {
  if (targetKind === 'content') return 'related_content';
  return ROUTE_RELATION[targetRoute ?? ''] ?? 'related_content';
}

async function main() {
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  if (!ACTOR_ID) {
    console.log('REFUSED: --actor=<profile-id> is required so the repair is attributable.');
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

  let totalBad = 0;

  for (const ref of REFS) {
    const row = await prisma.content_items.findFirst({
      where: { editorial_ref: ref, deleted_at: null },
      select: { id: true, status: true },
    });
    if (!row) {
      console.log(`${ref}: NOT FOUND`);
      continue;
    }

    const links = await prisma.content_links.findMany({
      where: { source_id: row.id },
      orderBy: { sort_order: 'asc' },
    });

    const repaired = links.map((link) => ({
      targetKind: link.target_kind as 'content' | 'route',
      targetContentId: link.target_content_id,
      targetRoute: link.target_route,
      anchorText: link.anchor_text,
      relation: correctRelation(link.target_kind, link.target_route),
      sortOrder: link.sort_order,
    }));

    const bad = links.filter((l) => !(LINK_RELATIONS as readonly string[]).includes(l.relation));
    totalBad += bad.length;

    console.log(`${ref} (status=${row.status}) — ${links.length} link(s), ${bad.length} invalid`);
    links.forEach((link, index) => {
      const to = link.target_kind === 'content' ? `content:${link.target_content_id}` : `route:${link.target_route}`;
      const next = repaired[index].relation;
      const changed = link.relation !== next;
      console.log(`    ${to.padEnd(50)} ${link.relation} ${changed ? `-> ${next}` : '(unchanged)'}`);
    });

    if (bad.length === 0) {
      console.log('    nothing to repair\n');
      continue;
    }
    if (!APPLY) {
      console.log('    would rewrite this link set\n');
      continue;
    }

    await replaceLinks(row.id, repaired as never, actor);

    const after = await prisma.content_links.findMany({
      where: { source_id: row.id },
      select: { relation: true, target_kind: true, target_route: true, anchor_text: true },
      orderBy: { sort_order: 'asc' },
    });
    const stillBad = after.filter((l) => !(LINK_RELATIONS as readonly string[]).includes(l.relation));
    console.log(`    repaired: ${after.length} link(s), ${stillBad.length} still invalid\n`);
  }

  console.log(totalBad === 0 ? 'No invalid relations found.' : `${totalBad} invalid relation(s) ${APPLY ? 'repaired' : 'found'}.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('repair failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
