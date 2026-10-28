/**
 * Text support for the Goals & Achievements PDF only: Unicode fonts, glyph coverage and
 * right-to-left direction.
 *
 * - Fonts (fetched only when a PDF is generated, from /fonts/pdf/):
 *     DejaVu Sans (Bitstream Vera licence) for text without Arabic script;
 *     Amiri (SIL OFL 1.1) for any paragraph containing Arabic script. Amiri maps every
 *     presentation form jsPDF's shaping produces for Urdu, including ہ ے ۔ and their joined forms.
 *   A paragraph uses one font throughout, so mixed English/Urdu text stays in one face.
 * - Coverage: text is drawn complete. Emoji the font cannot draw become a visible "[emoji]"
 *   marker (the rest of the text is kept); any other character the font cannot draw makes the
 *   export fail with `PdfUnsupportedTextError` rather than produce an unfaithful report.
 * - Right-to-left: text is passed in typed order; jsPDF shapes Arabic letters and its bidi pass
 *   orders the line. Lines whose first strong character is right-to-left get a right-to-left
 *   base direction with bracket mirroring (`textOptions`).
 */
import type { jsPDF } from "jspdf";

export const PDF_FONT_FAMILY = "SolaceReportSans";
export const PDF_ARABIC_FONT_FAMILY = "SolaceReportArabic";
export const EMOJI_MARKER = "[emoji]";

interface FontPair {
  regular: string; // base64 TTF
  bold: string;
}

export interface PdfFontFiles {
  /** DejaVu Sans; null when it could not be loaded. */
  latin: FontPair | null;
  /** Amiri; null when not needed or not loaded. */
  arabic: FontPair | null;
}

const FONT_URLS = {
  latin: { regular: "/fonts/pdf/DejaVuSans.ttf", bold: "/fonts/pdf/DejaVuSans-Bold.ttf" },
  arabic: { regular: "/fonts/pdf/Amiri-Regular.ttf", bold: "/fonts/pdf/Amiri-Bold.ttf" },
};

export const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadPair(urls: { regular: string; bold: string }, fetchImpl: typeof fetch): Promise<FontPair | null> {
  try {
    const [regular, bold] = await Promise.all(
      [urls.regular, urls.bold].map(async (url) => {
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error(`font ${url}: ${res.status}`);
        return toBase64(await res.arrayBuffer());
      })
    );
    return { regular, bold };
  } catch {
    return null;
  }
}

/** Loads the report fonts. The Arabic-script font is fetched only when the report needs it. */
export async function loadPdfFonts(needArabic: boolean, fetchImpl: typeof fetch = fetch): Promise<PdfFontFiles> {
  const [latin, arabic] = await Promise.all([
    loadPair(FONT_URLS.latin, fetchImpl),
    needArabic ? loadPair(FONT_URLS.arabic, fetchImpl) : Promise.resolve(null),
  ]);
  return { latin, arabic };
}

/** Thrown when text cannot be drawn faithfully; the export is stopped instead. */
export class PdfUnsupportedTextError extends Error {
  constructor(readonly characters: string[], readonly reason: "font-unavailable" | "no-glyph") {
    super(
      reason === "font-unavailable"
        ? "The fonts needed for this report could not be loaded."
        : `This report contains characters the PDF cannot display: ${characters.join(" ")}`
    );
    this.name = "PdfUnsupportedTextError";
  }
}

/** Characters Helvetica (WinAnsi) can draw: printable ASCII, Latin-1 and the cp1252 extras. */
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split("").map((c) => c.codePointAt(0)!));
const winAnsiHas = (cp: number) => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRAS.has(cp);

/** Invisible formatting marks that need no glyph. */
const NO_GLYPH = /[​-‏‪-‮⁠-⁤︀-️\n\r\t ]/u;

/** One emoji: a pictograph with optional variation selector, skin tone and ZWJ-joined parts, or a flag. */
const EMOJI = /(?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])*(?:‍\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])*)*)/gu;

export interface PreparedText {
  text: string;
  family: string;
  emojiReplaced: number;
}

export interface PdfTextKit {
  /** True when the embedded Unicode fonts are in use (false: Helvetica fallback). */
  unicode: boolean;
  /** Font family for body/label text without Arabic script. */
  baseFamily: string;
  /**
   * The text exactly as it will be drawn and the family to draw it in. Emoji the font lacks are
   * replaced by "[emoji]"; throws `PdfUnsupportedTextError` for any other undrawable character.
   */
  prepare(text: string, style?: "normal" | "bold"): PreparedText;
  /** True when the line's first strong character is right-to-left. */
  isRtl(line: string): boolean;
  /** jsPDF bidi options for one line (undefined: jsPDF's defaults, correct for left-to-right). */
  textOptions(line: string): Record<string, boolean> | undefined;
}

/** Typed-order input, right-to-left base direction, drawn left to right, brackets mirrored. */
const RTL_LINE_OPTIONS = {
  isInputVisual: false,
  isOutputVisual: true,
  isInputRtl: true,
  isOutputRtl: false,
  isSymmetricSwapping: true,
};

type Style = "normal" | "bold";
type Has = (cp: number) => boolean;

function register(doc: jsPDF, family: string, pair: FontPair, files: [string, string]): Record<Style, Has> {
  doc.addFileToVFS(files[0], pair.regular);
  doc.addFont(files[0], family, "normal", "Identity-H");
  doc.addFileToVFS(files[1], pair.bold);
  doc.addFont(files[1], family, "bold", "Identity-H");
  const out = {} as Record<Style, Has>;
  for (const style of ["normal", "bold"] as const) {
    doc.setFont(family, style);
    const codeMap = (doc.internal as unknown as {
      getFont(): { metadata?: { cmap?: { unicode?: { codeMap?: Record<number, number> } } } };
    }).getFont().metadata?.cmap?.unicode?.codeMap;
    if (!codeMap) throw new Error("font has no unicode cmap");
    out[style] = (cp) => !!codeMap[cp];
  }
  return out;
}

export function setupPdfText(doc: jsPDF, fonts: PdfFontFiles): PdfTextKit {
  let latin: Record<Style, Has> | null = null;
  let arabic: Record<Style, Has> | null = null;
  try {
    if (fonts.latin) latin = register(doc, PDF_FONT_FAMILY, fonts.latin, ["SolaceReportSans-Regular.ttf", "SolaceReportSans-Bold.ttf"]);
  } catch {
    latin = null;
  }
  try {
    if (fonts.arabic) arabic = register(doc, PDF_ARABIC_FONT_FAMILY, fonts.arabic, ["SolaceReportArabic-Regular.ttf", "SolaceReportArabic-Bold.ttf"]);
  } catch {
    arabic = null;
  }
  const baseFamily = latin ? PDF_FONT_FAMILY : "helvetica";
  const shape = (text: string): string => {
    const api = doc as unknown as { processArabic?: (t: string) => string };
    return api.processArabic && ARABIC_SCRIPT.test(text) ? api.processArabic(text) : text;
  };

  return {
    unicode: !!latin,
    baseFamily,
    prepare(text, style = "normal") {
      const usesArabic = ARABIC_SCRIPT.test(text);
      if (usesArabic && !arabic) throw new PdfUnsupportedTextError([...new Set(text.match(new RegExp(ARABIC_SCRIPT, "g")) ?? [])], "font-unavailable");
      const family = usesArabic ? PDF_ARABIC_FONT_FAMILY : baseFamily;
      const has: Has = (usesArabic ? arabic : latin)?.[style] ?? winAnsiHas;

      // Emoji the font cannot draw: visible marker, rest of the text kept.
      let emojiReplaced = 0;
      const withMarkers = text.replace(EMOJI, (seq) => {
        const simple = Array.from(seq.replace(/️/g, ""));
        if (simple.length === 1 && has(simple[0].codePointAt(0)!)) return seq;
        emojiReplaced += 1;
        return EMOJI_MARKER;
      });

      const missing = new Set<string>();
      for (const ch of shape(withMarkers)) {
        if (NO_GLYPH.test(ch)) continue;
        if (!has(ch.codePointAt(0)!)) missing.add(ch);
      }
      if (missing.size) {
        // Report what the user typed, not the shaped presentation form.
        const typed = [...missing].map((c) => c.normalize("NFKC"));
        throw new PdfUnsupportedTextError([...new Set(typed)], latin || usesArabic ? "no-glyph" : "font-unavailable");
      }
      return { text: withMarkers, family, emojiReplaced };
    },
    isRtl,
    textOptions: (line) => (isRtl(line) ? { ...RTL_LINE_OPTIONS } : undefined),
  };
}

export function isRtl(line: string): boolean {
  for (const ch of line) {
    if (ARABIC_SCRIPT.test(ch)) return true;
    if (LATIN.test(ch)) return false;
  }
  return false;
}
