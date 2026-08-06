/**
 * Content Hub schema — integration proof against REAL PostgreSQL.
 *
 * Everything here runs against a disposable PostgreSQL 15 container with the real migration
 * history applied by `prisma migrate deploy` (see `test-integration/bootstrap.ts`). Nothing is
 * mocked: partial unique indexes, cascade behaviour, defaults and the XOR check are properties of
 * the database, and a mock could not prove any of them.
 *
 * Phase 1 scope: schema shape and constraints only. Publishing behaviour, transitions and the
 * revision lifecycle belong to Phase 2.
 */

import { randomUUID } from 'crypto';
import prisma from './prisma';
import { writeAuditLog } from './auditLog';

jest.setTimeout(60_000);

/** Rows created by this suite, removed in reverse dependency order. */
const createdContentIds: string[] = [];
const createdProfileIds: string[] = [];

async function createProfile(): Promise<string> {
  const id = randomUUID();
  const email = `content-hub-${id.slice(0, 8)}@integration.test`;

  // `profiles.id` references `auth.users.id`, so the auth row must exist first.
  await prisma.users.create({
    data: { id, email, is_sso_user: false, is_anonymous: false },
  });

  await prisma.profiles.create({
    data: { id, email, full_name: 'Content Hub Test Author' },
    // `select` is required, not stylistic — the same reason it is required in
    // `test-integration/factories.ts`. Prisma RETURNs every declared field by default, and
    // `schema.prisma` declares `profiles.signup_source`, a column added only by the manual
    // Supabase migration 0011 and by NO Prisma migration. On a database built purely from
    // migration history that column is absent, so an unscoped create fails on the RETURNING
    // clause even though the INSERT itself is fine. Pre-existing drift, unrelated to Content Hub.
    select: { id: true },
  });

  createdProfileIds.push(id);
  return id;
}

async function createItem(overrides: Record<string, unknown> = {}): Promise<string> {
  const created = await prisma.content_items.create({
    data: {
      content_type: 'aeo_answer',
      slug: `test-${randomUUID()}`,
      title: 'Integration fixture',
      ...overrides,
    } as never,
  });
  createdContentIds.push(created.id);
  return created.id;
}

afterAll(async () => {
  // content_links and content_revisions cascade from content_items.
  if (createdContentIds.length > 0) {
    await prisma.content_items.deleteMany({ where: { id: { in: createdContentIds } } });
  }
  if (createdProfileIds.length > 0) {
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: createdProfileIds } } });
    await prisma.profiles.deleteMany({ where: { id: { in: createdProfileIds } } });
    await prisma.users.deleteMany({ where: { id: { in: createdProfileIds } } });
  }
});

describe('tables exist', () => {
  it('creates all three Content Hub tables and no others', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'content_%'
       ORDER BY table_name`
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'content_items',
      'content_links',
      'content_revisions',
    ]);
  });

  it('does NOT create the tables the plan rejected', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('content_faqs','content_taxonomy','content_item_taxonomy',
                            'content_approvals','content_media','content_kpis','content_redirects')`
    );
    expect(rows).toEqual([]);
  });
});

describe('defaults', () => {
  it('applies every documented default', async () => {
    const id = await createItem();
    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });

    expect(row.status).toBe('draft');
    expect(row.founder_approval).toBe('pending');
    expect(row.marketing_approval).toBe('pending');
    expect(row.seo_approval).toBe('pending');
    expect(row.robots_directive).toBe('index,follow');
    expect(row.current_revision_number).toBe(0);
    expect(row.body).toEqual({ version: 1, blocks: [] });
    expect(row.type_fields).toEqual({});
    expect(row.editorial).toEqual({});
    expect(row.created_at).toBeInstanceOf(Date);
    expect(row.updated_at).toBeInstanceOf(Date);
    expect(row.deleted_at).toBeNull();
  });

  it('defaults tags to an empty array, never null', async () => {
    const id = await createItem();
    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    // NOT NULL with an empty-array default, so code never distinguishes "no tags" from "unknown".
    expect(row.tags).toEqual([]);
    expect(row.tags).not.toBeNull();
  });

  it('stores and reads back a tag array', async () => {
    const id = await createItem({ tags: ['anxiety', 'sleep-health'] });
    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(row.tags).toEqual(['anxiety', 'sleep-health']);
  });

  it('leaves publish-time fields nullable so a draft can be incomplete', async () => {
    const id = await createItem();
    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(row.meta_description).toBeNull();
    expect(row.author_id).toBeNull();
    expect(row.published_at).toBeNull();
    expect(row.first_published_at).toBeNull();
  });
});

describe('slug uniqueness', () => {
  it('rejects a duplicate slug among live rows', async () => {
    const slug = `dupe-${randomUUID()}`;
    await createItem({ slug });
    await expect(createItem({ slug })).rejects.toThrow();
  });

  it('releases the slug once the item is soft-deleted', async () => {
    const slug = `release-${randomUUID()}`;
    const first = await createItem({ slug });

    await prisma.content_items.update({ where: { id: first }, data: { deleted_at: new Date() } });

    // The partial unique index excludes soft-deleted rows, so the slug is reusable.
    const second = await createItem({ slug });
    expect(second).not.toBe(first);
  });
});

describe('editorial_ref uniqueness', () => {
  it('rejects a duplicate reference among live rows', async () => {
    const ref = `W9-${randomUUID().slice(0, 8)}`;
    await createItem({ editorial_ref: ref });
    await expect(createItem({ editorial_ref: ref })).rejects.toThrow();
  });

  it('permits many rows with no reference at all', async () => {
    const a = await createItem({ editorial_ref: null });
    const b = await createItem({ editorial_ref: null });
    expect(a).not.toBe(b);
  });
});

describe('content_revisions', () => {
  it('enforces one revision number per item', async () => {
    const contentId = await createItem();
    await prisma.content_revisions.create({
      data: { content_id: contentId, revision_number: 1, snapshot: {}, trigger: 'manual_save', status_at_capture: 'draft' },
    });

    await expect(
      prisma.content_revisions.create({
        data: { content_id: contentId, revision_number: 1, snapshot: {}, trigger: 'manual_save', status_at_capture: 'draft' },
      })
    ).rejects.toThrow();
  });

  it('allows the same revision number on a different item', async () => {
    const a = await createItem();
    const b = await createItem();
    const base = { revision_number: 1, snapshot: {}, trigger: 'manual_save', status_at_capture: 'draft' };

    await prisma.content_revisions.create({ data: { ...base, content_id: a } });
    await prisma.content_revisions.create({ data: { ...base, content_id: b } });

    expect(await prisma.content_revisions.count({ where: { content_id: { in: [a, b] } } })).toBe(2);
  });

  it('cascades when the item is hard-deleted', async () => {
    const contentId = await createItem();
    await prisma.content_revisions.create({
      data: { content_id: contentId, revision_number: 1, snapshot: { title: 'x' }, trigger: 'transition', status_at_capture: 'published' },
    });

    await prisma.content_items.delete({ where: { id: contentId } });
    createdContentIds.splice(createdContentIds.indexOf(contentId), 1);

    expect(await prisma.content_revisions.count({ where: { content_id: contentId } })).toBe(0);
  });
});

describe('content_links', () => {
  it('supports a self-referential cyclic graph', async () => {
    // The Week 1 cluster is cyclic (A->B, B->A), which is why publishing is atomic.
    const a = await createItem();
    const b = await createItem();

    await prisma.content_links.create({
      data: { source_id: a, target_kind: 'content', target_content_id: b, relation: 'related_content' },
    });
    await prisma.content_links.create({
      data: { source_id: b, target_kind: 'content', target_content_id: a, relation: 'related_content' },
    });

    expect(await prisma.content_links.count({ where: { source_id: { in: [a, b] } } })).toBe(2);
  });

  it('rejects a duplicate content-to-content edge of the same relation', async () => {
    const a = await createItem();
    const b = await createItem();
    const edge = { source_id: a, target_kind: 'content', target_content_id: b, relation: 'related_content' };

    await prisma.content_links.create({ data: edge });
    await expect(prisma.content_links.create({ data: edge })).rejects.toThrow();
  });

  it('permits several route links sharing one relation', async () => {
    // The partial unique index excludes route links, so this must not collide.
    const source = await createItem();
    await prisma.content_links.create({
      data: { source_id: source, target_kind: 'route', target_route: 'pricing', relation: 'pricing' },
    });
    await prisma.content_links.create({
      data: { source_id: source, target_kind: 'route', target_route: 'how_it_works', relation: 'pricing' },
    });

    expect(await prisma.content_links.count({ where: { source_id: source } })).toBe(2);
  });

  it('enforces the target XOR constraint', async () => {
    const source = await createItem();
    const target = await createItem();

    // Both targets set.
    await expect(
      prisma.content_links.create({
        data: { source_id: source, target_kind: 'content', target_content_id: target, target_route: 'pricing', relation: 'related_content' },
      })
    ).rejects.toThrow();

    // Neither target set.
    await expect(
      prisma.content_links.create({
        data: { source_id: source, target_kind: 'content', relation: 'related_content' },
      })
    ).rejects.toThrow();

    // kind/target mismatch.
    await expect(
      prisma.content_links.create({
        data: { source_id: source, target_kind: 'route', target_content_id: target, relation: 'related_content' },
      })
    ).rejects.toThrow();
  });

  it('cascades from both endpoints', async () => {
    const source = await createItem();
    const target = await createItem();
    await prisma.content_links.create({
      data: { source_id: source, target_kind: 'content', target_content_id: target, relation: 'related_content' },
    });

    // Deleting the TARGET removes the inbound link, so no link outlives its endpoint.
    await prisma.content_items.delete({ where: { id: target } });
    createdContentIds.splice(createdContentIds.indexOf(target), 1);

    expect(await prisma.content_links.count({ where: { source_id: source } })).toBe(0);
  });

  it('supports the reverse lookup that justifies the table', async () => {
    const target = await createItem();
    const a = await createItem();
    const b = await createItem();

    for (const source of [a, b]) {
      await prisma.content_links.create({
        data: { source_id: source, target_kind: 'content', target_content_id: target, relation: 'related_content' },
      });
    }

    const inbound = await prisma.content_links.findMany({ where: { target_content_id: target } });
    expect(inbound).toHaveLength(2);
  });
});

describe('indexes', () => {
  async function indexNames(table: string): Promise<string[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
      table
    );
    return rows.map((r) => r.indexname);
  }

  it('creates every approved content_items index', async () => {
    const names = await indexNames('content_items');
    for (const expected of [
      'content_items_pkey',
      'content_items_slug_live_key',
      'content_items_editorial_ref_live_key',
      'content_items_status_published_at_idx',
      'content_items_content_type_status_idx',
      'content_items_pillar_idx',
      'content_items_created_at_idx',
      'content_items_author_id_idx',
      'content_items_deleted_at_idx',
      'content_items_scheduled_for_idx',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('creates the scheduled_for index as a PARTIAL index', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'content_items_scheduled_for_idx'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/WHERE/i);
  });

  it('creates NO GIN index anywhere on the Content Hub tables', async () => {
    // The repository has zero GIN indexes; tags is deliberately unindexed in v1.
    const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT i.relname AS indexname
       FROM pg_class t
       JOIN pg_index ix ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_am am ON i.relam = am.oid
       WHERE t.relname IN ('content_items','content_links','content_revisions')
         AND am.amname = 'gin'`
    );
    expect(rows).toEqual([]);
  });

  it('creates the revision and link indexes', async () => {
    expect(await indexNames('content_revisions')).toEqual(
      expect.arrayContaining([
        'content_revisions_content_id_revision_number_key',
        'content_revisions_content_id_created_at_idx',
        'content_revisions_content_id_status_at_capture_idx',
      ])
    );
    expect(await indexNames('content_links')).toEqual(
      expect.arrayContaining([
        'content_links_source_id_sort_order_idx',
        'content_links_target_content_id_idx',
        'content_links_source_target_relation_key',
      ])
    );
  });
});

describe('foreign keys', () => {
  it('accepts a real profile as author and rejects an unknown one', async () => {
    const authorId = await createProfile();
    const id = await createItem({ author_id: authorId });

    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(row.author_id).toBe(authorId);

    await expect(createItem({ author_id: randomUUID() })).rejects.toThrow();
  });
});

describe('audit log writer against a real database', () => {
  it('writes a row through the shared utility', async () => {
    const actorId = await createProfile();

    await writeAuditLog({
      actorId,
      action: 'content.created',
      details: { contentId: 'abc', body: { blocks: [] } },
    });

    const rows = await prisma.audit_logs.findMany({ where: { actor_id: actorId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('content.created');
    // Redaction survives the round-trip to JSONB.
    expect(rows[0].details).toEqual({ contentId: 'abc', body: '[redacted]' });
  });

  it('rolls the audit row back with the transaction it belongs to', async () => {
    const actorId = await createProfile();

    await expect(
      prisma.$transaction(async (tx) => {
        await writeAuditLog({ actorId, action: 'content.published' }, { tx });
        throw new Error('force rollback');
      })
    ).rejects.toThrow('force rollback');

    // A rolled-back publish must leave no misleading "published" event behind.
    const rows = await prisma.audit_logs.findMany({ where: { actor_id: actorId } });
    expect(rows).toHaveLength(0);
  });
});
