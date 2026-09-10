/**
 * `key_statements` audit — READ ONLY.
 *
 * Shows, for every GEO article in production, what `type_fields` actually holds, whether the
 * publish checklist's three required GEO fields are present, and how many `geo_statement` BODY
 * blocks the item carries — so the two can be told apart at a glance.
 *
 * Nothing here writes.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { evaluateChecklist } from '../../src/modules/content-hub/content-hub.publish.service';
import { resolvePreviewContent } from '../../src/modules/content-hub/content-hub.read.service';

async function main() {
  const rows = await prisma.content_items.findMany({
    where: { content_type: 'geo_article', deleted_at: null },
    select: {
      id: true,
      editorial_ref: true,
      slug: true,
      status: true,
      type_fields: true,
      body: true,
    },
    orderBy: { editorial_ref: 'asc' },
  });

  console.log('═══ GEO ARTICLES IN PRODUCTION ═══\n');

  for (const row of rows) {
    const tf = (row.type_fields ?? {}) as Record<string, unknown>;
    const blocks = ((row.body as { blocks?: Array<{ type?: string }> })?.blocks ?? []);
    const geoStatementBlocks = blocks.filter((b) => b.type === 'geo_statement').length;

    console.log(`── ${row.editorial_ref} (${row.status}) ──`);
    console.log(`   type_fields keys        : ${Object.keys(tf).join(', ') || '(none)'}`);
    console.log(`   core_concept            : ${tf.core_concept ? 'set' : 'MISSING'}`);
    console.log(`   citation_summary        : ${tf.citation_summary ? 'set' : 'MISSING'}`);
    console.log(
      `   key_statements          : ${
        Array.isArray(tf.key_statements)
          ? `${(tf.key_statements as unknown[]).length} item(s)`
          : 'MISSING'
      }`,
    );
    console.log(`   geo_statement BODY blocks: ${geoStatementBlocks}`);

    const checklist = await evaluateChecklist(prisma, row.id);
    const typeItem = checklist.items.find((i: { code: string }) => i.code === 'type_fields');
    console.log(`   checklist "type_fields"  : ${typeItem?.passed ? 'PASS' : `FAIL — ${typeItem?.details ?? ''}`}`);

    // What the public payload would expose.
    const preview = await resolvePreviewContent(row.id);
    const exposed = preview ? Object.keys(preview.typeFields ?? {}) : [];
    console.log(`   public typeFields keys   : ${exposed.join(', ') || '(none)'}`);
    console.log();
  }

  console.log('═══ RELATIONSHIP ═══');
  console.log('  `geo_statement` blocks live in body.blocks and are rendered as prose.');
  console.log('  `key_statements` lives in the type_fields column and is rendered by KeyStatements.');
  console.log('  Neither one populates the other — a grep of the repo finds no code path that');
  console.log('  derives key_statements from geo_statement blocks or vice versa.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
