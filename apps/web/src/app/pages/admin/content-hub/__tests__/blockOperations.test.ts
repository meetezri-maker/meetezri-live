/**
 * Block document operations.
 *
 * Pure functions, so these run without rendering. The stable-id assertions matter most: ids key
 * React lists, survive reordering, and are what will make block-level revision diffing possible.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT_LIMITS, type ContentBody } from '@meetezri/shared';
import {
  BLOCK_LABEL,
  addBlock,
  blockAddBlocker,
  canMove,
  createBlock,
  duplicateBlock,
  emptyBody,
  moveBlock,
  newBlockId,
  paletteFor,
  removeBlock,
  updateBlock,
} from '../editor/blockOperations';

const body = (...types: Parameters<typeof createBlock>[0][]): ContentBody => ({
  version: 1,
  blocks: types.map((type) => createBlock(type)),
});

describe('palette', () => {
  it('offers every enabled block for an Article', () => {
    const palette = paletteFor('seo_blog');
    for (const type of ['paragraph', 'heading', 'list', 'quote', 'key_takeaway', 'safety_notice', 'cta', 'divider', 'related_content', 'faq', 'table', 'source'] as const) {
      expect(palette).toContain(type);
    }
  });

  it('NEVER offers the image block — schema-supported but editor-disabled in v1', () => {
    for (const type of ['aeo_answer', 'geo_article', 'seo_blog'] as const) {
      expect(paletteFor(type)).not.toContain('image');
    }
  });

  it('restricts direct_answer to Answers and geo_statement to Insights', () => {
    expect(paletteFor('aeo_answer')).toContain('direct_answer');
    expect(paletteFor('seo_blog')).not.toContain('direct_answer');
    expect(paletteFor('geo_article')).not.toContain('direct_answer');

    expect(paletteFor('geo_article')).toContain('geo_statement');
    expect(paletteFor('aeo_answer')).not.toContain('geo_statement');
    expect(paletteFor('seo_blog')).not.toContain('geo_statement');
  });

  it('labels every offered block', () => {
    for (const type of paletteFor('seo_blog')) {
      expect(BLOCK_LABEL[type]).toBeTruthy();
    }
  });
});

describe('ids', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newBlockId()));
    expect(ids.size).toBe(200);
  });

  it('keeps ids stable through edits, moves and neighbour removal', () => {
    let doc = body('paragraph', 'heading', 'list');
    const ids = doc.blocks.map((b) => b.id);

    doc = updateBlock(doc, ids[0], { ...doc.blocks[0], content: [{ text: 'changed' }] } as never);
    doc = moveBlock(doc, ids[2], 'up');
    doc = removeBlock(doc, ids[1]);

    // The two surviving blocks kept their original ids.
    expect(doc.blocks.map((b) => b.id).sort()).toEqual([ids[0], ids[2]].sort());
  });

  it('gives a duplicate a NEW id and leaves the original alone', () => {
    const doc = body('paragraph');
    const originalId = doc.blocks[0].id;
    const next = duplicateBlock(doc, originalId);

    expect(next.blocks).toHaveLength(2);
    expect(next.blocks[0].id).toBe(originalId);
    expect(next.blocks[1].id).not.toBe(originalId);
  });
});

describe('add', () => {
  it('appends to the end', () => {
    const doc = addBlock(body('paragraph'), 'quote');
    expect(doc.blocks[1].type).toBe('quote');
  });

  it('always pins a direct answer to position 0', () => {
    let doc = body('paragraph', 'heading');
    doc = addBlock(doc, 'direct_answer');
    expect(doc.blocks[0].type).toBe('direct_answer');
  });

  it('never inserts above a pinned direct answer', () => {
    let doc = body('direct_answer', 'paragraph');
    doc = addBlock(doc, 'quote', 0);
    expect(doc.blocks[0].type).toBe('direct_answer');
    expect(doc.blocks[1].type).toBe('quote');
  });

  it('blocks a second FAQ, direct answer, or over-limit CTA', () => {
    expect(blockAddBlocker(body('faq'), 'faq')).toMatch(/only one FAQ/i);
    expect(blockAddBlocker(body('direct_answer'), 'direct_answer')).toMatch(/only one direct answer/i);
    expect(blockAddBlocker(body('cta', 'cta', 'cta'), 'cta')).toMatch(/at most 3/i);
    expect(
      blockAddBlocker(body('safety_notice', 'safety_notice'), 'safety_notice'),
    ).toMatch(/at most 2/i);
  });

  it('allows the first of each', () => {
    expect(blockAddBlocker(emptyBody(), 'faq')).toBeNull();
    expect(blockAddBlocker(emptyBody(), 'direct_answer')).toBeNull();
  });

  it('blocks once the document hits the block cap', () => {
    const full: ContentBody = {
      version: 1,
      blocks: Array.from({ length: CONTENT_LIMITS.maxBlocks }, () => createBlock('paragraph')),
    };
    expect(blockAddBlocker(full, 'paragraph')).toMatch(/at most 500/i);
  });
});

describe('move', () => {
  it('moves up and down', () => {
    const doc = body('paragraph', 'heading');
    const [first, second] = doc.blocks.map((b) => b.id);

    expect(moveBlock(doc, second, 'up').blocks[0].id).toBe(second);
    expect(moveBlock(doc, first, 'down').blocks[1].id).toBe(first);
  });

  it('refuses to move past the ends', () => {
    const doc = body('paragraph', 'heading');
    expect(canMove(doc, doc.blocks[0].id, 'up')).toBe(false);
    expect(canMove(doc, doc.blocks[1].id, 'down')).toBe(false);
  });

  it('never displaces a pinned direct answer', () => {
    const doc = body('direct_answer', 'paragraph');
    expect(canMove(doc, doc.blocks[1].id, 'up')).toBe(false);
    expect(canMove(doc, doc.blocks[0].id, 'down')).toBe(false);
  });
});

describe('duplicate and remove', () => {
  it('refuses to duplicate a direct answer or an FAQ block', () => {
    // Both are capped at one per document, so duplication could only create an invalid state.
    const answer = body('direct_answer');
    expect(duplicateBlock(answer, answer.blocks[0].id)).toBe(answer);

    const faq = body('faq');
    expect(duplicateBlock(faq, faq.blocks[0].id)).toBe(faq);
  });

  it('gives duplicated FAQ items fresh ids when duplication is allowed elsewhere', () => {
    const doc = body('list');
    const copy = duplicateBlock(doc, doc.blocks[0].id);
    expect(copy.blocks).toHaveLength(2);
  });

  it('removes the requested block only', () => {
    const doc = body('paragraph', 'heading', 'quote');
    const next = removeBlock(doc, doc.blocks[1].id);
    expect(next.blocks.map((b) => b.type)).toEqual(['paragraph', 'quote']);
  });
});

describe('created blocks are minimally valid', () => {
  it('creates every type with the right shape', () => {
    expect(createBlock('heading')).toMatchObject({ type: 'heading', level: 2 });
    expect(createBlock('list')).toMatchObject({ type: 'list', style: 'bullet' });
    expect(createBlock('faq').type).toBe('faq');
    expect((createBlock('faq') as never as { items: unknown[] }).items).toHaveLength(1);
    expect(createBlock('table')).toMatchObject({ headers: ['', ''] });
    expect(createBlock('safety_notice')).toMatchObject({ variant: 'disclaimer' });
    // A new CTA defaults to a mapped route key, never a blank target.
    expect((createBlock('cta') as never as { target: { value: string } }).target.value).toBe(
      'product.talk_it_out',
    );
  });

  it('never creates a heading above level 2', () => {
    expect((createBlock('heading') as never as { level: number }).level).toBeGreaterThanOrEqual(2);
  });
});
