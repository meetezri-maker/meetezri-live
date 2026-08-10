/**
 * Reproduce the editor save failure by REPLAYING A REAL PRODUCTION ROW THROUGH THE REAL SAVE PATH
 * ON A LOCAL DATABASE.
 *
 *   --dump    read the production row (READ ONLY) and write it to a JSON file
 *   --replay  insert that row into whatever DATABASE_URL points at, then call the real
 *             `updateContent` against it, exactly as the PATCH handler does
 *
 * Replaying locally is what makes this safe: the production data goes through the production code
 * with zero production writes, so a failure is reproduced rather than guessed at, and a success
 * rules the data out.
 */

import 'dotenv/config';
import { writeFileSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import prisma from '../../src/lib/prisma';
import { updateContentBodySchema } from '../../src/modules/content-hub/content-hub.schema';
import { updateContent, type Actor } from '../../src/modules/content-hub/content-hub.service';

const argv = process.argv.slice(2);
const DUMP = argv.includes('--dump');
const REPLAY = argv.includes('--replay');
const REF = argv.find((a) => a.startsWith('--ref='))?.split('=')[1] ?? 'W1-B001';
const FILE = `/tmp/${REF}.json`;

function target(): string {
  const raw = process.env.DATABASE_URL ?? '';
  return raw.match(/@([^/?]+)\//)?.[1] ?? '(unparseable)';
}

async function dump() {
  const row = await prisma.content_items.findFirstOrThrow({
    where: { editorial_ref: REF, deleted_at: null },
  });
  writeFileSync(FILE, JSON.stringify(row, null, 2));
  const size = JSON.stringify(row).length;
  console.log(`dumped ${REF} from ${target()} -> ${FILE} (${(size / 1024).toFixed(1)} KB)`);
  console.log(`  status=${row.status} author=${row.author_id ?? 'null'} reviewer=${row.reviewer_id ?? 'null'}`);
  console.log(`  reviewed_at=${row.reviewed_at ?? 'null'} meta=${row.meta_description ? 'set' : 'NULL'}`);
  console.log(`  blocks=${(row.body as { blocks?: unknown[] } | null)?.blocks?.length ?? 0} tags=${JSON.stringify(row.tags)}`);
}

/** The payload `toUpdateBody` builds when an editor presses Save with nothing changed. */
function editorPayload(row: Record<string, any>, expectedUpdatedAt: string, createRevision: boolean) {
  return {
    title: row.title,
    slug: row.slug,
    metaDescription: row.meta_description,
    featuredImageUrl: row.featured_image_url,
    featuredImageAlt: row.featured_image_alt,
    pillar: row.pillar,
    week: row.week,
    tags: row.tags ?? [],
    editorialRef: row.editorial_ref,
    authorId: row.author_id,
    reviewerId: row.reviewer_id,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    canonicalUrlOverride: row.canonical_url_override,
    robotsDirective: row.robots_directive,
    body: row.body,
    typeFields: row.type_fields ?? {},
    editorial: row.editorial ?? {},
    expectedUpdatedAt,
    createRevision,
  };
}

async function replay() {
  console.log(`replaying ${REF} against ${target()}`);
  if (/pooler\.supabase|supabase\.co/.test(target())) {
    console.log('REFUSED: --replay must not run against a hosted database. Point DATABASE_URL at the local test DB.');
    process.exit(2);
  }

  const source = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, any>;

  // A real actor.
  const actorId = randomUUID();
  await prisma.users.create({
    data: { id: actorId, email: `replay-${actorId.slice(0, 8)}@test.local`, is_sso_user: false, is_anonymous: false },
  });
  await prisma.profiles.create({
    data: { id: actorId, email: `replay-${actorId.slice(0, 8)}@test.local`, full_name: 'Replay Actor' },
    select: { id: true },
  });
  const actor: Actor = { id: actorId, role: 'super_admin' };

  // Insert the production row verbatim, minus identity/FK fields that do not exist locally.
  const id = randomUUID();
  const {
    id: _oldId,
    author_id: _a,
    reviewer_id: _r,
    created_by: _c,
    updated_by: _u,
    created_at: _ca,
    updated_at: _ua,
    ...rest
  } = source;

  const created = await prisma.content_items.create({
    data: {
      ...(rest as any),
      id,
      slug: `${source.slug}-replay-${id.slice(0, 6)}`,
      editorial_ref: `${source.editorial_ref}-REPLAY-${id.slice(0, 6)}`,
      created_by: actorId,
      updated_by: actorId,
      author_id: null,
      reviewer_id: null,
      published_at: source.published_at ? new Date(source.published_at) : null,
      first_published_at: source.first_published_at ? new Date(source.first_published_at) : null,
      reviewed_at: source.reviewed_at ? new Date(source.reviewed_at) : null,
      scheduled_for: source.scheduled_for ? new Date(source.scheduled_for) : null,
      deleted_at: null,
    },
  });

  console.log(`  inserted local copy id=${created.id} status=${created.status}`);
  console.log(`  blocks=${(created.body as { blocks?: unknown[] } | null)?.blocks?.length ?? 0}`);

  for (const createRevision of [false, true]) {
    const label = createRevision ? 'EXPLICIT SAVE (createRevision=true)' : 'AUTOSAVE (createRevision=false)';
    console.log(`\n─── ${label} ───`);

    const current = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    const payload = editorPayload(source, current.updated_at.toISOString(), createRevision);

    const parsed = updateContentBodySchema.safeParse(payload);
    if (!parsed.success) {
      console.log('  REQUEST SCHEMA REJECTED:');
      for (const issue of parsed.error.issues.slice(0, 8)) {
        console.log(`    ${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }
    console.log('  request schema: OK');

    const revsBefore = await prisma.content_revisions.count({ where: { content_id: id } });
    const auditsBefore = await prisma.audit_logs.count();

    try {
      const result = await updateContent(id, parsed.data as never, actor);
      const revsAfter = await prisma.content_revisions.count({ where: { content_id: id } });
      const auditsAfter = await prisma.audit_logs.count();
      console.log(`  updateContent: OK`);
      console.log(`    returned updatedAt=${result.updatedAt}`);
      console.log(`    revisions ${revsBefore} -> ${revsAfter}`);
      console.log(`    audit rows ${auditsBefore} -> ${auditsAfter}`);
    } catch (error) {
      const err = error as { code?: string; statusCode?: number; message?: string; meta?: unknown; stack?: string };
      console.log(`  *** updateContent FAILED ***`);
      console.log(`    code=${err.code ?? '?'} statusCode=${err.statusCode ?? '?'}`);
      console.log(`    message: ${(err.message ?? String(error)).split('\n').slice(0, 10).join('\n      ')}`);
      if (err.meta) console.log(`    meta: ${JSON.stringify(err.meta)}`);
      if (err.stack) console.log(`    at: ${err.stack.split('\n').slice(1, 5).join('\n        ')}`);

      const revsAfter = await prisma.content_revisions.count({ where: { content_id: id } });
      const auditsAfter = await prisma.audit_logs.count();
      const after = await prisma.content_items.findUniqueOrThrow({ where: { id } });
      console.log(`    PARTIAL WRITE CHECK: revisions ${revsBefore} -> ${revsAfter}, audits ${auditsBefore} -> ${auditsAfter}`);
      console.log(`    row updated_at changed: ${after.updated_at.toISOString() !== current.updated_at.toISOString()}`);
    }
  }

  // Stale-token behaviour: must be 409, never 500.
  console.log('\n─── STALE TOKEN ───');
  try {
    const stale = editorPayload(source, '2020-01-01T00:00:00.000Z', true);
    await updateContent(id, updateContentBodySchema.parse(stale) as never, actor);
    console.log('  *** accepted a stale token — concurrency is not enforced ***');
  } catch (error) {
    const err = error as { code?: string; statusCode?: number };
    console.log(`  rejected with code=${err.code} statusCode=${err.statusCode} ${err.statusCode === 409 ? '(correct)' : '(WRONG — should be 409)'}`);
  }

  // Cleanup.
  await prisma.content_links.deleteMany({ where: { source_id: id } });
  await prisma.content_revisions.deleteMany({ where: { content_id: id } });
  await prisma.content_items.delete({ where: { id } });
  await prisma.audit_logs.deleteMany({ where: { actor_id: actorId } });
  await prisma.profiles.delete({ where: { id: actorId } });
  await prisma.users.delete({ where: { id: actorId } });
  console.log('\ncleaned up local replay data');
}

async function main() {
  if (DUMP) await dump();
  else if (REPLAY) await replay();
  else console.log('pass --dump or --replay');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
