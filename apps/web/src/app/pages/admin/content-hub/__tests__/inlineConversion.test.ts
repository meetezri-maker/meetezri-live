/**
 * Inline conversion — round-trip and paste normalisation.
 *
 * These are pure functions with no TipTap import, so they test without a DOM. The round-trip
 * property is the important one: whatever the editor produces must survive a save/load cycle
 * unchanged, or authors lose formatting silently.
 */

import { describe, expect, it } from 'vitest';
import type { InlineContent } from '@meetezri/shared';
import {
  inlineToPlainText,
  inlineToTipTap,
  isInlineEmpty,
  normalisePastedInline,
  tipTapToInline,
} from '../editor/inlineConversion';

const roundTrip = (content: InlineContent) => tipTapToInline(inlineToTipTap(content));

describe('round trip', () => {
  it('preserves plain text', () => {
    const content: InlineContent = [{ text: 'Hello world' }];
    expect(roundTrip(content)).toEqual(content);
  });

  it('preserves each supported mark', () => {
    for (const mark of ['bold', 'italic', 'code'] as const) {
      const content: InlineContent = [{ text: 'styled', marks: [mark] }];
      expect(roundTrip(content)).toEqual(content);
    }
  });

  it('preserves multiple marks on one span', () => {
    const content: InlineContent = [{ text: 'both', marks: ['bold', 'italic'] }];
    const result = roundTrip(content);
    expect(result[0].text).toBe('both');
    expect(result[0].marks?.sort()).toEqual(['bold', 'italic']);
  });

  it('preserves external links', () => {
    const content: InlineContent = [
      { text: 'link', link: { kind: 'external', value: 'https://example.com/' } },
    ];
    expect(roundTrip(content)).toEqual(content);
  });

  it('preserves internal content links by id, not URL', () => {
    // Storing an id rather than a URL is what makes internal links survive a slug change.
    const content: InlineContent = [{ text: 'see this', link: { kind: 'content', value: 'abc-123' } }];
    expect(roundTrip(content)).toEqual(content);
  });

  it('preserves route links', () => {
    const content: InlineContent = [
      { text: 'pricing', link: { kind: 'route', value: 'pricing' } },
    ];
    expect(roundTrip(content)).toEqual(content);
  });

  it('preserves mixed runs', () => {
    const content: InlineContent = [
      { text: 'Plain then ' },
      { text: 'bold', marks: ['bold'] },
      { text: ' then ' },
      { text: 'a link', link: { kind: 'external', value: 'https://example.com/' } },
    ];
    expect(roundTrip(content)).toEqual(content);
  });

  it('handles an empty field', () => {
    expect(roundTrip([])).toEqual([]);
    expect(inlineToTipTap([]).content[0]).toEqual({ type: 'paragraph' });
  });
});

describe('unsupported formatting is stripped', () => {
  it('drops marks outside the allow-list', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'pasted',
              // What a Word or Google Docs paste typically carries.
              marks: [
                { type: 'bold' },
                { type: 'textStyle', attrs: { color: '#ff0000', fontFamily: 'Calibri' } },
                { type: 'highlight' },
                { type: 'strike' },
              ],
            },
          ],
        },
      ],
    };
    expect(tipTapToInline(doc)).toEqual([{ text: 'pasted', marks: ['bold'] }]);
  });

  it('ignores non-text nodes such as images and headings', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'image', attrs: { src: 'https://example.com/x.png' } } as never,
            { type: 'text', text: 'kept' },
          ],
        },
      ],
    };
    expect(tipTapToInline(doc)).toEqual([{ text: 'kept' }]);
  });

  it('flattens multiple paragraphs into one inline run', () => {
    // The stored model has no paragraph concept, so a multi-paragraph paste must collapse
    // rather than smuggle block structure into a field that cannot represent it.
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    expect(inlineToPlainText(tipTapToInline(doc))).toBe('First Second');
  });

  it('merges consecutive spans with identical formatting', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'one ' },
            { type: 'text', text: 'two' },
          ],
        },
      ],
    };
    expect(tipTapToInline(doc)).toEqual([{ text: 'one two' }]);
  });
});

describe('unsafe links are rejected', () => {
  it('drops javascript:, data: and other unsafe protocols', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd']) {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href } }] }],
          },
        ],
      };
      const result = tipTapToInline(doc);
      expect({ href, link: result[0].link }).toEqual({ href, link: undefined });
      // The TEXT survives — only the link is removed.
      expect(result[0].text).toBe('click');
    }
  });

  it('drops an unmapped route key rather than storing a dead link', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'route:not_a_real_key' } }] },
          ],
        },
      ],
    };
    expect(tipTapToInline(doc)[0].link).toBeUndefined();
  });

  it('never emits an href for an unsafe stored link', () => {
    const content: InlineContent = [
      { text: 'bad', link: { kind: 'external', value: 'javascript:alert(1)' } },
    ];
    const doc = inlineToTipTap(content);
    expect(JSON.stringify(doc)).not.toContain('javascript:');
  });
});

describe('paste normalisation', () => {
  it('strips zero-width characters Word and Docs embed', () => {
    const pasted: InlineContent = [{ text: 'He​ll‍o﻿' }];
    expect(normalisePastedInline(pasted)).toEqual([{ text: 'Hello' }]);
  });

  it('converts non-breaking spaces and collapses runs', () => {
    const pasted: InlineContent = [{ text: 'a  b   c' }];
    expect(normalisePastedInline(pasted)).toEqual([{ text: 'a b c' }]);
  });

  it('drops spans that become empty', () => {
    expect(normalisePastedInline([{ text: '​' }, { text: 'kept' }])).toEqual([{ text: 'kept' }]);
  });

  it('keeps marks and safe links', () => {
    const pasted: InlineContent = [
      { text: 'bold', marks: ['bold'] },
      { text: 'link', link: { kind: 'external', value: 'https://example.com' } },
    ];
    expect(normalisePastedInline(pasted)).toEqual(pasted);
  });

  it('removes an unsafe link but keeps its text', () => {
    const pasted: InlineContent = [
      { text: 'danger', link: { kind: 'external', value: 'javascript:alert(1)' } },
    ];
    expect(normalisePastedInline(pasted)).toEqual([{ text: 'danger' }]);
  });
});

describe('helpers', () => {
  it('extracts plain text', () => {
    expect(inlineToPlainText([{ text: 'a' }, { text: 'b', marks: ['bold'] }])).toBe('ab');
  });

  it('detects empty fields', () => {
    expect(isInlineEmpty([])).toBe(true);
    expect(isInlineEmpty([{ text: '   ' }])).toBe(true);
    expect(isInlineEmpty([{ text: 'x' }])).toBe(false);
  });
});
