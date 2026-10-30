/**
 * Measured, paginated text for Solace report PDFs (jsPDF), on the brand in pdfBrand.ts.
 *
 * Every line is prepared through the text kit (font by script, emoji marked, unsupported
 * characters rejected) and measured before it is placed; rows move to the next page rather than
 * running into the footer, and long words are split instead of overflowing.
 */
import type { jsPDF } from "jspdf";
import type { PdfTextKit } from "./pdfText";
import type { LogoImage } from "./pdfLogo";
import {
  BODY,
  BOTTOM,
  BRAND,
  CONTENT_W,
  FIRST_TOP,
  FOOTER_LEFT,
  FOOTER_RULE,
  FOOTER_TEXT,
  HEADER_RULE,
  HEADER_TEXT,
  MARGIN,
  MUTED,
  RULE,
  T_BODY,
  T_SMALL,
  TOP,
  lineMetrics,
  type RGB,
} from "./pdfBrand";

type Style = "normal" | "bold";

export interface Row {
  h: number;
  /** Keep this row on the same page as the next one (headings). */
  keepWithNext?: boolean;
  /** Distance from the row top to its text baseline (text rows). */
  baseline?: number;
  draw: (top: number) => void;
}

export interface TextOptions {
  style?: Style;
  size?: number;
  color?: RGB;
  /** Text box: starts `indent` mm in from the left margin and is `width` mm wide. */
  indent?: number;
  width?: number;
  /** Space above the first line, in mm. */
  padTop?: number;
  keepWithNext?: boolean;
}

interface Laid {
  text: string;
  family: string;
}

export class PdfWriter {
  y = FIRST_TOP;
  private onPageBreak: (() => void) | null = null;

  constructor(readonly doc: jsPDF, readonly kit: PdfTextKit) {}

  font(style: Style, size: number, color: RGB, family: string = this.kit.baseFamily): void {
    this.doc.setFont(family, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  /** Prepares one paragraph (font by script, emoji marked) and wraps it; long words are split. */
  private layout(text: string, width: number, style: Style, size: number): Laid[] {
    const p = this.kit.prepare(text, style);
    this.doc.setFont(p.family, style);
    this.doc.setFontSize(size);
    const out: Laid[] = [];
    for (const line of this.doc.splitTextToSize(p.text, width) as string[]) {
      if (this.doc.getTextWidth(line) <= width + 0.5) {
        out.push({ text: line, family: p.family });
        continue;
      }
      let chunk = "";
      for (const ch of Array.from(line)) {
        if (chunk && this.doc.getTextWidth(chunk + ch) > width) {
          out.push({ text: chunk, family: p.family });
          chunk = ch;
        } else chunk += ch;
      }
      if (chunk) out.push({ text: chunk, family: p.family });
    }
    return out;
  }

  /**
   * Rows for text, one per wrapped line, so long text can cross pages. Each `\n`-separated line
   * is its own paragraph with its own direction (Urdu right-to-left); empty lines are kept.
   */
  textRows(text: string, o: TextOptions = {}): Row[] {
    const style = o.style ?? "normal";
    const size = o.size ?? T_BODY;
    const color = o.color ?? BODY;
    const indent = o.indent ?? 0;
    const width = o.width ?? CONTENT_W - indent;
    const left = MARGIN + indent;
    const rows: Row[] = [];
    const paragraphs = text.split("\n");
    paragraphs.forEach((para, pi) => {
      const lastPara = pi === paragraphs.length - 1;
      if (!para.trim()) {
        rows.push({ h: lineMetrics(this.kit.baseFamily, size).lineH, draw: () => undefined });
        return;
      }
      const lines = this.layout(para, width, style, size);
      const opts = this.kit.textOptions(para);
      const mt = lineMetrics(lines[0]?.family ?? this.kit.baseFamily, size);
      lines.forEach((ln, i) => {
        const first = rows.length === 0;
        const baseline = first ? (o.padTop ?? 0) + mt.ascent : mt.lineH;
        rows.push({
          h: baseline + (lastPara && i === lines.length - 1 ? mt.descent : 0),
          keepWithNext: o.keepWithNext,
          baseline,
          draw: (top) => {
            this.font(style, size, color, ln.family);
            // Right-to-left paragraphs (first strong character Urdu) align to the box's right edge.
            if (opts) this.doc.text(ln.text, left + width, top + baseline, { ...opts, align: "right" });
            else this.doc.text(ln.text, left, top + baseline);
          },
        });
      });
    });
    return rows;
  }

  space(h: number): Row {
    return { h, draw: () => undefined };
  }

  rule(color: RGB = RULE, width = 0.25, before = 2, after = 3): Row {
    return {
      h: before + after,
      draw: (top) => {
        this.doc.setDrawColor(color[0], color[1], color[2]);
        this.doc.setLineWidth(width);
        this.doc.line(MARGIN, top + before, MARGIN + CONTENT_W, top + before);
      },
    };
  }

  /** A short bordered notice (kept on one page). Printable without background colours. */
  notice(text: string, color: RGB, o: { size?: number; padTop?: number } = {}): Row {
    const pad = 2.2;
    const inner = this.textRows(text, { size: o.size ?? T_BODY, color, indent: pad, width: CONTENT_W - pad * 2 });
    const innerH = inner.reduce((s, r) => s + r.h, 0);
    const before = o.padTop ?? 0;
    return {
      h: before + innerH + pad * 2,
      draw: (top) => {
        this.doc.setDrawColor(color[0], color[1], color[2]);
        this.doc.setLineWidth(0.5);
        this.doc.roundedRect(MARGIN, top + before, CONTENT_W, innerH + pad * 2, 1.2, 1.2, "S");
        let y = top + before + pad;
        for (const r of inner) {
          r.draw(y);
          y += r.h;
        }
      },
    };
  }

  newPage(): void {
    this.doc.addPage();
    this.y = TOP;
    this.onPageBreak?.();
  }

  ensure(h: number): void {
    if (this.y + h > BOTTOM) this.newPage();
  }

  /** Called at the top of each new page while set (e.g. a continuation label). */
  setPageBreakHook(hook: (() => void) | null): void {
    this.onPageBreak = hook;
  }

  /**
   * Places rows top to bottom. The first `keep` mm stay together (moving to a new page if
   * needed); a row marked keepWithNext stays with the row after it.
   */
  place(rows: Row[], keep = 0): void {
    if (keep > 0) this.ensure(Math.min(keep, BOTTOM - TOP));
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      this.ensure(r.keepWithNext && next ? r.h + next.h : r.h);
      r.draw(this.y);
      this.y += r.h;
    });
  }

  /** The Solace wordmark at the top of page 1, or the name in brand colour if it can't load. */
  logo(logo: LogoImage | null): void {
    if (logo) {
      try {
        this.doc.addImage(logo.dataUrl, "PNG", MARGIN, this.y - 4, logo.width, logo.height);
        this.y += logo.height + 2;
        return;
      } catch {
        // fall through to the text mark
      }
    }
    this.place([...this.textRows("Solace", { style: "bold", size: 12, color: BRAND }), this.space(2)]);
  }
}

/**
 * Running header on pages 2+ and the footer on every page, drawn once the page count is known.
 * Header/footer text is fixed wording plus the reporting period (no user-entered text).
 */
export function stampPages(doc: jsPDF, kit: PdfTextKit, headerText: string): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont(kit.baseFamily, "normal");
    doc.setFontSize(T_SMALL);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.25);
    if (page > 1) {
      doc.text(headerText, MARGIN, HEADER_TEXT);
      doc.line(MARGIN, HEADER_RULE, MARGIN + CONTENT_W, HEADER_RULE);
    }
    doc.line(MARGIN, FOOTER_RULE, MARGIN + CONTENT_W, FOOTER_RULE);
    doc.text(FOOTER_LEFT, MARGIN, FOOTER_TEXT);
    doc.text(`Page ${page} of ${total}`, MARGIN + CONTENT_W, FOOTER_TEXT, { align: "right" });
  }
}
