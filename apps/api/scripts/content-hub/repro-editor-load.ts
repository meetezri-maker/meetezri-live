/**
 * Reproduce the "Could not load content" editor failure. READ ONLY.
 *
 * Runs the exact boundary the admin editor hits:
 *
 *   getContent(id)  →  adminContentDetailSchema  (Fastify validates the RESPONSE)
 *
 * Fastify validates responses against the Zod schema, so a serializer/schema mismatch surfaces as
 * a 500 rather than as bad data. Running the service and the schema together here reproduces that
 * without needing a browser session.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { getContent } from '../../src/modules/content-hub/content-hub.service';
import { adminContentDetailSchema } from '../../src/modules/content-hub/content-hub.schema';

const WEEK1 = [
  ['W1-A001', '26ee725d-d6e3-44b9-9093-ab70084d925b'],
  ['W1-G001', '4085de42-9b76-4b42-b73d-4cdfaf0b3b3e'],
  ['W1-B001', '7d95e2a0-a480-48a2-99ac-3aad2b0946ef'],
] as const;

async function probe(label: string, id: string) {
  console.log(`\n─── ${label}  ${id} ───`);
  let detail: unknown;

  try {
    detail = await getContent(id);
  } catch (error) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    console.log(`  SERVICE THREW: status=${err.statusCode ?? '?'} code=${err.code ?? '?'} ${err.message ?? error}`);
    return;
  }

  console.log('  service: OK');

  const parsed = adminContentDetailSchema.safeParse(detail);
  if (parsed.success) {
    console.log('  response schema: OK');
    const size = JSON.stringify(detail).length;
    console.log(`  payload size: ${(size / 1024).toFixed(1)} KB`);
    return;
  }

  console.log(`  RESPONSE SCHEMA REJECTED — ${parsed.error.issues.length} issue(s):`);
  for (const issue of parsed.error.issues.slice(0, 12)) {
    console.log(`    path=${issue.path.join('.') || '(root)'}  code=${issue.code}  ${issue.message}`);
  }
}

async function main() {
  for (const [label, id] of WEEK1) await probe(label, id);

  // The unrelated pre-existing draft noted in the Phase 5B preflight — the control case.
  const other = await prisma.content_items.findFirst({
    where: { editorial_ref: null, deleted_at: null },
    select: { id: true, title: true, status: true, content_type: true },
  });
  if (other) {
    console.log(`\n=== CONTROL: pre-existing record "${other.title}" (${other.content_type}, ${other.status}) ===`);
    await probe('control', other.id);
  } else {
    console.log('\n=== CONTROL: no pre-existing non-Week-1 record found ===');
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
