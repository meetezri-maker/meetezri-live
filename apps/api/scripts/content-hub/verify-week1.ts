/**
 * Week 1 post-import verification — READ ONLY.
 *
 * Reads the three records back FROM THE DATABASE rather than trusting the importer's in-memory
 * objects, then runs the real server checklist and the real serializer-backed preview. Nothing
 * here writes, approves or publishes.
 *
 * Run:
 *   npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/verify-week1.ts
 */

import 'dotenv/config';
import { ROUTE_REGISTRY, PUBLIC_CONTENT_LABEL, validateContentBody, type ContentType } from '@meetezri/shared';
import prisma from '../../src/lib/prisma';
import { evaluateChecklist } from '../../src/modules/content-hub/content-hub.publish.service';
import { resolvePreviewContent, resolvePublishedContent, resolvePublishedList } from '../../src/modules/content-hub/content-hub.read.service';
import { EXPECTED_CONTENT_EDGES, WEEK1_ASSETS } from '../../src/modules/content-hub/week1/week1-content';

const REFS = ['W1-A001', 'W1-G001', 'W1-B001'];
const EXPECTED_LINK_COUNTS: Record<string, number> = { 'W1-A001': 4, 'W1-G001': 4, 'W1-B001': 5 };

function ok(pass: boolean) {
  return pass ? 'PASS' : 'FAIL';
}

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { editorial_ref: { in: REFS }, deleted_at: null },
    orderBy: { editorial_ref: 'asc' },
  });

  console.log('═══ 1. RECORD COUNT ═══');
  console.log(`  expected 3, found ${rows.length}  ${ok(rows.length === 3)}`);

  const byRef = new Map(rows.map((r) => [r.editorial_ref!, r]));
  const idToRef = new Map(rows.map((r) => [r.id, r.editorial_ref!]));

  console.log('\n═══ 2. PER-RECORD STRUCTURE ═══');
  for (const asset of WEEK1_ASSETS) {
    const row = byRef.get(asset.editorialRef);
    if (!row) {
      console.log(`  ${asset.editorialRef}: MISSING`);
      continue;
    }

    const body = row.body as { blocks?: Array<{ id: string; type: string; items?: unknown[] }> } | null;
    const blocks = body?.blocks ?? [];
    const ids = blocks.map((b) => b.id);
    const faq = blocks.find((b) => b.type === 'faq');
    const faqCount = (faq?.items as unknown[] | undefined)?.length ?? 0;
    const safety = blocks.filter((b) => b.type === 'safety_notice').length;
    const directAnswerFirst = blocks[0]?.type === 'direct_answer';

    const bodyCheck = validateContentBody(row.body, {
      contentType: row.content_type as ContentType,
      forPublish: true,
    });

    console.log(`\n  ${asset.editorialRef}  id=${row.id}`);
    console.log(`    content_type   ${row.content_type.padEnd(14)} ${ok(row.content_type === asset.contentType)}`);
    console.log(`    public label   ${PUBLIC_CONTENT_LABEL[row.content_type as ContentType].padEnd(14)} ${ok(PUBLIC_CONTENT_LABEL[row.content_type as ContentType] === asset.publicLabel)}`);
    console.log(`    title          ${ok(row.title === asset.title)}`);
    console.log(`    slug           ${row.slug.padEnd(52)} ${ok(row.slug === asset.slug)}`);
    console.log(`    week / pillar  ${row.week} / ${row.pillar}  ${ok(row.week === 1 && row.pillar === asset.pillar)}`);
    console.log(`    status         ${String(row.status).padEnd(14)} ${ok(row.status === 'draft')}`);
    console.log(`    approvals      founder=${row.founder_approval} marketing=${row.marketing_approval} seo=${row.seo_approval}  ${ok(row.founder_approval === 'pending' && row.marketing_approval === 'pending' && row.seo_approval === 'pending')}`);
    console.log(`    author         ${row.author_id ?? '(unresolved)'}`);
    console.log(`    reviewer       ${row.reviewer_id ?? '(none)'}`);
    console.log(`    meta desc      ${row.meta_description ? `${row.meta_description.length} chars` : '(NULL — gap)'}`);
    console.log(`    blocks         ${String(blocks.length).padEnd(14)} ${ok(blocks.length === asset.body.blocks.length)}`);
    console.log(`    unique ids     ${ok(new Set(ids).size === ids.length)}`);
    console.log(`    faq items      ${String(faqCount).padEnd(14)} ${ok(faqCount === ((asset.body.blocks.find((b) => b.type === 'faq') as { items?: unknown[] })?.items?.length ?? 0))}`);
    console.log(`    safety notices ${String(safety).padEnd(14)} ${ok(safety === 1)}`);
    if (row.content_type === 'aeo_answer') {
      console.log(`    direct answer first          ${ok(directAnswerFirst)}`);
    }
    console.log(`    word count     ${row.word_count} (reading ${row.reading_time_minutes} min)`);
    console.log(`    body validates ${ok(bodyCheck.errors.length === 0)}${bodyCheck.errors.length ? ` — ${bodyCheck.errors[0].message}` : ''}`);
  }

  console.log('\n═══ 3. LINKS ═══');
  let contentEdges: Array<[string, string]> = [];
  for (const ref of REFS) {
    const row = byRef.get(ref)!;
    const links = await prisma.content_links.findMany({
      where: { source_id: row.id },
      orderBy: { sort_order: 'asc' },
    });
    console.log(`\n  ${ref}: ${links.length} link(s)  ${ok(links.length === EXPECTED_LINK_COUNTS[ref])}`);
    for (const link of links) {
      if (link.target_kind === 'content') {
        const targetRef = idToRef.get(link.target_content_id!) ?? '(external)';
        contentEdges.push([ref, targetRef]);
        console.log(`      content  -> ${targetRef.padEnd(10)} anchor=${link.anchor_text ?? '(null)'}  relation=${link.relation}`);
      } else {
        const entry = ROUTE_REGISTRY[link.target_route as keyof typeof ROUTE_REGISTRY];
        console.log(`      route    -> ${String(link.target_route).padEnd(22)} ${entry ? entry.href : 'UNMAPPED'}  anchor=${link.anchor_text ?? '(null)'}  ${ok(!!entry)}`);
      }
    }
  }

  console.log('\n  content→content edges:');
  const actual = new Set(contentEdges.map(([a, b]) => `${a}→${b}`));
  const expected = new Set(EXPECTED_CONTENT_EDGES.map(([a, b]) => `${a}→${b}`));
  console.log(`    expected 5, found ${actual.size}  ${ok(actual.size === 5)}`);
  for (const edge of expected) console.log(`    ${edge}  ${ok(actual.has(edge))}`);
  for (const edge of actual) if (!expected.has(edge)) console.log(`    UNEXPECTED ${edge}`);

  console.log('\n═══ 4. PUBLISH CHECKLIST (real service) ═══');
  const matrix = new Map<string, Map<string, { passed: boolean; blocking: boolean; details?: string }>>();
  for (const ref of REFS) {
    const row = byRef.get(ref)!;
    const result = await evaluateChecklist(prisma as never, row.id);
    const perItem = new Map<string, { passed: boolean; blocking: boolean; details?: string }>();
    for (const item of result.items) {
      perItem.set(item.code, { passed: item.passed, blocking: item.blocking, details: item.details });
    }
    matrix.set(ref, perItem);
    console.log(`  ${ref}: passed=${result.passed}`);
  }

  const allCodes = [...new Set([...matrix.values()].flatMap((m) => [...m.keys()]))];
  console.log(`\n  ${'check'.padEnd(22)} ${'blk'.padEnd(4)} ${'A001'.padEnd(8)} ${'G001'.padEnd(8)} B001`);
  for (const code of allCodes) {
    const cells = REFS.map((ref) => {
      const cell = matrix.get(ref)!.get(code);
      return (cell ? (cell.passed ? 'PASS' : 'FAIL') : 'n/a').padEnd(8);
    });
    const blocking = REFS.map((r) => matrix.get(r)!.get(code)).find((c) => c)?.blocking;
    console.log(`  ${code.padEnd(22)} ${(blocking ? 'yes' : 'no').padEnd(4)} ${cells.join('')}`);
  }

  console.log('\n  blocking failures:');
  for (const ref of REFS) {
    for (const [code, cell] of matrix.get(ref)!) {
      if (cell.blocking && !cell.passed) console.log(`    ${ref}  ${code}: ${cell.details ?? ''}`);
    }
  }
  console.log('\n  warnings:');
  for (const ref of REFS) {
    for (const [code, cell] of matrix.get(ref)!) {
      if (!cell.blocking && !cell.passed) console.log(`    ${ref}  ${code}: ${cell.details ?? ''}`);
    }
  }

  console.log('\n═══ 5. PUBLIC DISCLOSURE WHILE DRAFT ═══');
  for (const asset of WEEK1_ASSETS) {
    const publicDetail = await resolvePublishedContent(asset.slug);
    console.log(`  /resources/${asset.slug.padEnd(52)} public read: ${publicDetail ? 'VISIBLE (FAIL)' : 'null → 404  PASS'}`);
  }
  const list = await resolvePublishedList({ page: 1, pageSize: 24 });
  const leaked = list.items.filter((item) => WEEK1_ASSETS.some((a) => a.slug === item.slug));
  console.log(`  absent from /resources index: ${ok(leaked.length === 0)} (${list.total} published item(s) total)`);

  console.log('\n═══ 6. ADMIN PREVIEW (serializer-backed) ═══');
  for (const ref of REFS) {
    const row = byRef.get(ref)!;
    const preview = await resolvePreviewContent(row.id);
    if (!preview) {
      console.log(`  ${ref}: preview FAILED`);
      continue;
    }
    const serialised = JSON.stringify(preview);
    const faqBlock = preview.body.blocks.find((b) => b.type === 'faq') as { items?: unknown[] } | undefined;
    const cta = preview.body.blocks.find((b) => b.type === 'cta') as { href?: string } | undefined;
    const safety = preview.body.blocks.filter((b) => b.type === 'safety_notice').length;

    console.log(`\n  ${ref}`);
    console.log(`    label            ${preview.label}`);
    console.log(`    title            ${preview.title}`);
    console.log(`    robots           ${preview.robots}  ${ok(preview.robots === 'noindex,nofollow')}`);
    console.log(`    faq items        ${faqBlock?.items?.length ?? 0}`);
    console.log(`    safety notices   ${safety}  ${ok(safety === 1)}`);
    console.log(`    cta href         ${cta?.href ?? '(none)'}`);
    console.log(`    related          ${preview.related.length}`);
    console.log(`    links            ${preview.links.length}`);
    for (const leak of ['editorial', 'editorial_ref', 'editorialRef', 'coreMessage', 'citationGoal', 'founder_approval', 'approvals', 'scheduled_for', 'kpi']) {
      if (serialised.includes(leak)) console.log(`    LEAK: "${leak}" present in preview payload`);
    }
    for (const term of ['aeo_answer', 'geo_article', 'seo_blog']) {
      if (serialised.includes(term)) console.log(`    LEAK: internal type "${term}" present`);
    }
    console.log(`    disclosure       ${ok(!['editorial_ref', 'coreMessage', 'citationGoal', 'aeo_answer', 'geo_article', 'seo_blog'].some((s) => serialised.includes(s)))}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('verify-week1 failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
