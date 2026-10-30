/**
 * Solace PDF brand: A4 white pages, 18 mm side margins, dark text with restrained violet accents,
 * DejaVu Sans / Amiri (see pdfText.ts), logo top-left of page 1, running header from page 2 and
 * "Solace · Personal & confidential" / "Page X of Y" on every page.
 *
 * Geometry and colours match the existing Goals & Journal PDFs (which keep their own copies
 * until they are moved onto this module).
 */
import { PDF_ARABIC_FONT_FAMILY } from "./pdfText";

export type RGB = [number, number, number];

// --- Geometry (A4, millimetres) -------------------------------------------------------------
export const PAGE_W = 210;
export const MARGIN = 18;
export const CONTENT_W = PAGE_W - MARGIN * 2; // 174
/** Content starts here on page 1 … */
export const FIRST_TOP = 20;
/** … and here on later pages, below the running header. */
export const TOP = 27;
/** Content never goes below this. */
export const BOTTOM = 274;
export const HEADER_TEXT = 14;
export const HEADER_RULE = 17;
export const FOOTER_RULE = 281;
export const FOOTER_TEXT = 287;

// --- Type (pt) --------------------------------------------------------------------------------
export const T_TITLE = 19;
export const T_SECTION = 13;
export const T_BODY = 10;
export const T_TABLE = 9.5;
export const T_META = 8.5;
export const T_SMALL = 7.5;
const PT = 0.3528; // mm per pt

/**
 * Line metrics per font family, in mm. Amiri's tall marks and deep descenders need more room than
 * DejaVu, or consecutive Urdu lines overlap.
 */
export function lineMetrics(family: string, size: number): { lineH: number; ascent: number; descent: number } {
  return family === PDF_ARABIC_FONT_FAMILY
    ? { lineH: size * PT * 1.95, ascent: size * PT * 1.02, descent: size * PT * 0.6 }
    : { lineH: size * PT * 1.45, ascent: size * PT * 0.78, descent: size * PT * 0.24 };
}

// --- Print-friendly palette -------------------------------------------------------------------
export const INK: RGB = [17, 24, 39];
export const BODY: RGB = [40, 46, 58];
export const MUTED: RGB = [96, 104, 117];
export const BRAND: RGB = [109, 40, 217];
export const RULE: RGB = [221, 223, 230];
export const CAUTION: RGB = [154, 72, 6];

export const FOOTER_LEFT = "Solace · Personal & confidential";

/** No-break space: keeps "27 Oct 2026" on one line when text wraps. */
export const NBSP = " ";
