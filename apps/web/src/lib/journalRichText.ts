/**
 * Journal exports only: the rich-text HTML saved by the journal editor, as structured lines.
 *
 * The editor is a contentEditable surface, so its HTML uses `<div>` for each new line,
 * `<div><br></div>` for an empty line, `<br>` for line breaks, `<ul>/<ol>/<li>` for lists and
 * `<blockquote>`; pasted text can also bring `<p>`, headings and `<pre>`. This keeps that structure:
 *
 * - `<p>`, headings, lists, quotes and `<pre>` start a new paragraph (a blank line before them);
 * - `<div>` and `<br>` start a new line; an empty line in the entry stays an empty line;
 * - list items keep their marker ("•" / "1.", honouring `<ol start>`) and nesting depth;
 * - entities are decoded; script/style/template content is never included;
 * - wording, Unicode and repeated spaces typed as `&nbsp;` are kept; `<pre>` keeps its whitespace;
 * - images become a visible "[image]" marker (with their alt text when present).
 *
 * The HTML is parsed into an inert document (DOMParser), so nothing in it runs. Separate from
 * `htmlToReadableText` (Mood exports), whose output is unchanged.
 */

export type JournalLineKind = "text" | "heading" | "list-item" | "quote" | "pre" | "rule";

export interface JournalLine {
  kind: JournalLineKind;
  /** Text as typed (no markers). Empty for a blank line or a rule. */
  text: string;
  /** Heading level 1–6 (headings only). */
  level?: number;
  /** List nesting (1 = top level) for list items and lines continuing them. */
  depth?: number;
  /** "•" or "1." … — only on the first line of a list item. */
  marker?: string;
  /** A paragraph boundary comes before this line (render a blank gap). */
  paragraphBefore: boolean;
  /** How many images on this line are shown as an image marker. */
  images?: number;
}

export const IMAGE_MARKER = "[image]";

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "IFRAME", "OBJECT", "SVG", "MATH"]);
const PARAGRAPH = new Set([
  "P", "SECTION", "ARTICLE", "HEADER", "FOOTER", "ASIDE", "FIGURE", "TABLE", "UL", "OL", "DL",
  "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "HR",
]);
const LINE = new Set(["DIV", "LI", "TR", "DT", "DD", "FIGCAPTION", "CAPTION", "ADDRESS", "MAIN", "NAV"]);
/** Marker for unordered list items (nesting is carried by `depth`). */
export const BULLET = "•";

interface Ctx {
  kind: JournalLineKind;
  level?: number;
  depth?: number;
  pre: boolean;
}

export function journalHtmlToLines(html: string | null | undefined): JournalLine[] {
  if (!html || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");

  const lines: JournalLine[] = [];
  let cur: JournalLine | null = null; // the line being filled
  let pending: 0 | 1 | 2 = 0; // break requested before the next text: 1 line, 2 paragraph
  let pendingMarker: string | undefined;

  const open = (ctx: Ctx) => {
    const paragraphBefore = lines.length > 0 && pending === 2;
    cur = { kind: ctx.kind, text: "", paragraphBefore };
    if (ctx.kind === "heading") cur.level = ctx.level;
    if (ctx.depth) cur.depth = ctx.depth;
    if (pendingMarker) {
      cur.marker = pendingMarker;
      if (ctx.kind === "text" || ctx.kind === "quote") cur.kind = "list-item";
      pendingMarker = undefined;
    }
    lines.push(cur);
    pending = 0;
  };
  const endLine = () => {
    if (cur) cur.text = cur.text.replace(/ +$/, "");
    cur = null;
  };
  const requestBreak = (level: 1 | 2) => {
    endLine();
    if (level > pending) pending = level;
  };
  const emit = (text: string, ctx: Ctx) => {
    if (!text) return;
    if (!cur) {
      if (!ctx.pre) text = text.replace(/^ +/, "");
      if (!text) return;
      open(ctx);
    }
    // Collapsed spaces never double up across inline elements.
    if (!ctx.pre && text.startsWith(" ") && (cur!.text === "" || cur!.text.endsWith(" "))) text = text.replace(/^ +/, "");
    cur!.text += text;
  };

  const walk = (node: Node, ctx: Ctx): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? "";
      if (ctx.pre) {
        raw.split("\n").forEach((part, i) => {
          if (i > 0) {
            if (!cur) open(ctx);
            endLine();
            pending = 1;
            open(ctx);
          }
          emit(part.replace(/ /g, " "), ctx);
        });
        return;
      }
      // Rendered HTML whitespace collapses; typed repeated spaces arrive as &nbsp; and are kept.
      emit(raw.replace(/[ \t\n\r\f]+/g, " ").replace(/ /g, " "), ctx);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP.has(tag)) return;

    if (tag === "BR") {
      if (!cur) open(ctx); // a <br> on an empty line is an empty line
      endLine();
      pending = 1;
      return;
    }
    if (tag === "IMG") {
      const alt = (el.getAttribute("alt") ?? "").trim();
      emit(alt ? `[image: ${alt}]` : IMAGE_MARKER, ctx);
      if (cur) (cur as JournalLine).images = ((cur as JournalLine).images ?? 0) + 1;
      return;
    }
    if (tag === "HR") {
      requestBreak(2);
      lines.push({ kind: "rule", text: "", paragraphBefore: lines.length > 0 });
      pending = 2;
      return;
    }

    let next = ctx;
    if (/^H[1-6]$/.test(tag)) next = { ...ctx, kind: "heading", level: Number(tag[1]) };
    else if (tag === "BLOCKQUOTE") next = { ...ctx, kind: ctx.kind === "list-item" ? ctx.kind : "quote" };
    else if (tag === "PRE") next = { ...ctx, kind: "pre", pre: true };
    else if (tag === "UL" || tag === "OL") next = { ...ctx, depth: (ctx.depth ?? 0) + 1 };

    if (tag === "LI") {
      const parent = el.parentElement;
      const ptag = parent?.tagName.toUpperCase();
      const depth = ctx.depth ?? 1;
      if (ptag === "OL") {
        const start = Number.parseInt(parent!.getAttribute("start") ?? "1", 10);
        const index = Array.from(parent!.children).filter((c) => c.tagName.toUpperCase() === "LI").indexOf(el);
        const value = Number.parseInt(el.getAttribute("value") ?? "", 10);
        pendingMarker = `${Number.isFinite(value) ? value : (Number.isFinite(start) ? start : 1) + index}.`;
      } else {
        pendingMarker = BULLET;
      }
      requestBreak(1);
      const liCtx: Ctx = { ...ctx, kind: "text", depth };
      el.childNodes.forEach((child) => walk(child, liCtx));
      if (pendingMarker) {
        // An empty list item still shows its marker.
        open(liCtx);
      }
      requestBreak(1);
      return;
    }
    if (tag === "TD" || tag === "TH") {
      if (cur && (cur as JournalLine).text) emit(" | ", next);
      el.childNodes.forEach((child) => walk(child, next));
      return;
    }

    const para = PARAGRAPH.has(tag) && !((tag === "UL" || tag === "OL") && (ctx.depth ?? 0) > 0);
    const line = LINE.has(tag) || ((tag === "UL" || tag === "OL") && (ctx.depth ?? 0) > 0);
    if (para) requestBreak(2);
    else if (line) requestBreak(1);
    el.childNodes.forEach((child) => walk(child, next));
    if (para) requestBreak(2);
    else if (line) requestBreak(1);
  };

  doc.body.childNodes.forEach((n) => walk(n, { kind: "text", pre: false }));
  endLine();

  // Leading/trailing blank lines carry no content.
  const isBlank = (l: JournalLine) => l.kind !== "rule" && !l.marker && l.text === "";
  while (lines.length && isBlank(lines[0])) lines.shift();
  while (lines.length && isBlank(lines[lines.length - 1])) lines.pop();
  if (lines.length) lines[0].paragraphBefore = false;
  return lines;
}

/** Readable plain text for the JSON export's `contentPlain`, keeping the entry's structure. */
export function journalLinesToPlainText(lines: JournalLine[]): string {
  const out: string[] = [];
  for (const l of lines) {
    if (l.paragraphBefore) out.push("");
    const indent = l.depth ? "  ".repeat(l.depth - 1) : "";
    if (l.kind === "rule") out.push("---");
    else if (l.marker) out.push(`${indent}${l.marker === BULLET ? "-" : l.marker} ${l.text}`);
    else if (l.kind === "quote") out.push(`> ${l.text}`);
    else if (l.depth) out.push(`${indent}  ${l.text}`);
    else out.push(l.text);
  }
  return out.join("\n");
}

export function journalHtmlToPlainText(html: string | null | undefined): string {
  return journalLinesToPlainText(journalHtmlToLines(html));
}
