/**
 * Page flow for branded A4 reports drawn with the shaped text writer (runs in a PDF worker):
 * pages, wrapped text rows, section headings, tables whose header repeats on each page, the logo,
 * and the running header / "Solace · Personal & confidential" / "Page X of Y" footer.
 *
 * Geometry is in mm (pdfBrand), converted to pt when drawing. Fonts for every string must already
 * be loaded with `ShapedPdfWriter.ensureFonts` before anything is laid out.
 */
import type { PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import {
  BOTTOM, BRAND, CONTENT_W, FIRST_TOP, FOOTER_LEFT, FOOTER_RULE, FOOTER_TEXT, HEADER_RULE, HEADER_TEXT, INK, MARGIN, MUTED,
  PAGE_W, RULE, T_SECTION, T_SMALL, T_TABLE, TOP, type RGB,
} from "@/lib/pdf/pdfBrand";
import type { ShapedLine, ShapedPdfWriter } from "./shapedPdf";

/** pt per mm. */
export const MM = 72 / 25.4;
const PAGE_H = 297;

export interface Row {
  /** Height in mm. */
  h: number;
  keepWithNext?: boolean;
  draw(top: number): void;
}

export interface TextRowOptions {
  size: number;
  bold?: boolean;
  color: RGB;
  padTop?: number;
  keepWithNext?: boolean;
  lang?: string;
  /** Box width in mm (default: the content width) and left offset from the margin. */
  width?: number;
  indent?: number;
}

export interface TableColumn {
  label: string;
  /** Width in mm. */
  width: number;
  /** Right-aligned columns must hold Latin digits/punctuation only (measured with Noto Sans). */
  align?: "left" | "right";
}

/** Strings a table draws (for ensureFonts): header labels are bold, cells regular. */
export function tableStrings(columns: TableColumn[], rows: string[][]): { regular: string[]; bold: string[] } {
  return { regular: rows.flat(), bold: columns.map((c) => c.label) };
}

/** Strings the running header and footer draw (for ensureFonts). */
export const CHROME_STRINGS = [FOOTER_LEFT, "Page 0123456789 of"];

const toRgb = (c: RGB) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);

export class ShapedReportLayout {
  readonly pages: PDFPage[] = [];
  private page: PDFPage | null = null;
  private y = FIRST_TOP;
  private onPageBreak: (() => void) | null = null;

  constructor(private readonly w: ShapedPdfWriter) {}

  private newPage(): void {
    this.page = this.w.doc.addPage([PAGE_W * MM, PAGE_H * MM]);
    this.pages.push(this.page);
    this.y = this.pages.length === 1 ? FIRST_TOP : TOP;
    this.onPageBreak?.();
  }

  private ensure(h: number): void {
    if (!this.page || this.y + h > BOTTOM) this.newPage();
  }

  /** Places rows in order; `keep` (mm) starts a new page unless that much fits on this one. */
  place(rows: Row[], keep = 0): void {
    if (keep > 0) this.ensure(Math.min(keep, BOTTOM - TOP));
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      this.ensure(r.keepWithNext && next ? r.h + next.h : r.h);
      r.draw(this.y);
      this.y += r.h;
    });
  }

  space(h: number): Row {
    return { h, draw: () => undefined };
  }

  height(rows: Row[]): number {
    return rows.reduce((s, r) => s + r.h, 0);
  }

  textRows(text: string, o: TextRowOptions): Row[] {
    const rows: Row[] = [];
    const width = o.width ?? CONTENT_W;
    const x = (MARGIN + (o.indent ?? 0)) * MM;
    for (const para of text.split("\n")) {
      const lines: ShapedLine[] = para.trim()
        ? this.w.layoutParagraph(para, { size: o.size, bold: o.bold, width: width * MM, lang: o.lang })
        : [{ height: o.size * 1.45, ascent: o.size, draw: () => undefined }];
      for (const line of lines) {
        const pad = rows.length === 0 ? o.padTop ?? 0 : 0;
        rows.push({ h: pad + line.height / MM, keepWithNext: o.keepWithNext, draw: (top) => line.draw(this.page!, x, (top + pad) * MM, o.color) });
      }
    }
    return rows;
  }

  private rule(top: number, color: RGB, thickness: number): void {
    const at = (PAGE_H - top) * MM;
    this.page!.drawLine({ start: { x: MARGIN * MM, y: at }, end: { x: (MARGIN + CONTENT_W) * MM, y: at }, thickness: thickness * MM, color: toRgb(color) });
  }

  /** A section heading with the brand rule under it, kept with what follows. */
  section(title: string): Row[] {
    return [
      this.space(5),
      ...this.textRows(title, { size: T_SECTION, bold: true, color: INK, keepWithNext: true }),
      { h: 1.6 + 4, keepWithNext: true, draw: (top) => this.rule(top + 1.6, BRAND, 0.5) },
    ];
  }

  /** The logo (or the "Solace" text mark if it can't be drawn) at the top of page 1. */
  async logo(png: Uint8Array | null | undefined): Promise<void> {
    if (!this.page) this.newPage();
    if (png) {
      try {
        const img = await this.w.doc.embedPng(png);
        const h = 9, lw = Math.min(h * (img.width / img.height), 42);
        this.page!.drawImage(img, { x: MARGIN * MM, y: (PAGE_H - (this.y - 4) - h) * MM, width: lw * MM, height: h * MM });
        this.y += h + 2;
        return;
      } catch {
        // Fall back to the text mark below.
      }
    }
    this.place([...this.textRows("Solace", { size: 12, bold: true, color: BRAND }), this.space(2)]);
  }

  /**
   * A table: one row per entry, never split across pages; the header row repeats at the top of
   * each page the table continues on. Cells wrap within their column.
   */
  table(columns: TableColumn[], rows: string[][], o: { keepWithPrevious?: number } = {}): void {
    const PAD = 1.4;
    // Text cells keep a 4 mm gutter on the right, so right-to-left text (aligned to the cell's
    // right edge) stays clear of the next column.
    const GUTTER = 4;
    const rowOf = (cells: string[], bold: boolean, color: RGB): Row => {
      const laid = cells.map((text, i) => {
        const col = columns[i];
        const lines = text.trim() ? this.w.layoutParagraph(text, { size: T_TABLE, bold, width: (col.width - (col.align === "right" ? 1 : GUTTER)) * MM }) : [];
        return { lines, col, text, h: lines.reduce((s, l) => s + l.height / MM, 0) };
      });
      const h = Math.max(T_TABLE * 1.45 / MM, ...laid.map((c) => c.h)) + PAD * 2;
      return {
        h,
        draw: (top) => {
          let x = MARGIN;
          for (const cell of laid) {
            let lineTop = top + PAD;
            for (const line of cell.lines) {
              const left = cell.col.align === "right" ? x + cell.col.width - 1 - this.w.measure(cell.text, T_TABLE, bold) / MM : x;
              line.draw(this.page!, left * MM, lineTop * MM, color);
              lineTop += line.height / MM;
            }
            x += cell.col.width;
          }
          this.rule(top + h, RULE, bold ? 0.35 : 0.2);
        },
      };
    };
    const header = rowOf(columns.map((c) => c.label), true, INK);
    const body = rows.map((cells) => rowOf(cells, false, INK));
    // Start on a new page unless the header and the first rows fit here.
    this.place([], Math.max(o.keepWithPrevious ?? 0, this.height([header, ...body.slice(0, 2)])));
    this.place([header]);
    this.onPageBreak = () => { header.draw(this.y); this.y += header.h; };
    this.place(body);
    this.onPageBreak = null;
  }

  /** Running header (pages 2+) and footer on every page. Call once, after all content. */
  finish(headerText: string): void {
    const small = (p: PDFPage, text: string, x: number, baseline: number) => {
      const [line] = this.w.layoutParagraph(text, { size: T_SMALL, width: CONTENT_W * MM, lang: "en", baseDir: "ltr" });
      line.draw(p, x, baseline * MM - line.ascent, MUTED);
    };
    const ruleOn = (p: PDFPage, at: number) =>
      p.drawLine({ start: { x: MARGIN * MM, y: (PAGE_H - at) * MM }, end: { x: (MARGIN + CONTENT_W) * MM, y: (PAGE_H - at) * MM }, thickness: 0.25 * MM, color: toRgb(RULE) });
    this.pages.forEach((p, i) => {
      if (i > 0) {
        small(p, headerText, MARGIN * MM, HEADER_TEXT);
        ruleOn(p, HEADER_RULE);
      }
      ruleOn(p, FOOTER_RULE);
      small(p, FOOTER_LEFT, MARGIN * MM, FOOTER_TEXT);
      const label = `Page ${i + 1} of ${this.pages.length}`;
      small(p, label, (MARGIN + CONTENT_W) * MM - this.w.measure(label, T_SMALL), FOOTER_TEXT);
    });
  }
}
