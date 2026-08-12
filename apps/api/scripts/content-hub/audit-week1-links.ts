/**
 * Week 1 internal-link audit — READ ONLY.
 *
 * Traces every link the workbook requires through all five stages and reports where it stops:
 *
 *   workbook spec → content_links row → public serializer → SSR payload → rendered HTML
 *
 * Nothing here writes, approves, publishes or changes a slug. The only Prisma calls are the ones
 * inside `content-hub.read.service.ts` plus one `findMany` over `content_links`, both reads.
 *
 * Run:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/audit-week1-links.ts
 */

import 'dotenv/config';
import { resolveRouteHref } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';
import { resolvePublishedContent } from '../../src/modules/content-hub/content-hub.read.service';
import { renderResourceDetail } from '../../src/modules/render/renderResourceDetail';
import { WEEK1_ASSETS } from '../../src/modules/content-hub/week1/week1-content';

const ORIGIN = 'https://meetezri.com';
const NO_ASSETS = { scripts: [], styles: [] };

/** Every `href="…"` in the document, in order. */
function anchors(html: string): string[] {
  return Array.from(html.matchAll(/<a\b[^>]*href="([^"]*)"/g)).map((m) => m[1]);
}

/** The article only — the site shell's own nav and footer links are not article links. */
function articleAnchors(html: string): string[] {
  const start = html.indexOf('<article');
  const end = html.indexOf('</article>');
  if (start === -1 || end === -1) return [];
  return anchors(html.slice(start, end));
}

/** Anchors anywhere inside #root but outside <header>/<footer> — catches Related/Breadcrumbs. */
function pageAnchors(html: string): string[] {
  const start = html.indexOf('<div class="sol-page">');
  const end = html.indexOf('<footer class="sol-site-footer">');
  if (start === -1) return [];
  return anchors(html.slice(start, end === -1 ? undefined : end));
}

/** Inline link marks carried by body spans, i.e. real in-prose anchors. */
function inlineLinkSpans(body: unknown): Array<{ blockId: string; text: string; href: string }> {
  const found: Array<{ blockId: string; text: string; href: string }> = [];
  const blocks = (body as { blocks?: unknown[] })?.blocks ?? [];

  const walk = (node: unknown, blockId: string) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, blockId);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const span = node as { text?: unknown; link?: unknown };
    if (typeof span.text === 'string' && span.link) {
      found.push({ blockId, text: span.text, href: JSON.stringify(span.link) });
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === 'object') walk(value, blockId);
    }
  };

  for (const block of blocks as Array<{ id?: string }>) walk(block, block?.id ?? '?');
  return found;
}

async function main() {
  const refs = WEEK1_ASSETS.map((asset) => asset.editorialRef);

  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: refs }, deleted_at: null },
    select: { id: true, editorial_ref: true, slug: true, title: true, status: true },
  });

  const byRef = new Map(rows.map((row) => [row.editorial_ref as string, row]));
  const idToRef = new Map(rows.map((row) => [row.id, row.editorial_ref as string]));

  console.log('═══ 1. RECORDS ═══');
  for (const ref of refs) {
    const row = byRef.get(ref);
    console.log(row ? `  ${ref}  ${row.status.padEnd(10)}  /resources/${row.slug}` : `  ${ref}  MISSING`);
  }

  console.log('\n═══ 2. WORKBOOK SPEC vs content_links ROWS ═══');
  for (const asset of WEEK1_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    if (!row) continue;

    const dbLinks = await prisma.content_links.findMany({
      where: { source_id: row.id },
      orderBy: { sort_order: 'asc' },
      select: {
        target_kind: true,
        target_content_id: true,
        target_route: true,
        anchor_text: true,
        relation: true,
        sort_order: true,
      },
    });

    console.log(`\n  ${asset.editorialRef} — workbook requires ${asset.links.length}, database has ${dbLinks.length}`);

    for (const spec of asset.links) {
      const match = dbLinks.find((link) =>
        spec.targetKind === 'content'
          ? link.target_kind === 'content' && idToRef.get(link.target_content_id ?? '') === spec.targetRef
          : link.target_kind === 'route' && link.target_route === spec.targetRoute,
      );
      const want = spec.targetKind === 'content' ? `content→${spec.targetRef}` : `route→${spec.targetRoute}`;
      console.log(
        `    ${match ? 'IN DB    ' : 'MISSING  '} ${want.padEnd(28)} relation=${spec.relation.padEnd(16)}` +
          (match ? ` dbRelation=${match.relation} anchor=${JSON.stringify(match.anchor_text)}` : ''),
      );
    }

    // Anything in the database the workbook does not ask for.
    for (const link of dbLinks) {
      const known = asset.links.some((spec) =>
        spec.targetKind === 'content'
          ? link.target_kind === 'content' && idToRef.get(link.target_content_id ?? '') === spec.targetRef
          : link.target_kind === 'route' && link.target_route === spec.targetRoute,
      );
      if (!known) {
        console.log(`    EXTRA     ${link.target_kind}→${link.target_route ?? idToRef.get(link.target_content_id ?? '') ?? link.target_content_id}`);
      }
    }
  }

  console.log('\n═══ 3. PUBLIC SERIALIZER (what /api/content/:slug returns) ═══');
  const details = new Map<string, Awaited<ReturnType<typeof resolvePublishedContent>>>();

  for (const ref of refs) {
    const row = byRef.get(ref);
    if (!row) continue;
    const detail = await resolvePublishedContent(row.slug);
    details.set(ref, detail);

    if (!detail) {
      console.log(`\n  ${ref}  NOT RESOLVABLE PUBLICLY (not published, or deleted)`);
      continue;
    }

    console.log(`\n  ${ref}  links[]=${detail.links.length}  related[]=${detail.related.length}`);
    for (const link of detail.links) {
      console.log(`    link     ${link.relation.padEnd(16)} ${link.href.padEnd(34)} "${link.label}"`);
    }
    for (const card of detail.related) {
      console.log(`    related  ${'—'.padEnd(16)} /resources/${card.slug}`);
    }

    const inline = inlineLinkSpans(detail.body);
    console.log(`    inline anchors inside body prose: ${inline.length}`);
    for (const span of inline) console.log(`      ${span.blockId}: "${span.text}" → ${span.href}`);
  }

  console.log('\n═══ 4. SSR PAYLOAD → RENDERED HTML ═══');
  for (const ref of refs) {
    const detail = details.get(ref);
    if (!detail) continue;

    const html = renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });
    const inArticle = articleAnchors(html);
    const inPage = pageAnchors(html);

    console.log(`\n  ${ref}`);
    console.log(`    anchors inside <article>: ${inArticle.length}${inArticle.length ? ' → ' + inArticle.join(', ') : ''}`);
    console.log(`    anchors inside .sol-page (article + breadcrumbs + related): ${inPage.length}`);
    for (const href of inPage) console.log(`      ${href}`);

    // Does every serialized link actually appear somewhere in the page region?
    for (const link of detail.links) {
      const rendered = inPage.includes(link.href);
      console.log(`    ${rendered ? 'RENDERED ' : 'DROPPED  '} ${link.href}  "${link.label}"`);
    }
  }

  console.log('\n═══ 5. CONTENT-TO-CONTENT MATRIX (rendered HTML only) ═══');
  for (const ref of refs) {
    const detail = details.get(ref);
    if (!detail) continue;
    const html = renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });
    const hrefs = pageAnchors(html);

    for (const other of refs) {
      if (other === ref) continue;
      const target = byRef.get(other);
      if (!target) continue;
      const href = `/resources/${target.slug}`;
      console.log(`  ${ref} → ${other}  ${hrefs.includes(href) ? 'VISIBLE' : 'not rendered'}   (${href})`);
    }
  }

  console.log('\n═══ 6. ROUTE LINKS (rendered HTML only) ═══');
  const ROUTES = ['product.talk_it_out', 'resource_library', 'pricing'] as const;
  for (const ref of refs) {
    const detail = details.get(ref);
    if (!detail) continue;
    const html = renderResourceDetail({ origin: ORIGIN, detail, assets: NO_ASSETS });
    const hrefs = pageAnchors(html);

    for (const key of ROUTES) {
      const href = resolveRouteHref(key);
      if (!href) continue;
      const required = WEEK1_ASSETS.find((a) => a.editorialRef === ref)?.links.some((l) => l.targetRoute === key);
      if (!required) continue;
      console.log(`  ${ref} → ${key.padEnd(20)} ${href.padEnd(16)} ${hrefs.includes(href) ? 'VISIBLE' : 'not rendered'}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
