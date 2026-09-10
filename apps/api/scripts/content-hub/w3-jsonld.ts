/**
 * Week 3 JSON-LD + rendered-anchor check — READ ONLY.
 *
 * Renders each Week 3 draft through the REAL public renderer (via the preview seam, which uses the
 * same serializer and the same components the published page will) and reports which schema
 * documents are emitted and which anchors actually appear in the page region.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { resolvePreviewContent } from '../../src/modules/content-hub/content-hub.read.service';
import { renderResourceDetail } from '../../src/modules/render/renderResourceDetail';

const REFS = ['W3-B001', 'W3-G001', 'W3-A001'];
const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

function jsonLdTypes(html: string): string[] {
  const types: string[] = [];
  for (const match of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    try {
      const doc = JSON.parse(match[1]);
      const walk = (node: unknown, depth = 0): void => {
        if (depth > 3 || !node || typeof node !== 'object') return;
        const t = (node as { '@type'?: unknown })['@type'];
        if (typeof t === 'string') types.push(t);
        for (const value of Object.values(node as Record<string, unknown>)) {
          if (Array.isArray(value)) value.forEach((v) => walk(v, depth + 1));
          else if (value && typeof value === 'object') walk(value, depth + 1);
        }
      };
      walk(doc);
    } catch {
      types.push('(unparseable)');
    }
  }
  return types;
}

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

    const html = renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });
    const types = jsonLdTypes(html);
    const counts = new Map<string, number>();
    for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);

    console.log(`\n═══ ${ref} (/resources/${row.slug}) ═══`);
    console.log(`  JSON-LD types : ${[...counts.entries()].map(([t, n]) => `${t}×${n}`).join(', ')}`);
    console.log(`  canonical      : ${/rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? '(none)'}`);
    console.log(`  robots         : ${/name="robots" content="([^"]*)"/.exec(html)?.[1] ?? '(none)'}`);

    const anchors = pageAnchors(html);
    const internal = anchors.filter((h) => !h.startsWith('#'));
    console.log(`  anchors (non-fragment): ${internal.join(', ')}`);
    console.log(`  duplicate FAQPage? ${(counts.get('FAQPage') ?? 0) > 1 ? 'YES — PROBLEM' : 'no'}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
