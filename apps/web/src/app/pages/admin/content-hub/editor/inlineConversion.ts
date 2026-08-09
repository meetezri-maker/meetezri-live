/**
 * InlineContent ⇄ TipTap JSON conversion.
 *
 * PURE FUNCTIONS, NO TIPTAP IMPORT. This module must stay dependency-free so it can be unit
 * tested without a DOM and — more importantly — so importing it never pulls ProseMirror into a
 * bundle. The editor component imports TipTap; this file only describes its document shape.
 *
 * The stored format is always `InlineContent` (an array of spans). TipTap's document is a
 * transport format that exists only while the field is focused.
 */

import { isSafeExternalUrl, isRouteKey, type InlineContent, type InlineSpan } from '@meetezri/shared';

/** Marks the Content Hub allows. Anything else is dropped on the way in and cannot be produced. */
const ALLOWED_MARKS = new Set(['bold', 'italic', 'code']);

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapTextNode {
  type: 'text';
  text: string;
  marks?: TipTapMark[];
}

export interface TipTapDoc {
  type: 'doc';
  content: Array<{ type: 'paragraph'; content?: TipTapTextNode[] }>;
}

/** Serialise an inline link back into the `href` TipTap's Link mark understands. */
function linkToHref(link: InlineSpan['link']): string | null {
  if (!link) return null;
  switch (link.kind) {
    case 'external':
      return isSafeExternalUrl(link.value) ? link.value : null;
    // Internal targets round-trip through a private scheme so the editor can show them as links
    // without inventing a URL that would be wrong the moment a slug changes.
    case 'content':
      return `content:${link.value}`;
    case 'route':
      return `route:${link.value}`;
    default:
      return null;
  }
}

/** Parse an href back into the stored link shape, rejecting anything unsafe or unknown. */
function hrefToLink(href: unknown): InlineSpan['link'] | undefined {
  if (typeof href !== 'string' || href.trim() === '') return undefined;
  const value = href.trim();

  if (value.startsWith('content:')) {
    const id = value.slice('content:'.length);
    return id ? { kind: 'content', value: id } : undefined;
  }

  if (value.startsWith('route:')) {
    const key = value.slice('route:'.length);
    // An unmapped route key is dropped rather than stored — publish validation would reject it
    // anyway, and a dead link in the editor is worse than no link.
    return isRouteKey(key) ? { kind: 'route', value: key } : undefined;
  }

  return isSafeExternalUrl(value) ? { kind: 'external', value } : undefined;
}

/** `InlineContent` → a single-paragraph TipTap document. */
export function inlineToTipTap(content: InlineContent | undefined): TipTapDoc {
  const spans = Array.isArray(content) ? content : [];

  const nodes: TipTapTextNode[] = [];
  for (const span of spans) {
    if (!span || typeof span.text !== 'string' || span.text === '') continue;

    const marks: TipTapMark[] = [];
    for (const mark of span.marks ?? []) {
      if (ALLOWED_MARKS.has(mark)) marks.push({ type: mark });
    }

    const href = linkToHref(span.link);
    if (href) marks.push({ type: 'link', attrs: { href } });

    nodes.push(marks.length > 0 ? { type: 'text', text: span.text, marks } : { type: 'text', text: span.text });
  }

  // TipTap requires at least one block node; an empty paragraph is the valid empty document.
  return { type: 'doc', content: [nodes.length > 0 ? { type: 'paragraph', content: nodes } : { type: 'paragraph' }] };
}

/**
 * TipTap document → `InlineContent`.
 *
 * Flattens every paragraph into one span list: the stored model is a single run of inline text,
 * so a pasted multi-paragraph document collapses rather than smuggling block structure into a
 * field that cannot represent it. Consecutive spans with identical formatting are merged, which
 * keeps the stored JSON small and makes round-trip comparisons stable.
 */
export function tipTapToInline(doc: unknown): InlineContent {
  const root = doc as TipTapDoc | undefined;
  const blocks = Array.isArray(root?.content) ? root!.content : [];
  const out: InlineSpan[] = [];

  const push = (span: InlineSpan) => {
    if (span.text === '') return;
    const previous = out[out.length - 1];
    if (
      previous &&
      JSON.stringify(previous.marks ?? []) === JSON.stringify(span.marks ?? []) &&
      JSON.stringify(previous.link ?? null) === JSON.stringify(span.link ?? null)
    ) {
      previous.text += span.text;
      return;
    }
    out.push(span);
  };

  blocks.forEach((block, blockIndex) => {
    // A paragraph break becomes a space — the stored model has no paragraph concept.
    if (blockIndex > 0 && out.length > 0) push({ text: ' ' });

    for (const node of block?.content ?? []) {
      if (!node || node.type !== 'text' || typeof node.text !== 'string') continue;

      const marks: InlineSpan['marks'] = [];
      let link: InlineSpan['link'] | undefined;

      for (const mark of node.marks ?? []) {
        if (ALLOWED_MARKS.has(mark.type)) {
          marks.push(mark.type as 'bold' | 'italic' | 'code');
        } else if (mark.type === 'link') {
          link = hrefToLink(mark.attrs?.href);
        }
        // Every other mark (headings, colours, font families from a Word paste) is dropped.
      }

      const span: InlineSpan = { text: node.text };
      if (marks.length > 0) span.marks = marks;
      if (link) span.link = link;
      push(span);
    }
  });

  return out;
}

/**
 * Normalise pasted content.
 *
 * ProseMirror's schema already rejects nodes and marks the editor does not declare, so most of a
 * Word or Google Docs paste is stripped before it reaches us. This is the second pass: it removes
 * the zero-width and non-breaking characters those editors embed, collapses runs of whitespace,
 * and drops any link that survived with an unsafe target.
 */
export function normalisePastedInline(content: InlineContent): InlineContent {
  const cleaned: InlineSpan[] = [];

  for (const span of content) {
    const text = span.text
      // Zero-width space, ZWNJ, ZWJ, BOM — invisible junk Word and Docs leave behind.
      .replace(/[​-‍﻿]/g, '')
      // Non-breaking space to a normal space.
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ');

    if (text === '') continue;

    const next: InlineSpan = { text };
    if (span.marks?.length) next.marks = span.marks;
    // A link that is not verifiably safe is dropped, keeping its text.
    if (span.link && (span.link.kind !== 'external' || isSafeExternalUrl(span.link.value))) {
      next.link = span.link;
    }
    cleaned.push(next);
  }

  return cleaned;
}

/** Plain text of an inline field — used for character counts and empty checks. */
export function inlineToPlainText(content: InlineContent | undefined): string {
  if (!Array.isArray(content)) return '';
  return content.map((span) => span?.text ?? '').join('');
}

/** True when a field has no visible text. */
export function isInlineEmpty(content: InlineContent | undefined): boolean {
  return inlineToPlainText(content).trim() === '';
}
