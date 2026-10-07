/**
 * Month 2 Week 4 — READ-ONLY precedent audit.
 *
 * Shows how every PUBLISHED GEO article actually populated `core_concept`, `citation_summary` and
 * `key_statements`, and what a real safety_notice block looks like in published copy. Week 4's
 * mapping decisions are then argued against shipped precedent rather than against intent.
 *
 * Nothing here writes.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

type Block = { type?: string; content?: unknown; heading?: string; items?: unknown[] };

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (value && typeof value === 'object') {
    const span = value as { text?: unknown; spans?: unknown };
    if (span.spans !== undefined) return textOf(span.spans);
    if (typeof span.text === 'string') return span.text;
  }
  return '';
}

async function main() {
  console.log('='.repeat(78));
  console.log('  GEO type_fields precedent (published geo_article rows)');
  console.log('='.repeat(78));
  const geo = await prisma.content_items.findMany({
    where: { content_type: 'geo_article', deleted_at: null },
    select: { editorial_ref: true, status: true, type_fields: true },
    orderBy: { editorial_ref: 'asc' },
  });
  for (const row of geo) {
    const tf = (row.type_fields ?? {}) as Record<string, unknown>;
    const ks = tf.key_statements;
    console.log(`\n  ${row.editorial_ref} (${row.status})`);
    console.log(`     core_concept     : ${JSON.stringify(tf.core_concept)}`);
    console.log(`     citation_summary : ${typeof tf.citation_summary === 'string' ? `${(tf.citation_summary as string).length} chars — ${(tf.citation_summary as string).slice(0, 110)}…` : JSON.stringify(tf.citation_summary)}`);
    console.log(`     key_statements   : ${Array.isArray(ks) ? `${ks.length} item(s)` : JSON.stringify(ks)}`);
    if (Array.isArray(ks)) for (const s of ks) console.log(`        - ${String(s).slice(0, 110)}`);
  }

  console.log('\n' + '='.repeat(78));
  console.log('  safety_notice blocks in PUBLISHED content — what the block is actually used for');
  console.log('='.repeat(78));
  const all = await prisma.content_items.findMany({
    where: { status: 'published', deleted_at: null },
    select: { editorial_ref: true, content_type: true, body: true },
    orderBy: { editorial_ref: 'asc' },
  });
  for (const row of all) {
    const blocks = ((row.body as { blocks?: Block[] } | null)?.blocks ?? []);
    const notices = blocks.filter((b) => b.type === 'safety_notice');
    if (notices.length === 0) continue;
    console.log(`\n  ${row.editorial_ref} (${row.content_type}) — ${notices.length} safety_notice block(s)`);
    for (const n of notices) console.log(`     ${JSON.stringify(n).slice(0, 420)}`);
  }

  console.log('\n' + '='.repeat(78));
  console.log('  Block-type usage across published content (what the palette is really used for)');
  console.log('='.repeat(78));
  const counts = new Map<string, number>();
  const perRef = new Map<string, Set<string>>();
  for (const row of all) {
    const blocks = ((row.body as { blocks?: Block[] } | null)?.blocks ?? []);
    const seen = new Set<string>();
    for (const b of blocks) {
      const t = b.type ?? '?';
      counts.set(t, (counts.get(t) ?? 0) + 1);
      seen.add(t);
    }
    perRef.set(row.editorial_ref ?? '?', seen);
  }
  for (const [type, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const refs = [...perRef].filter(([, s]) => s.has(type)).map(([r]) => r);
    console.log(`  ${type.padEnd(16)} ${String(n).padStart(5)}  in ${refs.length} asset(s)`);
  }

  console.log('\n' + '='.repeat(78));
  console.log('  table / key_takeaway / quote / geo_statement — are they ever used?');
  console.log('='.repeat(78));
  for (const probe of ['table', 'key_takeaway', 'quote', 'geo_statement', 'related_content', 'source', 'divider']) {
    const users = [...perRef].filter(([, s]) => s.has(probe)).map(([r]) => r);
    console.log(`  ${probe.padEnd(16)} ${users.length ? users.join(', ') : 'NEVER USED in published content'}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
