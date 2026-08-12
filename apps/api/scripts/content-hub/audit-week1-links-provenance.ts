/**
 * Where do the anchors on a published Week 1 page actually COME FROM? — READ ONLY.
 *
 * `audit-week1-links.ts` shows that some of the hrefs in `links[]` also appear in the HTML. That is
 * not evidence that `links[]` was rendered — the same href can arrive from the breadcrumbs, from a
 * CTA block inside the body, or from the related-resources cards.
 *
 * This isolates each contributor by rendering the same detail several times with one source removed
 * at a time and diffing the anchor list. Nothing is written to the database.
 *
 * Run:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/audit-week1-links-provenance.ts
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { resolvePublishedContent } from '../../src/modules/content-hub/content-hub.read.service';
import { renderResourceDetail } from '../../src/modules/render/renderResourceDetail';
import type { PublicDetail } from '../../src/modules/content-hub/content-hub.public.schema';

const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };
const REFS = ['W1-A001', 'W1-G001', 'W1-B001'];

const render = (detail: PublicDetail) =>
  renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });

function pageAnchors(html: string): string[] {
  const start = html.indexOf('<div class="sol-page">');
  const end = html.indexOf('<footer class="sol-site-footer">');
  if (start === -1) return [];
  const region = html.slice(start, end === -1 ? undefined : end);
  return Array.from(region.matchAll(/<a\b[^>]*href="([^"]*)"/g)).map((m) => m[1]);
}

/** Block types present in the body, so a CTA block can be told apart from prose. */
function blockSummary(body: unknown) {
  const blocks = ((body as { blocks?: Array<{ type?: string; id?: string }> })?.blocks ?? []);
  const counts = new Map<string, number>();
  for (const block of blocks) counts.set(block.type ?? '?', (counts.get(block.type ?? '?') ?? 0) + 1);
  return [...counts.entries()].map(([type, n]) => `${type}×${n}`).join(', ');
}

/** Blocks that can emit an anchor of their own. */
function linkBearingBlocks(body: unknown) {
  const blocks = ((body as { blocks?: Array<Record<string, unknown>> })?.blocks ?? []);
  return blocks
    .filter((block) => 'target' in block || block.type === 'cta' || block.type === 'related_content')
    .map((block) => ({
      id: block.id,
      type: block.type,
      target: block.target,
      label: block.label ?? block.text ?? null,
    }));
}

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
    select: { editorial_ref: true, slug: true },
  });
  const slugByRef = new Map(rows.map((r) => [r.editorial_ref as string, r.slug]));

  for (const ref of REFS) {
    const slug = slugByRef.get(ref);
    if (!slug) continue;
    const detail = await resolvePublishedContent(slug);
    if (!detail) {
      console.log(`\n${ref}: not publicly resolvable`);
      continue;
    }

    const full = render(detail);
    const baseline = pageAnchors(full);

    // One contributor removed at a time.
    const withoutLinks = pageAnchors(render({ ...detail, links: [] }));
    const withoutRelated = pageAnchors(render({ ...detail, related: [] }));
    const withoutBody = pageAnchors(render({ ...detail, body: { version: 1, blocks: [] } }));

    const missing = (variant: string[]) => baseline.filter((href) => !variant.includes(href));

    console.log(`\n═══ ${ref} (/resources/${slug}) ═══`);
    console.log(`  body blocks: ${blockSummary(detail.body)}`);
    console.log(`  link-bearing blocks: ${JSON.stringify(linkBearingBlocks(detail.body))}`);
    console.log(`  serializer links[]: ${detail.links.length}   related[]: ${detail.related.length}`);
    console.log(`  anchors rendered: ${baseline.length}`);
    console.log(`  ── removing links[]   changes the HTML? ${full === render({ ...detail, links: [] }) ? 'NO — links[] contributes NOTHING' : 'yes'}`);
    console.log(`     anchors lost: ${JSON.stringify(missing(withoutLinks))}`);
    console.log(`  ── removing related[] anchors lost: ${JSON.stringify(missing(withoutRelated))}`);
    console.log(`  ── removing body      anchors lost: ${JSON.stringify(missing(withoutBody))}`);

    // Which of the workbook's link destinations survive anywhere on the page, and via which route.
    for (const link of detail.links) {
      const viaRelated = !withoutRelated.includes(link.href) && baseline.includes(link.href);
      const viaBody = !withoutBody.includes(link.href) && baseline.includes(link.href);
      const present = baseline.includes(link.href);
      const source = !present
        ? 'ABSENT FROM PAGE'
        : viaRelated
          ? 'related-cards (not links[])'
          : viaBody
            ? 'a body block (not links[])'
            : 'breadcrumbs (not links[])';
      console.log(`     ${link.relation.padEnd(16)} ${link.href.padEnd(60)} ${source}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
