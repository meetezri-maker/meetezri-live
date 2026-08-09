/**
 * Block document operations — pure functions over `ContentBody`.
 *
 * Kept separate from the React components so every operation is unit-testable without rendering,
 * and so the reducer-like guarantees (stable ids, position rules) live in one place.
 *
 * STABLE IDS ARE LOAD-BEARING: they key React lists, survive reordering, and are what will make
 * block-level revision diffing possible in v2. Ordinary edits must NEVER regenerate them.
 */

import {
  CONTENT_LIMITS,
  EDITOR_DISABLED_BLOCKS,
  TYPE_RESTRICTED_BLOCKS,
  type BlockType,
  type ContentBlock,
  type ContentBody,
  type ContentType,
} from '@meetezri/shared';

/** Short, collision-resistant, readable in JSON. */
export function newBlockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

const EMPTY_INLINE = () => [{ text: '' }];

/** A new block of the requested type, with the minimum valid shape. */
export function createBlock(type: BlockType): ContentBlock {
  const id = newBlockId();

  switch (type) {
    case 'paragraph':
      return { id, type, content: EMPTY_INLINE() };
    case 'heading':
      // Level 2 by default — the page title is the only h1.
      return { id, type, level: 2, content: EMPTY_INLINE() };
    case 'list':
      return { id, type, style: 'bullet', items: [EMPTY_INLINE()] };
    case 'quote':
      return { id, type, content: EMPTY_INLINE() };
    case 'direct_answer':
      return { id, type, content: EMPTY_INLINE() };
    case 'key_takeaway':
      return { id, type, title: 'Key takeaway', points: [EMPTY_INLINE()] };
    case 'safety_notice':
      return { id, type, variant: 'disclaimer', content: EMPTY_INLINE() };
    case 'cta':
      return { id, type, label: '', target: { kind: 'route', value: 'product.talk_it_out' } };
    case 'divider':
      return { id, type };
    case 'related_content':
      return { id, type, mode: 'auto' };
    case 'faq':
      return { id, type, items: [{ id: newBlockId(), question: '', answer: EMPTY_INLINE() }] };
    case 'table':
      return { id, type, headers: ['', ''], rows: [[EMPTY_INLINE(), EMPTY_INLINE()]] };
    case 'geo_statement':
      return { id, type, statement: EMPTY_INLINE() };
    case 'source':
      return { id, type, label: '', url: '' };
    case 'image':
      // Schema-valid but never offered by the palette in v1 (see `paletteFor`).
      return { id, type, url: '', alt: '' };
    default:
      return { id, type: 'paragraph', content: EMPTY_INLINE() } as ContentBlock;
  }
}

export const BLOCK_LABEL: Record<BlockType, string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  list: 'List',
  quote: 'Quote',
  direct_answer: 'Direct answer',
  key_takeaway: 'Key takeaway',
  safety_notice: 'Safety notice',
  cta: 'Call to action',
  image: 'Image',
  divider: 'Divider',
  related_content: 'Related content',
  faq: 'FAQ',
  table: 'Table',
  geo_statement: 'Statement',
  source: 'Source',
};

const ALL_BLOCKS: BlockType[] = [
  'paragraph',
  'heading',
  'list',
  'quote',
  'direct_answer',
  'key_takeaway',
  'safety_notice',
  'cta',
  'divider',
  'related_content',
  'faq',
  'table',
  'geo_statement',
  'source',
  'image',
];

/**
 * Blocks the palette offers for a content type.
 *
 * Filters out (a) editor-disabled blocks — `image` in v1 — and (b) blocks restricted to a
 * different content type, so a `geo_statement` is simply not offered on an Answer.
 */
export function paletteFor(contentType: ContentType): BlockType[] {
  return ALL_BLOCKS.filter((type) => {
    if ((EDITOR_DISABLED_BLOCKS as readonly BlockType[]).includes(type)) return false;
    for (const [owner, restricted] of Object.entries(TYPE_RESTRICTED_BLOCKS)) {
      if (restricted.includes(type) && owner !== contentType) return false;
    }
    return true;
  });
}

/** Why a block cannot be added right now — `null` when it can. */
export function blockAddBlocker(body: ContentBody, type: BlockType): string | null {
  const count = (t: BlockType) => body.blocks.filter((b) => b.type === t).length;

  if (type === 'faq' && count('faq') >= CONTENT_LIMITS.maxFaqBlocks) {
    return 'A document can contain only one FAQ block. Add questions to the existing one.';
  }
  if (type === 'direct_answer' && count('direct_answer') >= CONTENT_LIMITS.maxDirectAnswerBlocks) {
    return 'A document can contain only one direct answer.';
  }
  if (type === 'safety_notice' && count('safety_notice') >= CONTENT_LIMITS.maxSafetyNoticeBlocks) {
    return `At most ${CONTENT_LIMITS.maxSafetyNoticeBlocks} safety notices are allowed.`;
  }
  if (type === 'cta' && count('cta') >= CONTENT_LIMITS.maxCtaBlocks) {
    return `At most ${CONTENT_LIMITS.maxCtaBlocks} calls to action are allowed.`;
  }
  if (body.blocks.length >= CONTENT_LIMITS.maxBlocks) {
    return `A document can contain at most ${CONTENT_LIMITS.maxBlocks} blocks.`;
  }
  return null;
}

/**
 * Insert a block.
 *
 * `direct_answer` is always forced to index 0: the AEO strategy is "answer first, explanation
 * second", so its position is a schema rule rather than a styling preference.
 */
export function addBlock(body: ContentBody, type: BlockType, atIndex?: number): ContentBody {
  const block = createBlock(type);
  const blocks = [...body.blocks];

  if (type === 'direct_answer') {
    blocks.unshift(block);
  } else {
    const index = atIndex === undefined ? blocks.length : Math.max(0, Math.min(atIndex, blocks.length));
    // Never above a pinned direct answer.
    const floor = blocks[0]?.type === 'direct_answer' ? 1 : 0;
    blocks.splice(Math.max(index, floor), 0, block);
  }

  return { ...body, blocks };
}

export function removeBlock(body: ContentBody, id: string): ContentBody {
  return { ...body, blocks: body.blocks.filter((b) => b.id !== id) };
}

/** Duplicate a block. The COPY gets a fresh id; the original keeps its own. */
export function duplicateBlock(body: ContentBody, id: string): ContentBody {
  const index = body.blocks.findIndex((b) => b.id === id);
  if (index === -1) return body;

  const source = body.blocks[index];
  // A direct answer cannot be duplicated — only one is ever valid.
  if (source.type === 'direct_answer' || source.type === 'faq') return body;

  const copy = JSON.parse(JSON.stringify(source)) as ContentBlock;
  copy.id = newBlockId();
  if (copy.type === 'faq') {
    copy.items = copy.items.map((item) => ({ ...item, id: newBlockId() }));
  }

  const blocks = [...body.blocks];
  blocks.splice(index + 1, 0, copy);
  return { ...body, blocks };
}

/** Move a block one position. Refuses moves that would displace a pinned direct answer. */
export function moveBlock(body: ContentBody, id: string, direction: 'up' | 'down'): ContentBody {
  const index = body.blocks.findIndex((b) => b.id === id);
  if (index === -1) return body;

  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= body.blocks.length) return body;

  const moving = body.blocks[index];
  const displaced = body.blocks[target];
  if (moving.type === 'direct_answer' || displaced.type === 'direct_answer') return body;

  const blocks = [...body.blocks];
  blocks[index] = displaced;
  blocks[target] = moving;
  return { ...body, blocks };
}

/** Replace one block, preserving its id. */
export function updateBlock(body: ContentBody, id: string, next: ContentBlock): ContentBody {
  return {
    ...body,
    blocks: body.blocks.map((block) => (block.id === id ? { ...next, id } : block)),
  };
}

export function canMove(body: ContentBody, id: string, direction: 'up' | 'down'): boolean {
  return moveBlock(body, id, direction) !== body;
}

/** An empty document, used when creating content or clearing a body. */
export function emptyBody(): ContentBody {
  return { version: 1, blocks: [] };
}
