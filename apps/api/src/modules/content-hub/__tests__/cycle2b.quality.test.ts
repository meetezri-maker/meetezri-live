import { relatedClusterSlugs, resourceClusterKeysForSlug } from '@meetezri/shared';
import {
  CYCLE_2B_CONTEXTUAL_LINKS,
  CYCLE_2B_REPLACEMENTS,
  CYCLE_2B_TRANSACTION_OPTIONS,
  CYCLE_2B_TRANSACTION_QUERY_BUDGET,
  FAQ_AUTHORITY_REPORT,
  applyExactReplacement,
  planExactReplacements,
} from '../cycle2b-remediation';
import {
  auditResourceMetadata,
  findEditorialResidue,
  validatePublicReview,
} from '../content-hub.quality';

describe('Cycle 2B publishing safeguards', () => {
  it('reports missing, title-only and exact duplicate metadata', () => {
    const findings = auditResourceMetadata([
      { slug: 'a', seoTitle: 'Same', metaDescription: 'Same' },
      { slug: 'b', seoTitle: 'Same', metaDescription: null },
      { slug: 'c', seoTitle: 'Unique', metaDescription: 'Repeated' },
      { slug: 'd', seoTitle: 'Other', metaDescription: 'Repeated' },
    ]);
    expect(findings.map((finding) => finding.rule)).toEqual(expect.arrayContaining([
      'duplicate-meta-description',
      'duplicate-seo-title',
      'missing-meta-description',
      'title-only-meta-description',
    ]));
  });

  it('detects reader-visible editorial residue', () => {
    expect(findEditorialResidue({ body: 'This is a key Week 3 idea.' })).toEqual([
      'This is a key Week 3 idea',
    ]);
  });

  it('requires both an approved reviewer identity and review date', () => {
    expect(validatePublicReview({
      reviewerName: 'Unapproved person',
      reviewedAt: null,
      reviewerApproved: false,
    })).toEqual(['reviewer-requires-approved-identity-and-date']);
  });

  it('applies exact replacements once and then reports idempotence', () => {
    const replacement = {
      slug: 'example',
      field: 'body' as const,
      oldValue: 'old',
      newValue: 'new',
    };
    const first = applyExactReplacement({ blocks: [{ text: 'old' }] }, replacement);
    expect(first).toEqual({ state: 'change', value: { blocks: [{ text: 'new' }] } });
    expect(applyExactReplacement(first.value, replacement).state).toBe('already-applied');
    expect(() => applyExactReplacement({ blocks: [{ text: 'unexpected' }] }, replacement)).toThrow(

      'baseline mismatch'
    );
  });
  it('combines multiple replacements for one field without overwriting an earlier change', () => {
    const plan = planExactReplacements(
      {
        body: { blocks: [{ id: 'one', text: 'old one' }, { id: 'two', text: 'old two' }] },
        type_fields: {},
        meta_description: null,
      },
      [
        { slug: 'example', field: 'body', blockId: 'one', oldValue: 'old one', newValue: 'new one' },
        { slug: 'example', field: 'body', blockId: 'two', oldValue: 'old two', newValue: 'new two' },
      ]
    );
    expect(plan.changedFields).toEqual(['body']);
    expect(plan.values.body).toEqual({
      blocks: [{ id: 'one', text: 'new one' }, { id: 'two', text: 'new two' }],
    });
  });

  it('scopes an exact replacement to one block when identical text exists in other blocks', () => {
    const body = {
      blocks: [
        { id: 'first', type: 'heading', content: [{ text: 'Repeated heading' }] },
        { id: 'second', type: 'heading', content: [{ text: 'Repeated heading' }] },
        { id: 'third', type: 'heading', content: [{ text: 'Repeated heading' }] },
      ],
    };
    const result = applyExactReplacement(body, {
      slug: 'example',
      field: 'body',
      blockId: 'first',
      oldValue: 'Repeated heading',
      newValue: 'First replacement',
    });

    expect(result).toEqual({
      state: 'change',
      value: {
        blocks: [
          { id: 'first', type: 'heading', content: [{ text: 'First replacement' }] },
          { id: 'second', type: 'heading', content: [{ text: 'Repeated heading' }] },
          { id: 'third', type: 'heading', content: [{ text: 'Repeated heading' }] },
        ],
      },
    });
  });

  it('updates separate blocks with identical text independently', () => {
    const plan = planExactReplacements(
      {
        body: {
          blocks: [
            { id: 'first', text: 'Repeated heading' },
            { id: 'second', text: 'Repeated heading' },
            { id: 'third', text: 'Repeated heading' },
          ],
        },
        type_fields: {},
        meta_description: null,
      },
      ['first', 'second', 'third'].map((blockId, index) => ({
        slug: 'example',
        field: 'body' as const,
        blockId,
        oldValue: 'Repeated heading',
        newValue: `Replacement ${index + 1}`,
      }))
    );

    expect(plan.values.body).toEqual({
      blocks: [
        { id: 'first', text: 'Replacement 1' },
        { id: 'second', text: 'Replacement 2' },
        { id: 'third', text: 'Replacement 3' },
      ],
    });
  });

  it.each([
    ['a missing block', { blocks: [{ id: 'other', text: 'old' }] }],
    ['a duplicated block ID', { blocks: [{ id: 'target', text: 'old' }, { id: 'target', text: 'old' }] }],
    ['zero matches in the target block', { blocks: [{ id: 'target', text: 'unexpected' }] }],
    ['multiple matches in the target block', { blocks: [{ id: 'target', content: [{ text: 'old' }, { text: 'old' }] }] }],
  ])('rejects block-scoped replacement with %s', (_case, body) => {
    expect(() => applyExactReplacement(body, {
      slug: 'example',
      field: 'body',
      blockId: 'target',
      oldValue: 'old',
      newValue: 'new',
    })).toThrow('baseline mismatch');
  });

  it('keeps an already-correct block-scoped replacement idempotent', () => {
    const body = { blocks: [{ id: 'target', text: 'new' }, { id: 'other', text: 'old' }] };
    const result = applyExactReplacement(body, {
      slug: 'example',
      field: 'body',
      blockId: 'target',
      oldValue: 'old',
      newValue: 'new',
    });

    expect(result).toEqual({ state: 'already-applied', value: body });
  });

  it('keeps the approved small-things remediation definitions unchanged', () => {
    expect(CYCLE_2B_REPLACEMENTS).toHaveLength(13);
    expect(CYCLE_2B_REPLACEMENTS.filter(({ slug }) => slug === 'why-do-i-keep-thinking-about-small-things')).toEqual([
      { slug: 'why-do-i-keep-thinking-about-small-things', field: 'body', oldValue: 'Week 3 Connection', blockId: 'm3a-h28', newValue: 'A Familiar Example' },
      { slug: 'why-do-i-keep-thinking-about-small-things', field: 'body', blockId: 'm3a-h56', oldValue: 'Week 3 Connection', newValue: 'Why Quiet Moments Bring Thoughts Back' },
      { slug: 'why-do-i-keep-thinking-about-small-things', field: 'body', blockId: 'm3a-h70', oldValue: 'Week 3 Connection', newValue: 'When an Intention Feels Like an Action' },
      { slug: 'why-do-i-keep-thinking-about-small-things', field: 'body', blockId: 'm3a-p57', oldValue: 'Directly supports R006.', newValue: 'When activity slows down, unfinished thoughts can become easier to notice.' },
      { slug: 'why-do-i-keep-thinking-about-small-things', field: 'body', blockId: 'm3a-p71', oldValue: 'Direct support for R002.', newValue: 'Mentally composing a reply can make the response feel more complete than it is.' },
      { slug: 'why-do-i-keep-thinking-about-small-things', field: 'body', oldValue: 'This aligns directly with R004:', newValue: 'You may rehearse a conversation many times even when the conversation itself is brief.' },
    ]);
  });

  it('defines contextual links for every known Resource with no self-links', () => {
    expect(Object.keys(CYCLE_2B_CONTEXTUAL_LINKS)).toHaveLength(24);
    for (const [source, targets] of Object.entries(CYCLE_2B_CONTEXTUAL_LINKS)) {
      expect(targets).toHaveLength(2);
      expect(targets.some((target) => target.targetSlug === source)).toBe(false);
      expect(new Set(targets.map((target) => target.targetSlug)).size).toBe(targets.length);

    }
  });


  it('keeps remediation dry-run by default and gates every mutation path', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'scripts',
        'content-hub',
        'remediate-cycle2b.ts'
      ),
      'utf8'
    ) as string;
    expect(source).toContain("const apply = args.has('--apply')");
    expect(source).toContain('if (!apply) return');
    expect(source).toContain('if (apply && (!confirmed || !actorId))');
    expect(source).toContain('--confirm-production');
    expect(source).toContain('--actor=<approved-super-admin-profile-id>');
  });

  it('bounds the single transaction for the complete approved query budget', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'scripts',
        'content-hub',
        'remediate-cycle2b.ts'
      ),
      'utf8'
    ) as string;

    expect(CYCLE_2B_TRANSACTION_QUERY_BUDGET).toBe(114);
    expect(CYCLE_2B_TRANSACTION_OPTIONS).toEqual({ maxWait: 10_000, timeout: 120_000 });
    expect(CYCLE_2B_TRANSACTION_OPTIONS.timeout).toBeGreaterThanOrEqual(
      CYCLE_2B_TRANSACTION_QUERY_BUDGET * 1_000
    );
    expect(source.match(/prisma\.\$transaction\(/g)).toHaveLength(1);
    expect(source).toContain('maxWait: CYCLE_2B_TRANSACTION_OPTIONS.maxWait');
    expect(source).toContain('timeout: CYCLE_2B_TRANSACTION_OPTIONS.timeout');
  });

  it('keeps content, links, revisions and audits inside the same transaction client', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'scripts', 'content-hub', 'remediate-cycle2b.ts'),
      'utf8'
    );
    const transactionStart = source.indexOf('await prisma.$transaction');
    const beforeTransaction = source.slice(0, transactionStart);
    const transaction = source.slice(transactionStart);
    const revision = fs.readFileSync(path.join(__dirname, '..', 'content-hub.revision.ts'), 'utf8');
    const audit = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'lib', 'auditLog.ts'), 'utf8');

    expect(beforeTransaction).not.toMatch(/prisma\.(content_items|content_links|content_revisions|audit_logs)\.(update|create|delete)/);
    expect(transaction).toContain('loadBaseline(tx as typeof prisma)');
    expect(transaction).toContain('validateContextualState(tx as typeof prisma');
    expect(transaction).toContain('await tx.content_items.update');
    expect(transaction).toContain('await captureRevision(tx');
    expect(transaction).toContain('await tx.content_links.deleteMany');
    expect(transaction).toContain('await tx.content_links.createMany');
    expect(transaction.match(/writeAuditLog\([\s\S]*?\{ tx \}\);/g)).toHaveLength(2);
    expect(transaction).not.toContain('Promise.all');
    expect(transaction).not.toContain('fetch(');
    expect(source.match(/prisma\.\$transaction\(/g)).toHaveLength(1);
    expect(revision).toContain('await tx.content_items.update');
    expect(revision).toContain('await tx.content_revisions.create');
    expect(audit).toContain('const client: PrismaClientLike = tx ?? prisma');
    expect(audit).toContain('const swallowErrors = tx ? false');
  });

  it('keeps cluster recommendations deterministic and excludes the current page', () => {
    const slug = 'small-daily-habits-vs-motivation';
    expect(resourceClusterKeysForSlug(slug)).toEqual(['habits_and_consistency']);
    expect(relatedClusterSlugs(slug)).toEqual([
      'questions-about-small-daily-habits-motivation-and-consistency',
      'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time',
    ]);
    expect(relatedClusterSlugs(slug)).not.toContain(slug);
    expect(relatedClusterSlugs(slug)).not.toContain('why-do-i-keep-replaying-conversations-in-my-head');
  });

  it('assigns one authoritative Resource for each audited FAQ question', () => {
    expect(FAQ_AUTHORITY_REPORT).toHaveLength(7);
    expect(new Set(FAQ_AUTHORITY_REPORT.map(([question]) => question)).size).toBe(7);
  });
});

