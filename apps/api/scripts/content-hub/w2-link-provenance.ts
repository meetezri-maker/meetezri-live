/**
 * Week 2 link rendering paths — READ ONLY.
 *
 * The verifier shows that one of the three intended links reaches the rendered HTML. That is not
 * evidence that `links[]` was rendered: the same href can arrive from the CTA block in the body,
 * from the breadcrumbs, or from the related-resources cards.
 *
 * This isolates each contributor by rendering the same preview payload with one source removed at
 * a time, exactly as the Week 1 audit did. Nothing is written.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { resolvePreviewContent } from '../../src/modules/content-hub/content-hub.read.service';
import { renderResourceDetail } from '../../src/modules/render/renderResourceDetail';
import type { PublicDetail } from '../../src/modules/content-hub/content-hub.public.schema';

const REFS = ['W2-B001', 'W2-G001', 'W2-A001'];
const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

const render = (detail: PublicDetail) =>
  renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });

function pageAnchors(html: string): string[] {
  const start = html.indexOf('<div class="sol-page">');
  const end = html.indexOf('<footer class="sol-site-footer">');
  if (start === -1) return [];
  const region = html.slice(start, end === -1 ? undefined : end);
  return Array.from(region.matchAll(/<a\b[^>]*href="([^"]*)"/g)).map((m) => m[1]);
}

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
    select: { id: true, editorial_ref: true, slug: true },
  });

  for (const ref of REFS) {
    const row = rows.find((r) => r.editorial_ref === ref);
    if (!row) continue;
    const detail = await resolvePreviewContent(row.id);
    if (!detail) {
      console.log(`\n${ref}: no preview payload`);
      continue;
    }

    const full = render(detail);
    const baseline = pageAnchors(full);
    const withoutLinks = render({ ...detail, links: [] });
    const withoutRelated = pageAnchors(render({ ...detail, related: [] }));
    const withoutBody = pageAnchors(render({ ...detail, body: { version: 1, blocks: [] } }));

    const lost = (variant: string[]) => baseline.filter((href) => !variant.includes(href));

    console.log(`\n═══ ${ref} (/resources/${row.slug}) ═══`);
    console.log(`  serializer links[]: ${detail.links.length}   anchors rendered: ${baseline.length}`);
    console.log(
      `  removing links[] changes the HTML? ${full === withoutLinks ? 'NO — links[] contributes NOTHING' : 'yes'}`,
    );
    console.log(`  anchors lost without links[]  : ${JSON.stringify(lost(pageAnchors(withoutLinks)))}`);
    console.log(`  anchors lost without related[]: ${JSON.stringify(lost(withoutRelated))}`);
    console.log(`  anchors lost without the body : ${JSON.stringify(lost(withoutBody).slice(0, 6))}`);

    for (const link of detail.links) {
      const present = baseline.includes(link.href);
      const viaRelated = present && !withoutRelated.includes(link.href);
      const viaBody = present && !withoutBody.includes(link.href);
      const source = !present
        ? 'ABSENT FROM PAGE'
        : viaRelated
          ? 'related-cards (not links[])'
          : viaBody
            ? 'a body block (not links[])'
            : 'breadcrumbs (not links[])';
      console.log(`    ${link.relation.padEnd(16)} ${link.href.padEnd(46)} ${source}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
