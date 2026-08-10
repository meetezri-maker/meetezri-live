/**
 * Approval gates against REAL PostgreSQL.
 *
 * Written after a production report of a 500 when saving an approval. The service path could not
 * be reproduced as broken, so these tests pin every branch of it — including the one branch the
 * first two approvals never reach: the FINAL gate, which transitions the item to `approved` and
 * is the only path that captures a revision.
 *
 * Real database, real transaction, real audit writes. A mock could not prove the atomicity these
 * assertions depend on.
 */

import { randomUUID } from 'crypto';
import { APPROVAL_GATES, VALID_AEO_BODY } from '@meetezri/shared';
import prisma from '../../../lib/prisma';
import { isContentHubError } from '../content-hub.errors';
import { setApprovalGate, transitionContent } from '../content-hub.publish.service';
import { createContent, updateContent, type Actor } from '../content-hub.service';

jest.setTimeout(60_000);

const createdContentIds: string[] = [];
const createdProfileIds: string[] = [];

let SUPER: Actor;
let ORG: Actor;
let TEAM: Actor;

async function makeProfile(role: string): Promise<string> {
  const id = randomUUID();
  const email = `appr-${id.slice(0, 8)}@integration.test`;
  await prisma.users.create({ data: { id, email, is_sso_user: false, is_anonymous: false } });
  // `select` is required — `profiles.signup_source` is declared in schema.prisma but created by
  // no Prisma migration (documented drift).
  await prisma.profiles.create({ data: { id, email, full_name: `Approver ${role}` }, select: { id: true } });
  createdProfileIds.push(id);
  return id;
}

/** An item shaped like a real Week 1 record: in_review, all gates pending, no author. */
async function makeInReviewItem(title: string): Promise<string> {
  const created = await createContent(
    { contentType: 'aeo_answer', title: `${title} ${randomUUID().slice(0, 8)}` } as never,
    SUPER
  );
  createdContentIds.push(created.id);

  const fresh = await prisma.content_items.findUniqueOrThrow({ where: { id: created.id } });
  await updateContent(
    created.id,
    {
      body: VALID_AEO_BODY,
      metaDescription: 'A meta description comfortably inside the fifty to one sixty range.',
      expectedUpdatedAt: fresh.updated_at.toISOString(),
      createRevision: false,
    } as never,
    SUPER
  );

  await transitionContent(created.id, 'submit', SUPER);
  return created.id;
}

const readItem = (id: string) =>
  prisma.content_items.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      founder_approval: true,
      marketing_approval: true,
      seo_approval: true,
      current_revision_number: true,
    },
  });

const approvalAudits = (contentId: string) =>
  prisma.audit_logs.count({
    where: { action: 'content.approval_set', details: { path: ['contentId'], equals: contentId } },
  });

beforeAll(async () => {
  SUPER = { id: await makeProfile('super'), role: 'super_admin' };
  ORG = { id: await makeProfile('org'), role: 'org_admin' };
  TEAM = { id: await makeProfile('team'), role: 'team_admin' };
});

afterAll(async () => {
  if (createdContentIds.length > 0) {
    await prisma.content_links.deleteMany({ where: { source_id: { in: createdContentIds } } });
    await prisma.content_items.deleteMany({ where: { id: { in: createdContentIds } } });
  }
  if (createdProfileIds.length > 0) {
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: createdProfileIds } } });
    await prisma.profiles.deleteMany({ where: { id: { in: createdProfileIds } } });
    await prisma.users.deleteMany({ where: { id: { in: createdProfileIds } } });
  }
});

// ─── Individual gates ────────────────────────────────────────────────────────

describe('each gate can be approved on an in_review item', () => {
  it.each([...APPROVAL_GATES])('approves %s and leaves the status at in_review', async (gate) => {
    const id = await makeInReviewItem('Single gate');

    const result = await setApprovalGate(id, gate as never, 'approved', SUPER);

    const row = await readItem(id);
    expect((row as unknown as Record<string, string>)[`${gate}_approval`]).toBe('approved');
    // Only the LAST gate may move the status.
    expect(row.status).toBe('in_review');
    expect(result.status).toBe('in_review');
    expect(await approvalAudits(id)).toBe(1);
  });

  it('keeps the status at in_review after the first TWO gates', async () => {
    const id = await makeInReviewItem('Two gates');

    await setApprovalGate(id, 'founder' as never, 'approved', SUPER);
    await setApprovalGate(id, 'seo' as never, 'approved', SUPER);

    const row = await readItem(id);
    expect(row.status).toBe('in_review');
    expect(row.marketing_approval).toBe('pending');
    expect(await approvalAudits(id)).toBe(2);
  });
});

// ─── The final gate — the branch the bug report points at ────────────────────

describe('the FINAL gate transitions the item to approved', () => {
  it('moves to approved, captures a revision and writes the audit trail', async () => {
    const id = await makeInReviewItem('Final gate');
    const before = await readItem(id);

    await setApprovalGate(id, 'founder' as never, 'approved', SUPER);
    await setApprovalGate(id, 'seo' as never, 'approved', SUPER);

    // Marketing last — exactly the operation reported as failing.
    const result = await setApprovalGate(id, 'marketing' as never, 'approved', SUPER);

    const after = await readItem(id);
    expect(after.status).toBe('approved');
    expect(result.status).toBe('approved');
    expect([after.founder_approval, after.marketing_approval, after.seo_approval]).toEqual([
      'approved',
      'approved',
      'approved',
    ]);

    // Only the final gate captures a revision.
    expect(after.current_revision_number).toBe(before.current_revision_number + 1);
    const revision = await prisma.content_revisions.findFirstOrThrow({
      where: { content_id: id },
      orderBy: { revision_number: 'desc' },
    });
    expect(revision.status_at_capture).toBe('approved');
    expect(revision.change_summary).toBe('All gates approved');

    expect(await approvalAudits(id)).toBe(3);
    expect(
      await prisma.audit_logs.count({
        where: { action: 'content.approved', details: { path: ['contentId'], equals: id } },
      })
    ).toBe(1);
  });

  it('works with a large body, as on the 133-block Week 1 article', async () => {
    // The final gate snapshots the whole body into `content_revisions`; a large document is the
    // case most likely to behave differently, so it is exercised explicitly.
    const id = await makeInReviewItem('Large body');
    const fresh = await prisma.content_items.findUniqueOrThrow({ where: { id } });
    const big = {
      version: 1,
      blocks: [
        ...VALID_AEO_BODY.blocks,
        ...Array.from({ length: 130 }, (_, i) => ({
          id: `filler-${i}`,
          type: 'paragraph' as const,
          content: [{ text: `Paragraph ${i} with enough words to be worth snapshotting.` }],
        })),
      ],
    };
    await updateContent(
      id,
      { body: big, expectedUpdatedAt: fresh.updated_at.toISOString(), createRevision: false } as never,
      SUPER
    );

    for (const gate of APPROVAL_GATES) {
      await setApprovalGate(id, gate as never, 'approved', SUPER);
    }

    const row = await readItem(id);
    expect(row.status).toBe('approved');

    const revision = await prisma.content_revisions.findFirstOrThrow({
      where: { content_id: id },
      orderBy: { revision_number: 'desc' },
    });
    // The snapshot is the whole row, so the body sits one level down.
    const snapshot = revision.snapshot as { body: { blocks: unknown[] } };
    expect(snapshot.body.blocks).toHaveLength(big.blocks.length);
  });
});

// ─── Other states ────────────────────────────────────────────────────────────

describe('other approval states', () => {
  it('resets an approved gate back to pending', async () => {
    const id = await makeInReviewItem('Reset');
    await setApprovalGate(id, 'marketing' as never, 'approved', SUPER);
    await setApprovalGate(id, 'marketing' as never, 'pending', SUPER);

    const row = await readItem(id);
    expect(row.marketing_approval).toBe('pending');
    expect(row.status).toBe('in_review');
  });

  it('sends the item to changes_requested', async () => {
    const id = await makeInReviewItem('Changes');
    const result = await setApprovalGate(id, 'marketing' as never, 'changes_requested', SUPER);

    const row = await readItem(id);
    expect(row.marketing_approval).toBe('changes_requested');
    expect(row.status).toBe('changes_requested');
    expect(result.status).toBe('changes_requested');
  });

  it('returns an approved item to in_review when an approval is withdrawn', async () => {
    const id = await makeInReviewItem('Withdraw');
    for (const gate of APPROVAL_GATES) await setApprovalGate(id, gate as never, 'approved', SUPER);
    expect((await readItem(id)).status).toBe('approved');

    await setApprovalGate(id, 'seo' as never, 'pending', SUPER);

    const row = await readItem(id);
    expect(row.status).toBe('in_review');
    expect(row.seo_approval).toBe('pending');
  });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

describe('the optional note never causes a failure', () => {
  it.each([
    ['omitted', undefined],
    ['empty', ''],
    ['normal', 'Looks good to me.'],
    ['long but valid', 'x'.repeat(500)],
  ])('accepts a %s note', async (_label, note) => {
    const id = await makeInReviewItem('Note');
    await expect(
      setApprovalGate(id, 'marketing' as never, 'approved', SUPER, note as never)
    ).resolves.toBeDefined();
    expect((await readItem(id)).marketing_approval).toBe('approved');
  });

  it('records a supplied note in the audit details', async () => {
    const id = await makeInReviewItem('Note audit');
    await setApprovalGate(id, 'marketing' as never, 'approved', SUPER, 'Checked the wording.');

    const audit = await prisma.audit_logs.findFirstOrThrow({
      where: { action: 'content.approval_set', details: { path: ['contentId'], equals: id } },
    });
    expect((audit.details as Record<string, unknown>).note).toBe('Checked the wording.');
  });
});

// ─── Roles ───────────────────────────────────────────────────────────────────

describe('role enforcement', () => {
  it('allows super_admin', async () => {
    const id = await makeInReviewItem('Role super');
    await expect(setApprovalGate(id, 'marketing' as never, 'approved', SUPER)).resolves.toBeDefined();
  });

  it('allows org_admin', async () => {
    const id = await makeInReviewItem('Role org');
    await expect(setApprovalGate(id, 'marketing' as never, 'approved', ORG)).resolves.toBeDefined();
  });

  it('rejects team_admin with 403, NOT 500', async () => {
    const id = await makeInReviewItem('Role team');

    await expect(setApprovalGate(id, 'marketing' as never, 'approved', TEAM)).rejects.toMatchObject({
      statusCode: 403,
    });
    // And it is a domain error, so the controller maps it to 403 rather than rethrowing as 500.
    await setApprovalGate(id, 'marketing' as never, 'approved', TEAM).catch((error: unknown) => {
      expect(isContentHubError(error)).toBe(true);
    });

    // And nothing was written.
    expect((await readItem(id)).marketing_approval).toBe('pending');
    expect(await approvalAudits(id)).toBe(0);
  });
});

// ─── Atomicity ───────────────────────────────────────────────────────────────

describe('nothing partially persists', () => {
  it('leaves no gate/status disagreement on an unknown content id', async () => {
    await expect(
      setApprovalGate(randomUUID(), 'marketing' as never, 'approved', SUPER)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('never leaves all gates approved while the status lags behind', async () => {
    const id = await makeInReviewItem('Consistency');
    for (const gate of APPROVAL_GATES) await setApprovalGate(id, gate as never, 'approved', SUPER);

    const row = await readItem(id);
    const allApproved = [row.founder_approval, row.marketing_approval, row.seo_approval].every(
      (g) => g === 'approved'
    );
    expect({ allApproved, status: row.status }).toEqual({ allApproved: true, status: 'approved' });
  });
});
