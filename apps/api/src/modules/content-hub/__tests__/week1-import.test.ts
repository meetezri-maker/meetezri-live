/**
 * Week 1 import mapping.
 *
 * Tests the workbook → CMS mapping and the importer's safety rules. Deliberately does NOT retest
 * cluster publishing, the state machine or the serializer — those are covered in Phase 2 and
 * Phase 5A and duplicating them here would only make both suites slower to trust.
 *
 * No database. The mapping is data, and the two functions under test are pure.
 */

import {
  ROUTE_REGISTRY,
  isRouteKey,
  validateContentBody,
  validateSlug,
  type ContentType,
} from '@meetezri/shared';
import {
  EXPECTED_CONTENT_EDGES,
  WEEK1_ASSETS,
  type Week1Asset,
} from '../week1/week1-content';
import {
  decideAction,
  validateAsset,
  type ExistingRow,
} from '../week1/week1-import.helpers';

const byRef = (ref: string): Week1Asset => {
  const asset = WEEK1_ASSETS.find((a) => a.editorialRef === ref);
  if (!asset) throw new Error(`no fixture for ${ref}`);
  return asset;
};

const blocksOfType = (asset: Week1Asset, type: string) =>
  asset.body.blocks.filter((block) => block.type === type);

const A001 = byRef('W1-A001');
const G001 = byRef('W1-G001');
const B001 = byRef('W1-B001');

// ─── The cluster ─────────────────────────────────────────────────────────────

describe('the Week 1 cluster', () => {
  it('is exactly three assets, one of each type', () => {
    expect(WEEK1_ASSETS).toHaveLength(3);
    expect(WEEK1_ASSETS.map((a) => a.editorialRef)).toEqual(['W1-A001', 'W1-G001', 'W1-B001']);
    expect(WEEK1_ASSETS.map((a) => a.contentType)).toEqual(['aeo_answer', 'geo_article', 'seo_blog']);
  });

  it('shares one pillar and one week', () => {
    for (const asset of WEEK1_ASSETS) {
      expect({ ref: asset.editorialRef, week: asset.week, pillar: asset.pillar }).toEqual({
        ref: asset.editorialRef,
        week: 1,
        pillar: 'Someone To Talk To',
      });
    }
  });

  it('declares exactly five content→content edges, matching the workbook graph', () => {
    const actual = WEEK1_ASSETS.flatMap((asset) =>
      asset.links
        .filter((link) => link.targetKind === 'content')
        .map((link) => [asset.editorialRef, link.targetRef!] as [string, string])
    );

    expect(actual).toHaveLength(5);
    expect(new Set(actual.map((e) => e.join('→')))).toEqual(
      new Set(EXPECTED_CONTENT_EDGES.map((e) => e.join('→')))
    );
  });

  it('is genuinely cyclic — no member can publish first on its own', () => {
    // This is WHY atomic cluster publishing exists: every asset is a link target of another.
    const targets = new Set(EXPECTED_CONTENT_EDGES.map(([, to]) => to));
    for (const asset of WEEK1_ASSETS) {
      expect({ ref: asset.editorialRef, isTarget: targets.has(asset.editorialRef) }).toEqual({
        ref: asset.editorialRef,
        isTarget: true,
      });
    }
  });

  it('never links an asset to itself', () => {
    for (const asset of WEEK1_ASSETS) {
      for (const link of asset.links) {
        expect(link.targetRef).not.toBe(asset.editorialRef);
      }
    }
  });

  it('uses only mapped route registry keys, never hard-coded URLs', () => {
    for (const asset of WEEK1_ASSETS) {
      for (const link of asset.links.filter((l) => l.targetKind === 'route')) {
        expect({ ref: asset.editorialRef, key: link.targetRoute, mapped: isRouteKey(link.targetRoute!) }).toEqual({
          ref: asset.editorialRef,
          key: link.targetRoute,
          mapped: true,
        });
        // No stored href — the registry resolves it.
        expect(link.targetRoute).not.toMatch(/^\//);
      }
    }
  });

  it('resolves the three expected routes to public destinations', () => {
    expect(ROUTE_REGISTRY['product.talk_it_out'].href).toBe('/how-it-works');
    expect(ROUTE_REGISTRY.resource_library.href).toBe('/resources');
    expect(ROUTE_REGISTRY.pricing.href).toBe('/pricing');
  });

  it('never points a link at an authenticated area', () => {
    for (const asset of WEEK1_ASSETS) {
      for (const link of asset.links.filter((l) => l.targetKind === 'route')) {
        const href = ROUTE_REGISTRY[link.targetRoute as keyof typeof ROUTE_REGISTRY].href;
        expect({ href, bad: /^\/(app|admin|onboarding)\b/.test(href) }).toEqual({ href, bad: false });
      }
    }
  });

  it('gives every asset a valid, unreserved, unique slug', () => {
    const slugs = WEEK1_ASSETS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(3);
    for (const asset of WEEK1_ASSETS) {
      expect({ ref: asset.editorialRef, valid: validateSlug(asset.slug).valid }).toEqual({
        ref: asset.editorialRef,
        valid: true,
      });
    }
  });

  it('every asset passes draft-level structural validation', () => {
    for (const asset of WEEK1_ASSETS) {
      const result = validateAsset(asset);
      expect({ ref: asset.editorialRef, errors: result.errors }).toEqual({
        ref: asset.editorialRef,
        errors: [],
      });
    }
  });

  it('gives every block a unique id across the whole cluster', () => {
    const ids = WEEK1_ASSETS.flatMap((a) => a.body.blocks.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries a safety notice on every asset', () => {
    for (const asset of WEEK1_ASSETS) {
      expect({ ref: asset.editorialRef, count: blocksOfType(asset, 'safety_notice').length }).toEqual({
        ref: asset.editorialRef,
        count: 1,
      });
    }
  });

  it('reports the editorial gaps rather than closing them silently', () => {
    expect(B001.missingFields.join(' ')).toMatch(/metaDescription/);
    expect(B001.authoredOutsideWorkbook.join(' ')).toMatch(/slug/);
    // The other two assets have complete workbook coverage.
    expect(A001.missingFields).toEqual([]);
    expect(G001.missingFields).toEqual([]);
    expect(A001.authoredOutsideWorkbook).toEqual([]);
    expect(G001.authoredOutsideWorkbook).toEqual([]);
  });
});

// ─── W1-A001 ─────────────────────────────────────────────────────────────────

describe('W1-A001 — the Answer', () => {
  it('has the workbook title, slug and type', () => {
    expect(A001.contentType).toBe('aeo_answer');
    expect(A001.publicLabel).toBe('Answer');
    expect(A001.title).toBe('What Should I Do When I Have Nobody to Talk To?');
    expect(A001.slug).toBe('what-should-i-do-when-i-have-nobody-to-talk-to');
  });

  it('uses the workbook meta description verbatim', () => {
    expect(A001.metaDescription).toBe(
      "If you feel like you have nobody to talk to, you're not alone. Learn healthy ways to express what you're carrying, process your thoughts, and find support when you need it most."
    );
  });

  it('leads with the direct answer, exactly once and first', () => {
    expect(A001.body.blocks[0].type).toBe('direct_answer');
    expect(blocksOfType(A001, 'direct_answer')).toHaveLength(1);
    expect((A001.body.blocks[0] as { content: Array<{ text: string }> }).content[0].text).toContain(
      'start by finding a safe way to express what'
    );
  });

  it('carries the workbook expression-forms list', () => {
    const list = A001.body.blocks.find((b) => b.id === 'a1-list-expression-forms') as {
      items: Array<Array<{ text: string }>>;
    };
    expect(list.items.map((item) => item[0].text)).toEqual([
      'Journaling',
      'Voice notes',
      'Writing letters you never send',
      'Talking through thoughts out loud',
      'Guided reflection exercises',
    ]);
  });

  it('promotes "If You Need Immediate Support" into a crisis safety notice, unchanged', () => {
    const notice = blocksOfType(A001, 'safety_notice')[0] as {
      variant: string;
      heading?: string;
      content: Array<{ text: string }>;
    };
    expect(notice.variant).toBe('crisis');
    expect(notice.heading).toBe('If You Need Immediate Support');
    expect(notice.content[0].text).toContain('contact local emergency services, a crisis line');
    expect(notice.content[0].text).toContain('Seeking support is a sign of strength.');
  });

  it('has exactly one FAQ block with the workbook’s five questions', () => {
    const faqs = blocksOfType(A001, 'faq');
    expect(faqs).toHaveLength(1);
    const items = (faqs[0] as { items: Array<{ question: string }> }).items;
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.question)).toEqual([
      'Is it normal to feel like I have nobody to talk to?',
      'Why do I feel more alone at night?',
      'Does talking about problems actually help?',
      "What if I don't want advice?",
      "What should I do if I'm overwhelmed?",
    ]);
  });

  it('carries the required AEO type fields', () => {
    expect(A001.typeFields.primary_question).toBe('What should I do when I have nobody to talk to?');
    expect(String(A001.typeFields.snippet_answer)).toContain('give your thoughts somewhere to go');
    expect(A001.typeFields.supporting_questions).toHaveLength(4);
  });

  it('has the four workbook links with their workbook anchors', () => {
    expect(A001.links).toHaveLength(4);
    expect(A001.links.map((l) => l.anchorText)).toEqual([
      'Someone To Talk To At Night',
      'Talk It Out',
      'Mental Wellness Resources',
      'Pricing',
    ]);
    expect(A001.links[0]).toMatchObject({ targetKind: 'content', targetRef: 'W1-B001' });
  });

  it('ends with a CTA to the Talk It Out route key', () => {
    const cta = blocksOfType(A001, 'cta')[0] as { target: { kind: string; value: string } };
    expect(cta.target).toEqual({ kind: 'route', value: 'product.talk_it_out' });
  });

  it('passes publish-level body validation', () => {
    const result = validateContentBody(A001.body, {
      contentType: A001.contentType as ContentType,
      forPublish: true,
    });
    expect(result.errors).toEqual([]);
  });
});

// ─── W1-G001 ─────────────────────────────────────────────────────────────────

describe('W1-G001 — the Insight', () => {
  it('has the workbook title, slug and type', () => {
    expect(G001.contentType).toBe('geo_article');
    expect(G001.publicLabel).toBe('Insight');
    expect(G001.title).toBe('Why Talking Through Thoughts Can Make Them Feel Lighter');
    expect(G001.slug).toBe('why-talking-through-thoughts-can-make-them-feel-lighter');
  });

  it('carries the workbook’s seven key statements, in order', () => {
    expect(G001.typeFields.key_statements).toEqual([
      'Thoughts often feel heavier when they remain unexpressed.',
      'Expression can change how a person experiences a thought.',
      'Verbal processing helps organize thinking.',
      'Reflection can create emotional clarity.',
      'Being heard can reduce emotional pressure.',
      'Understanding is not always the same as advice.',
      'Reflection helps people process experiences more effectively.',
    ]);
  });

  it('carries the required GEO type fields', () => {
    expect(G001.typeFields.core_concept).toBe('Talking through thoughts can reduce emotional pressure');
    expect(String(G001.typeFields.citation_summary)).toContain('expression creates distance');
    expect(G001.typeFields.supporting_concepts).toHaveLength(3);
  });

  it('has six GEO statement blocks, one per workbook section', () => {
    expect(blocksOfType(G001, 'geo_statement')).toHaveLength(6);
    expect(blocksOfType(G001, 'heading').filter((h) => (h as { level: number }).level === 2)).toHaveLength(7);
  });

  it('keeps coreMessage and citationGoal on the blocks where the serializer strips them', () => {
    const statements = blocksOfType(G001, "geo_statement") as unknown as Array<Record<string, unknown>>;
    // Present in storage…
    expect(statements[0].coreMessage).toBe(
      'When thoughts stay internal, they can loop repeatedly without resolution.'
    );
    expect(statements[0].citationGoal).toBe('Emotional processing, overthinking, reflection');

    // …and nowhere else in the document.
    for (const block of G001.body.blocks as unknown as Array<Record<string, unknown>>) {
      if (block.type === 'geo_statement') continue;
      expect({ id: block.id, hasCore: 'coreMessage' in block }).toEqual({ id: block.id, hasCore: false });
      expect({ id: block.id, hasGoal: 'citationGoal' in block }).toEqual({ id: block.id, hasGoal: false });
    }
  });

  it('preserves the workbook’s public statement, example and clarification fields', () => {
    const statements = blocksOfType(G001, 'geo_statement') as Array<Record<string, any>>;
    expect(statements[1].examples).toEqual(['Speaking, journaling, voice notes, guided reflection']);
    expect(statements[3].clarification[0].text).toBe(
      'Understanding and advice are not always the same thing.'
    );
  });

  it('promotes the section 6 clarification into a disclaimer safety notice, unchanged', () => {
    const notice = blocksOfType(G001, 'safety_notice')[0] as {
      variant: string;
      content: Array<{ text: string }>;
    };
    expect(notice.variant).toBe('disclaimer');
    expect(notice.content[0].text).toBe(
      'Expression is not a replacement for professional support when needed.'
    );
  });

  it('has no FAQ block — the workbook supplies none', () => {
    expect(blocksOfType(G001, 'faq')).toHaveLength(0);
  });

  it('has the four workbook links', () => {
    expect(G001.links).toHaveLength(4);
    expect(G001.links.filter((l) => l.targetKind === 'content').map((l) => l.targetRef)).toEqual([
      'W1-B001',
      'W1-A001',
    ]);
  });

  it('passes publish-level body validation', () => {
    const result = validateContentBody(G001.body, {
      contentType: G001.contentType as ContentType,
      forPublish: true,
    });
    expect(result.errors).toEqual([]);
  });
});

// ─── W1-B001 ─────────────────────────────────────────────────────────────────

describe('W1-B001 — the Article', () => {
  it('has the workbook title and type', () => {
    expect(B001.contentType).toBe('seo_blog');
    expect(B001.publicLabel).toBe('Article');
    expect(B001.title).toBe('Someone to Talk to at Night When Everything Feels Loud');
  });

  it('uses the approved authored slug, and says so', () => {
    expect(B001.slug).toBe('someone-to-talk-to-at-night');
    expect(B001.authoredOutsideWorkbook).toHaveLength(1);
    expect(B001.authoredOutsideWorkbook[0]).toContain('someone-to-talk-to-at-night');
  });

  it('LEAVES the meta description null rather than inventing one', () => {
    // The whole point: a manufactured meta description would turn the checklist green and hide a
    // real editorial decision that a human has to make.
    expect(B001.metaDescription).toBeNull();
    expect(validateAsset(B001).publishBlockers.join(' ')).toMatch(/meta_description is missing/);
  });

  it('still imports cleanly as a draft despite the missing meta description', () => {
    expect(validateAsset(B001).errors).toEqual([]);
  });

  it('has exactly one FAQ block with the workbook’s six questions', () => {
    const faqs = blocksOfType(B001, 'faq');
    expect(faqs).toHaveLength(1);
    const items = (faqs[0] as { items: Array<{ question: string }> }).items;
    expect(items).toHaveLength(6);
    expect(items[0].question).toBe('Why do my thoughts get louder at night?');
    expect(items[5].question).toBe('How can I process emotions in a healthy way?');
  });

  it('extracts the safety notice from FAQ #2 without altering the FAQ answer', () => {
    const faq = blocksOfType(B001, 'faq')[0] as {
      items: Array<{ question: string; answer: Array<{ text: string }> }>;
    };
    const answer = faq.items[1].answer[0].text;
    expect(answer).toContain('journaling, voice notes, reflection exercises');
    expect(answer).toContain("If you're in distress, seek support from a trusted person");

    const notice = blocksOfType(B001, 'safety_notice')[0] as {
      variant: string;
      content: Array<{ text: string }>;
    };
    expect(notice.variant).toBe('crisis');
    // Verbatim from the FAQ answer — no added medical or crisis language.
    expect(answer).toContain(notice.content[0].text);
  });

  it('keeps the H3 subsections of the Healthy Ways section', () => {
    const h3s = blocksOfType(B001, 'heading').filter((h) => (h as { level: number }).level === 3);
    const titles = h3s.map((h) => (h as { content: Array<{ text: string }> }).content[0].text);
    expect(titles).toEqual([
      'Journaling',
      'Voice Notes',
      'Reflection Questions',
      'Trusted Conversations',
      'Guided Reflection Tools',
    ]);
  });

  it('ends on the workbook’s Final Thought', () => {
    const last = B001.body.blocks[B001.body.blocks.length - 1] as { content: Array<{ text: string }> };
    expect(last.content[0].text).toBe("And sometimes, that's where clarity begins.");
  });

  it('carries the SEO type fields including the workbook word-count target', () => {
    expect(B001.typeFields.primary_keyword).toBe('someone to talk to at night');
    expect(B001.typeFields.word_count_target).toBe('2,200–2,500');
    expect(B001.typeFields.funnel_stage).toBe('Awareness');
  });

  it('has five links, with null anchors so the renderer uses the target title', () => {
    expect(B001.links).toHaveLength(5);
    expect(B001.links.every((l) => l.anchorText === null)).toBe(true);
    expect(B001.links.filter((l) => l.targetKind === 'content').map((l) => l.targetRef)).toEqual([
      'W1-A001',
      'W1-G001',
    ]);
    expect(B001.links.filter((l) => l.targetKind === 'route').map((l) => l.targetRoute)).toEqual([
      'product.talk_it_out',
      'resource_library',
      'pricing',
    ]);
  });

  it('passes publish-level body validation', () => {
    const result = validateContentBody(B001.body, {
      contentType: B001.contentType as ContentType,
      forPublish: true,
    });
    expect(result.errors).toEqual([]);
  });
});

// ─── Importer safety rules ───────────────────────────────────────────────────

describe('re-run safety', () => {
  const row = (overrides: Partial<ExistingRow> = {}): ExistingRow => ({
    id: 'existing-id',
    status: 'draft',
    title: 'Whatever',
    slug: 'a-slug',
    content_type: 'aeo_answer',
    current_revision_number: 0,
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  });

  it('creates when nothing exists', () => {
    expect(decideAction(null)).toEqual({ action: 'create' });
  });

  it('updates an untouched prior import', () => {
    expect(decideAction(row())).toEqual({ action: 'update' });
  });

  it('REFUSES to overwrite a published record', () => {
    const decision = decideAction(row({ status: 'published' }));
    expect(decision.action).toBe('skip-conflict');
    expect(decision.reason).toMatch(/refusing to overwrite/);
  });

  it('refuses any non-draft status, not just published', () => {
    for (const status of ['in_review', 'changes_requested', 'approved', 'unpublished', 'archived']) {
      expect({ status, action: decideAction(row({ status })).action }).toEqual({
        status,
        action: 'skip-conflict',
      });
    }
  });

  it('REFUSES a draft that has been hand-edited in the CMS', () => {
    // A revision means someone saved it explicitly through the editor.
    const decision = decideAction(row({ current_revision_number: 2 }));
    expect(decision.action).toBe('skip-conflict');
    expect(decision.reason).toMatch(/edited in the CMS/);
  });

  it('refuses a soft-deleted record rather than resurrecting it', () => {
    const decision = decideAction(row({ deleted_at: new Date() }));
    expect(decision.action).toBe('skip-conflict');
    expect(decision.reason).toMatch(/soft-deleted/);
  });

  it('identifies records by editorial ref, never by title', () => {
    // A title change must not create a duplicate, and an unrelated record with the same title
    // must not be mistaken for a prior import.
    expect(decideAction(row({ title: 'A completely different title' }))).toEqual({ action: 'update' });
  });
});

describe('the importer never bypasses the workflow', () => {
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', '..', '..', 'scripts', 'content-hub', 'import-week1.ts'),
    'utf8'
  ) as string;
  const code = source
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
    .join('\n');

  it('never writes a status directly', () => {
    expect(code).not.toMatch(/status:\s*['"]/);
    expect(code).not.toMatch(/content_items\.update/);
    expect(code).not.toMatch(/content_items\.create/);
  });

  it('never approves a gate', () => {
    expect(code).not.toContain('setApprovalGate');
    expect(code).not.toMatch(/_approval/);
  });

  it('never publishes', () => {
    expect(code).not.toContain('publishCluster');
    expect(code).not.toContain('transitionContent');
    expect(code).not.toContain('publishContent');
  });

  it('writes only through the service layer', () => {
    expect(code).toContain('createContent');
    expect(code).toContain('updateContent');
    expect(code).toContain('replaceLinks');
  });

  it('defaults to a dry run and demands an explicit production confirmation', () => {
    expect(code).toContain("argv.includes('--apply')");
    expect(code).toContain("argv.includes('--confirm-production')");
    expect(code).toMatch(/looksProduction && !CONFIRM_PRODUCTION/);
  });

  it('requires an attributable actor before it will write', () => {
    expect(code).toMatch(/APPLY && !actor/);
  });

  it('does not run on import — only when invoked directly', () => {
    expect(code).toContain('require.main === module');
  });
});
