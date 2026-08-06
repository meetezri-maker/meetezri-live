/**
 * Content Hub — services against REAL PostgreSQL.
 *
 * Transaction behaviour, optimistic concurrency, revision numbering, rollback and the cyclic
 * cluster publish are all properties of the database. A mock could not prove any of them, so
 * nothing here is mocked.
 */

import { randomUUID } from 'crypto';
import { VALID_AEO_BODY, VALID_GEO_BODY, VALID_SEO_BODY } from '@meetezri/shared';
import prisma from '../../../lib/prisma';
import { isContentHubError } from '../content-hub.errors';
import {
  publishCluster,
  validateCluster,
} from '../content-hub.cluster.service';
import {
  evaluateChecklist,
  setApprovalGate,
  transitionContent,
} from '../content-hub.publish.service';
import { cancelSchedule, setSchedule } from '../content-hub.schedule.service';
import {
  resolvePublishedContent,
  resolvePublishedList,
  resolvePublishedRelated,
  resolvePreviewContent,
} from '../content-hub.read.service';
import {
  createContent,
  deleteContent,
  duplicateContent,
  getContent,
  getInboundLinks,
  listRevisions,
  replaceLinks,
  restoreRevision,
  updateContent,
  type Actor,
} from '../content-hub.service';

jest.setTimeout(60_000);

const createdContentIds: string[] = [];
const createdProfileIds: string[] = [];

let SUPER: Actor;
let ORG: Actor;

async function makeProfile(): Promise<string> {
  const id = randomUUID();
  const email = `ch-${id.slice(0, 8)}@integration.test`;
  await prisma.users.create({ data: { id, email, is_sso_user: false, is_anonymous: false } });
  // `select` is required — `profiles.signup_source` is declared in schema.prisma but created by
  // no Prisma migration (documented drift; see test-integration/factories.ts).
  await prisma.profiles.create({
    data: { id, email, full_name: 'Content Hub Tester' },
    select: { id: true },
  });
  createdProfileIds.push(id);
  return id;
}

beforeAll(async () => {
  SUPER = { id: await makeProfile(), role: 'super_admin' };
  ORG = { id: await makeProfile(), role: 'org_admin' };
});

afterAll(async () => {
  if (createdContentIds.length > 0) {
    await prisma.content_items.deleteMany({ where: { id: { in: createdContentIds } } });
  }
  if (createdProfileIds.length > 0) {
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: createdProfileIds } } });
    await prisma.profiles.deleteMany({ where: { id: { in: createdProfileIds } } });
    await prisma.users.deleteMany({ where: { id: { in: createdProfileIds } } });
  }
});

/** Create a draft and track it for cleanup. */
async function newDraft(overrides: { contentType?: any; title?: string } = {}) {
  const created = await createContent(
    {
      contentType: overrides.contentType ?? 'aeo_answer',
      title: overrides.title ?? `Fixture ${randomUUID().slice(0, 8)}`,
    } as never,
    SUPER
  );
  createdContentIds.push(created.id);
  return created;
}

/** Fill an item so it satisfies every blocking checklist rule, then approve all gates. */
async function makePublishable(
  contentType: 'aeo_answer' | 'geo_article' | 'seo_blog' = 'aeo_answer'
): Promise<string> {
  const draft = await newDraft({ contentType, title: `Publishable ${randomUUID().slice(0, 8)}` });

  const body =
    contentType === 'aeo_answer' ? VALID_AEO_BODY : contentType === 'geo_article' ? VALID_GEO_BODY : VALID_SEO_BODY;

  const typeFields =
    contentType === 'aeo_answer'
      ? { primary_question: 'What should I do?', snippet_answer: 'Express what you are carrying.' }
      : contentType === 'geo_article'
        ? { core_concept: 'Talking helps', citation_summary: 'A summary.', key_statements: ['One.'] }
        : {};

  const current = await prisma.content_items.findUniqueOrThrow({ where: { id: draft.id } });

  await updateContent(
    draft.id,
    {
      metaDescription: 'A meta description that is comfortably inside the fifty to one sixty range.',
      body,
      typeFields,
      authorId: SUPER.id,
      expectedUpdatedAt: current.updated_at.toISOString(),
      createRevision: false,
    } as never,
    SUPER
  );

  await transitionContent(draft.id, 'submit', SUPER);
  for (const gate of ['founder', 'marketing', 'seo'] as const) {
    await setApprovalGate(draft.id, gate, 'approved', SUPER);
  }

  return draft.id;
}

async function currentUpdatedAt(id: string) {
  const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
  return row.updated_at.toISOString();
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

describe('CRUD', () => {
  it('creates a draft with pending gates and derives a slug', async () => {
    const created = await createContent(
      { contentType: 'seo_blog', title: 'Someone To Talk To At Night' } as never,
      SUPER
    );
    createdContentIds.push(created.id);

    expect(created.slug).toBe('someone-to-talk-to-at-night');
    expect(created.status).toBe('draft');
    expect(created.approvals).toEqual({ founder: 'pending', marketing: 'pending', seo: 'pending' });
    expect(created.publicLabel).toBe('Article');

    // No revision on create — there is nothing to compare against.
    const revisions = await listRevisions(created.id, 1, 10);
    expect(revisions.total).toBe(0);
  });

  it('rejects a reserved slug and returns 409 on collision', async () => {
    await expect(createContent({ contentType: 'seo_blog', title: 'Admin' } as never, SUPER)).rejects.toMatchObject(
      { code: 'SLUG_RESERVED' }
    );

    const first = await newDraft({ title: 'Collision Test Item' });
    await expect(
      createContent({ contentType: 'seo_blog', title: 'Collision Test Item' } as never, SUPER)
    ).rejects.toMatchObject({ statusCode: 409, code: 'SLUG_TAKEN' });
    expect(first.id).toBeTruthy();
  });

  it('recalculates derived metrics on save and ignores client-supplied values', async () => {
    const draft = await newDraft();
    const updated = await updateContent(
      draft.id,
      { body: VALID_SEO_BODY, expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: false } as never,
      SUPER
    );
    expect(updated.wordCount).toBeGreaterThan(0);
    expect(updated.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('rejects a stale optimistic-concurrency token with 409', async () => {
    const draft = await newDraft();
    const stale = await currentUpdatedAt(draft.id);

    await updateContent(draft.id, { title: 'First writer wins', expectedUpdatedAt: stale, createRevision: false } as never, SUPER);

    await expect(
      updateContent(draft.id, { title: 'Second writer', expectedUpdatedAt: stale, createRevision: false } as never, SUPER)
    ).rejects.toMatchObject({ statusCode: 409, code: 'STALE_UPDATE' });
  });

  it('normalises tags on save', async () => {
    const draft = await newDraft();
    const updated = await updateContent(
      draft.id,
      { tags: ['  Sleep Health ', 'ANXIETY', 'anxiety'], expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: false } as never,
      SUPER
    );
    expect(updated.tags).toEqual(['sleep-health', 'anxiety']);
  });

  it('duplicates content, resetting lifecycle but keeping authored fields', async () => {
    const sourceId = await makePublishable();
    const copy = await duplicateContent(sourceId, SUPER);
    createdContentIds.push(copy.id);

    expect(copy.status).toBe('draft');
    expect(copy.approvals).toEqual({ founder: 'pending', marketing: 'pending', seo: 'pending' });
    expect(copy.editorialRef).toBeNull();
    expect(copy.slug).not.toBe((await getContent(sourceId)).slug);

    const full = await getContent(copy.id);
    expect(full.currentRevisionNumber).toBe(0);
    expect(full.firstPublishedAt).toBeNull();
    // Links are NOT copied — an editorial decision belongs to the new item.
    expect(full.links).toEqual([]);
  });

  it('soft-deletes and releases the slug', async () => {
    const draft = await newDraft({ title: 'Release My Slug Please' });
    await deleteContent(draft.id, SUPER);

    const row = await prisma.content_items.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.deleted_at).not.toBeNull();

    // Partial unique index excludes soft-deleted rows.
    const reused = await createContent({ contentType: 'seo_blog', title: 'Release My Slug Please' } as never, SUPER);
    createdContentIds.push(reused.id);
    expect(reused.slug).toBe('release-my-slug-please');
  });

  it('refuses to delete published content before it is unpublished', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);
    await expect(deleteContent(id, SUPER)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses deletion by org_admin', async () => {
    const draft = await newDraft();
    await expect(deleteContent(draft.id, ORG)).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─── Published slug protection ───────────────────────────────────────────────

describe('published slug protection', () => {
  it('requires super_admin AND explicit confirmation', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);

    await expect(
      updateContent(id, { slug: 'a-new-url', expectedUpdatedAt: await currentUpdatedAt(id), createRevision: true } as never, SUPER)
    ).rejects.toMatchObject({ code: 'SLUG_CHANGE_NOT_CONFIRMED' });

    await expect(
      updateContent(
        id,
        { slug: 'a-new-url', confirmSlugChange: true, expectedUpdatedAt: await currentUpdatedAt(id), createRevision: true } as never,
        ORG
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    const updated = await updateContent(
      id,
      { slug: 'a-new-url', confirmSlugChange: true, expectedUpdatedAt: await currentUpdatedAt(id), createRevision: true } as never,
      SUPER
    );
    expect(updated.slug).toBe('a-new-url');

    const events = await prisma.audit_logs.findMany({ where: { action: 'content.slug_changed' } });
    expect(events.some((e) => (e.details as any)?.contentId === id)).toBe(true);
  });

  it('blocks autosave on a published item', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);

    await expect(
      updateContent(id, { title: 'Sneaky autosave', expectedUpdatedAt: await currentUpdatedAt(id), createRevision: false } as never, SUPER)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─── Revisions ───────────────────────────────────────────────────────────────

describe('revisions', () => {
  it('creates a revision on explicit save but not on autosave', async () => {
    const draft = await newDraft();

    await updateContent(draft.id, { title: 'Autosaved', expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: false } as never, SUPER);
    expect((await listRevisions(draft.id, 1, 10)).total).toBe(0);

    await updateContent(draft.id, { title: 'Explicitly saved', expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: true } as never, SUPER);
    const after = await listRevisions(draft.id, 1, 10);
    expect(after.total).toBe(1);
    expect(after.items[0].trigger).toBe('manual_save');
  });

  it('numbers revisions atomically with no gaps', async () => {
    const draft = await newDraft();
    for (let i = 0; i < 4; i += 1) {
      await updateContent(draft.id, { title: `Save ${i}`, expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: true } as never, SUPER);
    }
    const revisions = await listRevisions(draft.id, 1, 20);
    expect(revisions.items.map((r) => r.revisionNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);

    const row = await prisma.content_items.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.current_revision_number).toBe(4);
  });

  it('captures authored fields only — no identity, derived values or counters', async () => {
    const draft = await newDraft();
    await updateContent(draft.id, { body: VALID_SEO_BODY, expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: true } as never, SUPER);

    const revision = await prisma.content_revisions.findFirstOrThrow({ where: { content_id: draft.id } });
    const snapshot = revision.snapshot as Record<string, unknown>;

    for (const forbidden of ['id', 'created_at', 'word_count', 'reading_time_minutes', 'current_revision_number', 'published_at', 'first_published_at']) {
      expect({ forbidden, present: forbidden in snapshot }).toEqual({ forbidden, present: false });
    }
    for (const expected of ['title', 'slug', 'body', 'tags', 'status', 'founder_approval']) {
      expect({ expected, present: expected in snapshot }).toEqual({ expected, present: true });
    }
  });

  it('creates a transition revision on every status change', async () => {
    const draft = await newDraft();
    await transitionContent(draft.id, 'submit', SUPER);
    const revisions = await listRevisions(draft.id, 1, 10);
    expect(revisions.items[0].trigger).toBe('transition');
    expect(revisions.items[0].statusAtCapture).toBe('in_review');
  });

  it('restores by writing a NEW revision, never mutating history', async () => {
    const draft = await newDraft();
    await updateContent(draft.id, { title: 'Original title', expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: true } as never, SUPER);
    await updateContent(draft.id, { title: 'Changed title', expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: true } as never, SUPER);

    const restored = await restoreRevision(draft.id, 1, await currentUpdatedAt(draft.id), SUPER);
    expect(restored.title).toBe('Original title');

    const revisions = await listRevisions(draft.id, 1, 10);
    expect(revisions.total).toBe(3);
    expect(revisions.items[0].trigger).toBe('restore');

    // The original revision is untouched.
    const original = await prisma.content_revisions.findFirstOrThrow({ where: { content_id: draft.id, revision_number: 1 } });
    expect((original.snapshot as any).title).toBe('Original title');
  });

  it('rejects a restore with a stale token', async () => {
    const draft = await newDraft();
    await updateContent(draft.id, { title: 'v1', expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: true } as never, SUPER);
    const stale = await currentUpdatedAt(draft.id);
    await updateContent(draft.id, { title: 'v2', expectedUpdatedAt: stale, createRevision: true } as never, SUPER);

    await expect(restoreRevision(draft.id, 1, stale, SUPER)).rejects.toMatchObject({ code: 'STALE_UPDATE' });
  });
});

// ─── Links ───────────────────────────────────────────────────────────────────

describe('links', () => {
  it('replaces the whole set and hydrates targets', async () => {
    const source = await newDraft();
    const target = await newDraft();

    const links = await replaceLinks(
      source.id,
      [
        { targetKind: 'content', targetContentId: target.id, relation: 'related_content', sortOrder: 0, anchorText: 'Read this' },
        { targetKind: 'route', targetRoute: 'product.talk_it_out', relation: 'product', sortOrder: 1 },
      ] as never,
      SUPER
    );

    expect(links).toHaveLength(2);
    expect(links[0].targetTitle).toBe(target.title);
    expect(links[1].routeHref).toBe('/how-it-works');
  });

  it('rejects self-links, unmapped routes and duplicate edges', async () => {
    const source = await newDraft();
    const target = await newDraft();

    await expect(
      replaceLinks(source.id, [{ targetKind: 'content', targetContentId: source.id, relation: 'related_content', sortOrder: 0 }] as never, SUPER)
    ).rejects.toMatchObject({ code: 'INVALID_LINK' });

    await expect(
      replaceLinks(source.id, [{ targetKind: 'route', targetRoute: 'product.nope', relation: 'product', sortOrder: 0 }] as never, SUPER)
    ).rejects.toMatchObject({ code: 'INVALID_LINK' });

    await expect(
      replaceLinks(
        source.id,
        [
          { targetKind: 'content', targetContentId: target.id, relation: 'related_content', sortOrder: 0 },
          { targetKind: 'content', targetContentId: target.id, relation: 'related_content', sortOrder: 1 },
        ] as never,
        SUPER
      )
    ).rejects.toMatchObject({ code: 'INVALID_LINK' });
  });

  it('supports the inbound lookup', async () => {
    const target = await newDraft();
    const a = await newDraft();
    const b = await newDraft();

    for (const source of [a, b]) {
      await replaceLinks(source.id, [{ targetKind: 'content', targetContentId: target.id, relation: 'related_content', sortOrder: 0 }] as never, SUPER);
    }

    expect(await getInboundLinks(target.id)).toHaveLength(2);
  });

  it('creates no revision for a link change', async () => {
    const source = await newDraft();
    const target = await newDraft();
    await replaceLinks(source.id, [{ targetKind: 'content', targetContentId: target.id, relation: 'related_content', sortOrder: 0 }] as never, SUPER);
    expect((await listRevisions(source.id, 1, 10)).total).toBe(0);
  });
});

// ─── Approvals and state machine ─────────────────────────────────────────────

describe('approval workflow', () => {
  it('auto-approves only when every gate is approved', async () => {
    const draft = await newDraft();
    await transitionContent(draft.id, 'submit', SUPER);

    await setApprovalGate(draft.id, 'founder', 'approved', SUPER);
    expect((await getContent(draft.id)).status).toBe('in_review');

    await setApprovalGate(draft.id, 'marketing', 'approved', SUPER);
    expect((await getContent(draft.id)).status).toBe('in_review');

    const result = await setApprovalGate(draft.id, 'seo', 'approved', SUPER);
    expect(result.status).toBe('approved');
    expect((await getContent(draft.id)).status).toBe('approved');
  });

  it('moves to changes_requested and clears any schedule', async () => {
    const id = await makePublishable();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await setSchedule(id, future, SUPER);

    await setApprovalGate(id, 'marketing', 'changes_requested', SUPER);

    const after = await getContent(id);
    expect(after.status).toBe('changes_requested');
    expect(after.scheduledFor).toBeNull();

    const cleared = await prisma.audit_logs.findMany({ where: { action: 'content.schedule_cleared' } });
    expect(cleared.some((e) => (e.details as any)?.reason === 'approval_withdrawn')).toBe(true);
  });

  it('returns an approved item to in_review when a gate is withdrawn', async () => {
    const id = await makePublishable();
    await setApprovalGate(id, 'founder', 'pending', SUPER);
    expect((await getContent(id)).status).toBe('in_review');
  });

  it('creates no revision for a gate change alone', async () => {
    const draft = await newDraft();
    await transitionContent(draft.id, 'submit', SUPER);
    const before = (await listRevisions(draft.id, 1, 20)).total;
    await setApprovalGate(draft.id, 'founder', 'approved', SUPER);
    expect((await listRevisions(draft.id, 1, 20)).total).toBe(before);
  });

  it('forbids team_admin from setting gates', async () => {
    const draft = await newDraft();
    await expect(
      setApprovalGate(draft.id, 'founder', 'approved', { id: SUPER.id, role: 'team_admin' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('state machine', () => {
  it('rejects illegal transitions with 409', async () => {
    const draft = await newDraft();
    await expect(transitionContent(draft.id, 'publish', SUPER)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ILLEGAL_TRANSITION',
    });
    await expect(transitionContent(draft.id, 'unpublish', SUPER)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('walks the full legal lifecycle', async () => {
    const id = await makePublishable();

    expect((await transitionContent(id, 'publish', SUPER)).status).toBe('published');
    expect((await transitionContent(id, 'unpublish', SUPER)).status).toBe('unpublished');
    expect((await transitionContent(id, 'publish', SUPER)).status).toBe('published');
    await transitionContent(id, 'unpublish', SUPER);
    expect((await transitionContent(id, 'archive', SUPER)).status).toBe('archived');

    const restored = await transitionContent(id, 'restore', SUPER);
    expect(restored.status).toBe('draft');
    // Restoring resets the gates — the content is a draft again.
    expect((await getContent(id)).approvals).toEqual({ founder: 'pending', marketing: 'pending', seo: 'pending' });
  });

  it('forbids publish, unpublish and archive for org_admin', async () => {
    const id = await makePublishable();
    for (const action of ['publish', 'archive'] as const) {
      await expect(transitionContent(id, action, ORG)).rejects.toMatchObject({ statusCode: 403 });
    }
  });
});

// ─── Checklist ───────────────────────────────────────────────────────────────

describe('publish checklist', () => {
  it('fails a bare draft on every blocking rule that applies', async () => {
    const draft = await newDraft();
    const result = await evaluateChecklist(prisma, draft.id);

    expect(result.passed).toBe(false);
    const failed = result.items.filter((i) => i.blocking && !i.passed).map((i) => i.code);
    expect(failed).toEqual(expect.arrayContaining(['meta_description', 'author', 'body', 'safety_notice', 'approvals', 'type_fields']));
  });

  it('passes a fully-prepared item', async () => {
    const id = await makePublishable();
    const result = await evaluateChecklist(prisma, id);
    if (!result.passed) {
      throw new Error(`Unexpected failures: ${JSON.stringify(result.items.filter((i) => i.blocking && !i.passed))}`);
    }
    expect(result.passed).toBe(true);
  });

  it('fails when a link target is unpublished and outside the cluster', async () => {
    const id = await makePublishable();
    const unpublished = await newDraft();
    await replaceLinks(id, [{ targetKind: 'content', targetContentId: unpublished.id, relation: 'related_content', sortOrder: 0 }] as never, SUPER);

    const result = await evaluateChecklist(prisma, id);
    expect(result.items.find((i) => i.code === 'link_targets')?.passed).toBe(false);
  });

  it('reports warnings without blocking', async () => {
    const id = await makePublishable();
    const result = await evaluateChecklist(prisma, id);
    const featured = result.items.find((i) => i.code === 'featured_image');
    expect(featured?.blocking).toBe(false);
    expect(featured?.passed).toBe(false);
    expect(result.passed).toBe(true);
  });
});

// ─── Publishing ──────────────────────────────────────────────────────────────

describe('publishing', () => {
  it('sets first_published_at once and advances published_at on republish', async () => {
    const id = await makePublishable();

    await transitionContent(id, 'publish', SUPER);
    const first = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(first.first_published_at).not.toBeNull();

    await transitionContent(id, 'unpublish', SUPER);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await transitionContent(id, 'publish', SUPER);

    const second = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(second.first_published_at!.getTime()).toBe(first.first_published_at!.getTime());
    expect(second.published_at!.getTime()).toBeGreaterThan(first.published_at!.getTime());
  });

  it('rejects publish with 422 and writes no revision when the checklist fails', async () => {
    const draft = await newDraft();
    await transitionContent(draft.id, 'submit', SUPER);
    for (const gate of ['founder', 'marketing', 'seo'] as const) {
      await setApprovalGate(draft.id, gate, 'approved', SUPER);
    }

    const revisionsBefore = (await listRevisions(draft.id, 1, 50)).total;

    // Approved, but the body and metadata are still empty.
    await expect(transitionContent(draft.id, 'publish', SUPER)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CHECKLIST_FAILED',
    });

    // The failed transaction left nothing behind.
    expect((await listRevisions(draft.id, 1, 50)).total).toBe(revisionsBefore);
    expect((await getContent(draft.id)).status).toBe('approved');

    const published = await prisma.audit_logs.findMany({ where: { action: 'content.published' } });
    expect(published.some((e) => (e.details as any)?.contentId === draft.id)).toBe(false);
  });

  it('removes the page from public APIs on unpublish', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);
    const slug = (await getContent(id)).slug;

    expect(await resolvePublishedContent(slug)).not.toBeNull();
    await transitionContent(id, 'unpublish', SUPER);
    expect(await resolvePublishedContent(slug)).toBeNull();
  });
});

// ─── Scheduling ──────────────────────────────────────────────────────────────

describe('scheduling', () => {
  const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

  it('sets a schedule on an approved item and derives the badge', async () => {
    const id = await makePublishable();
    const result = await setSchedule(id, future(), SUPER);
    expect(result.schedule).toEqual({ scheduled: true, overdue: false });
    expect(result.status).toBe('approved');
  });

  it('refuses to schedule a non-approved item', async () => {
    const draft = await newDraft();
    await expect(setSchedule(draft.id, future(), SUPER)).rejects.toMatchObject({
      statusCode: 409,
      code: 'SCHEDULE_NOT_APPROVED',
    });
  });

  it('refuses a date inside the five-minute lead time', async () => {
    const id = await makePublishable();
    await expect(setSchedule(id, new Date(Date.now() + 60_000).toISOString(), SUPER)).rejects.toMatchObject({
      code: 'SCHEDULE_IN_PAST',
    });
  });

  it('lets org_admin cancel but not set — the brake is deliberately wider', async () => {
    const id = await makePublishable();
    await setSchedule(id, future(), SUPER);

    await expect(setSchedule(id, future(), ORG)).rejects.toMatchObject({ statusCode: 403 });

    const cancelled = await cancelSchedule(id, ORG);
    expect(cancelled.scheduledFor).toBeNull();
    expect(cancelled.status).toBe('approved');
  });

  it('clears the schedule when the item publishes', async () => {
    const id = await makePublishable();
    await setSchedule(id, future(), SUPER);
    await transitionContent(id, 'publish', SUPER);

    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(row.scheduled_for).toBeNull();
  });

  it('clears the schedule when the item leaves approved', async () => {
    const id = await makePublishable();
    await setSchedule(id, future(), SUPER);
    await transitionContent(id, 'withdraw', SUPER);

    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(row.scheduled_for).toBeNull();
    expect(row.status).toBe('draft');
  });

  it('never writes "scheduled" into status', async () => {
    const id = await makePublishable();
    await setSchedule(id, future(), SUPER);
    const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('approved');
  });
});

// ─── Cluster publishing ──────────────────────────────────────────────────────

describe('atomic cluster publishing', () => {
  /** Build the Week 1 shape: three approved items in a cyclic link graph. */
  async function buildCyclicCluster() {
    const a = await makePublishable('aeo_answer');
    const g = await makePublishable('geo_article');
    const b = await makePublishable('seo_blog');

    await replaceLinks(a, [{ targetKind: 'content', targetContentId: b, relation: 'related_content', sortOrder: 0 }] as never, SUPER);
    await replaceLinks(
      g,
      [
        { targetKind: 'content', targetContentId: a, relation: 'related_content', sortOrder: 0 },
        { targetKind: 'content', targetContentId: b, relation: 'related_content', sortOrder: 1 },
      ] as never,
      SUPER
    );
    await replaceLinks(
      b,
      [
        { targetKind: 'content', targetContentId: a, relation: 'related_content', sortOrder: 0 },
        { targetKind: 'content', targetContentId: g, relation: 'related_content', sortOrder: 1 },
      ] as never,
      SUPER
    );

    return [a, g, b];
  }

  it('publishes a cyclic cluster atomically', async () => {
    const ids = await buildCyclicCluster();
    const result = await publishCluster(ids, SUPER);

    expect(result.published).toHaveLength(3);
    for (const id of ids) {
      const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('published');
      expect(row.first_published_at).not.toBeNull();
    }
  });

  it('CANNOT publish the same cyclic graph item by item', async () => {
    // This is the negative case that justifies cluster publishing existing at all.
    const ids = await buildCyclicCluster();
    await expect(transitionContent(ids[0], 'publish', SUPER)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CHECKLIST_FAILED',
    });
  });

  it('gives every member exactly one revision and one audit event', async () => {
    const ids = await buildCyclicCluster();
    const before = await Promise.all(ids.map(async (id) => (await listRevisions(id, 1, 50)).total));

    await publishCluster(ids, SUPER);

    for (let i = 0; i < ids.length; i += 1) {
      expect((await listRevisions(ids[i], 1, 50)).total).toBe(before[i] + 1);
    }

    const clusterEvents = await prisma.audit_logs.findMany({ where: { action: 'content.cluster_published' } });
    expect(clusterEvents.length).toBeGreaterThan(0);
  });

  it('fails the whole cluster when one member is not approved', async () => {
    const ids = await buildCyclicCluster();
    await setApprovalGate(ids[1], 'seo', 'changes_requested', SUPER);

    await expect(publishCluster(ids, SUPER)).rejects.toMatchObject({ statusCode: 422, code: 'CLUSTER_INVALID' });

    for (const id of ids) {
      const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
      expect(row.status).not.toBe('published');
    }
  });

  it('fails when a target is unpublished and outside the cluster', async () => {
    const ids = await buildCyclicCluster();
    const outsider = await newDraft();
    await replaceLinks(ids[0], [{ targetKind: 'content', targetContentId: outsider.id, relation: 'related_content', sortOrder: 0 }] as never, SUPER);

    await expect(publishCluster(ids, SUPER)).rejects.toMatchObject({ code: 'CLUSTER_INVALID' });
  });

  it('rolls everything back when a later member fails', async () => {
    const ids = await buildCyclicCluster();
    // Break the LAST member only.
    await setApprovalGate(ids[2], 'founder', 'pending', SUPER);

    await expect(publishCluster(ids, SUPER)).rejects.toMatchObject({ code: 'CLUSTER_INVALID' });

    // Nothing published, no revisions, no audit rows — the audit writes are inside the transaction.
    for (const id of ids) {
      const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
      expect(row.status).not.toBe('published');
    }
    const published = await prisma.audit_logs.findMany({ where: { action: 'content.published' } });
    expect(published.some((e) => ids.includes((e.details as any)?.contentId))).toBe(false);
  });

  it('lets org_admin validate but not publish', async () => {
    const ids = await buildCyclicCluster();
    const validation = await validateCluster(ids);
    expect(validation.passed).toBe(true);

    await expect(publishCluster(ids, ORG)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('reports link resolution per edge', async () => {
    const ids = await buildCyclicCluster();
    const validation = await validateCluster(ids);
    expect(validation.linkResolution.every((r) => r.resolution === 'in_cluster')).toBe(true);
  });
});

// ─── Public API ──────────────────────────────────────────────────────────────

describe('public read seam', () => {
  it('returns published content and nothing else', async () => {
    const id = await makePublishable();
    const slug = (await getContent(id)).slug;

    // Draft / approved — not visible.
    expect(await resolvePublishedContent(slug)).toBeNull();

    await transitionContent(id, 'publish', SUPER);
    const detail = await resolvePublishedContent(slug);
    expect(detail).not.toBeNull();
    expect(detail!.label).toBe('Answer');
  });

  it('hides archived and soft-deleted content', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);
    const slug = (await getContent(id)).slug;

    await transitionContent(id, 'unpublish', SUPER);
    await transitionContent(id, 'archive', SUPER);
    expect(await resolvePublishedContent(slug)).toBeNull();
  });

  it('never returns internal fields', async () => {
    const id = await makePublishable();
    await updateContent(
      id,
      {
        editorial: { purpose: 'INTERNAL_PURPOSE_SENTINEL', kpi_targets: [{ metric: 'AI Citations', goal: 'High' }] },
        tags: ['internal-tag'],
        expectedUpdatedAt: await currentUpdatedAt(id),
        createRevision: false,
      } as never,
      SUPER
    );
    await transitionContent(id, 'publish', SUPER);

    const detail = await resolvePublishedContent((await getContent(id)).slug);
    const json = JSON.stringify(detail);

    expect(json).not.toContain('INTERNAL_PURPOSE_SENTINEL');
    expect(json).not.toContain('internal-tag');
    expect(json).not.toContain('aeo_answer');
    expect(detail).not.toHaveProperty('editorial');
    expect(detail).not.toHaveProperty('tags');
  });

  it('filters the list by public label and paginates', async () => {
    const id = await makePublishable('geo_article');
    await transitionContent(id, 'publish', SUPER);

    const insights = await resolvePublishedList({ page: 1, pageSize: 24, type: 'Insight' });
    expect(insights.items.every((i) => i.label === 'Insight')).toBe(true);

    const paged = await resolvePublishedList({ page: 1, pageSize: 1 });
    expect(paged.items).toHaveLength(Math.min(1, paged.total));
    expect(paged.pageSize).toBe(1);
  });

  it('never puts a body in a list response', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);
    const list = await resolvePublishedList({ page: 1, pageSize: 24 });
    for (const item of list.items) {
      expect(item).not.toHaveProperty('body');
    }
  });

  it('falls back through manual, pillar and latest for related content', async () => {
    const a = await makePublishable();
    const b = await makePublishable();
    await transitionContent(a, 'publish', SUPER);
    await transitionContent(b, 'publish', SUPER);

    const slugA = (await getContent(a)).slug;
    const related = await resolvePublishedRelated(slugA, 3);
    expect(related).not.toBeNull();
    // Self is always excluded from related resources.
    expect(related!.every((card) => card.slug !== slugA)).toBe(true);
  });

  it('returns null related for an unpublished slug', async () => {
    const draft = await newDraft();
    expect(await resolvePublishedRelated((await getContent(draft.id)).slug, 3)).toBeNull();
  });
});

describe('admin preview', () => {
  it('renders unpublished content through the real serializer with noindex', async () => {
    const draft = await newDraft();
    await updateContent(draft.id, { body: VALID_AEO_BODY, expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: false } as never, SUPER);

    const preview = await resolvePreviewContent(draft.id);
    expect(preview).not.toBeNull();
    expect(preview!.robots).toBe('noindex,nofollow');
    expect(preview!.label).toBe('Answer');
  });

  it('leaks nothing internal in preview either', async () => {
    const draft = await newDraft();
    await updateContent(
      draft.id,
      { editorial: { purpose: 'PREVIEW_SENTINEL' }, expectedUpdatedAt: await currentUpdatedAt(draft.id), createRevision: false } as never,
      SUPER
    );
    const preview = await resolvePreviewContent(draft.id);
    expect(JSON.stringify(preview)).not.toContain('PREVIEW_SENTINEL');
  });
});

describe('audit trail', () => {
  it('records the lifecycle without content bodies', async () => {
    const id = await makePublishable();
    await transitionContent(id, 'publish', SUPER);

    const events = await prisma.audit_logs.findMany({ where: { actor_id: SUPER.id } });
    const actions = new Set(events.map((e) => e.action));

    expect(actions).toContain('content.created');
    expect(actions).toContain('content.submitted_for_review');
    expect(actions).toContain('content.approval_set');
    expect(actions).toContain('content.approved');
    expect(actions).toContain('content.published');

    for (const event of events) {
      const details = JSON.stringify(event.details ?? {});
      expect(details).not.toContain('"blocks"');
    }
  });

  it('exposes stable domain errors rather than raw Prisma errors', async () => {
    const error = await getContent(randomUUID()).catch((e) => e);
    expect(isContentHubError(error)).toBe(true);
    expect(error).toMatchObject({ statusCode: 404, code: 'CONTENT_NOT_FOUND' });
  });
});
