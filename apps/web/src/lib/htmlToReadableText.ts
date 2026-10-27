/**
 * Readable plain text from rich-text HTML, for exports.
 *
 * Unlike `htmlToPlainText` (used by previews and counts, which runs text together), this keeps
 * paragraph breaks, `<br>` line breaks and list items ("- item" / "1. item"), decodes entities,
 * and drops script/style content. The HTML is parsed into an inert document (DOMParser), so
 * nothing in it runs.
 */
import { htmlToPlainText } from './htmlPlainText';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE']);
const BLOCK = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'BLOCKQUOTE', 'PRE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'TR', 'HR', 'FIGURE',
]);

/** Sentinel for a paragraph break, so it survives whitespace normalisation. */
const PARA = '\u0000P\u0000';

export function htmlToReadableText(html: string | null | undefined): string {
  if (!html || !html.trim()) return '';
  if (typeof DOMParser === 'undefined') return htmlToPlainText(html).trim();

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts: string[] = [];

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push((node.textContent ?? '').replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP.has(tag)) return;

    if (tag === 'BR') {
      parts.push('\n');
      return;
    }
    if (tag === 'LI') {
      const parent = el.parentElement;
      const ordered = parent?.tagName.toUpperCase() === 'OL';
      const index = parent ? Array.from(parent.children).filter((c) => c.tagName === 'LI').indexOf(el) + 1 : 1;
      parts.push('\n', ordered ? `${index}. ` : '- ');
      el.childNodes.forEach(walk);
      parts.push('\n');
      return;
    }
    if (tag === 'TD' || tag === 'TH') {
      el.childNodes.forEach(walk);
      parts.push('\t');
      return;
    }

    const block = BLOCK.has(tag);
    if (block) parts.push(PARA);
    el.childNodes.forEach(walk);
    if (block) parts.push(PARA);
  };

  doc.body.childNodes.forEach(walk);

  return parts
    .join('')
    .replace(/ /g, ' ')
    .split(PARA)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/g, '').replace(/^ +/g, ''))
        .filter((line, i, lines) => line !== '' || (i > 0 && i < lines.length - 1))
        .join('\n')
        .replace(/\n{2,}/g, '\n')
        .trim()
    )
    .filter(Boolean)
    .join('\n\n');
}
