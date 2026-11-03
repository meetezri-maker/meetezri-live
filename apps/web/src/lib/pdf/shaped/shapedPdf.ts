/**
 * Shaped PDF text for scripts jsPDF cannot draw correctly (Bengali and other Indic scripts,
 * Arabic-script joining, Thai/Khmer/Myanmar, CJK…).
 *
 * Pipeline per paragraph: script itemisation and font choice (from a build-time coverage manifest,
 * so fonts are downloaded only when a transcript needs them) → Unicode bidi (UAX #9, isolates
 * honoured; isolate controls are kept and drawn invisibly) → line breaking (UAX #14, plus
 * dictionary word breaks for Thai/Lao/Khmer/Myanmar) → HarfBuzz shaping → positioned glyphs in a
 * pdf-lib document. Fonts are embedded as HarfBuzz subsets (original glyph ids kept). Each line
 * carries its original text as /ActualText; per-glyph ToUnicode is written in logical order so
 * viewers that ignore ActualText still recover as much text as the shaping allows.
 *
 * Runs in a Web Worker in the app; WebAssembly, manifest and fonts come from `ShapingAssets`.
 * Emoji follow the existing PDF rule: a sequence the text font cannot draw becomes "[emoji]".
 */
import createHarfBuzz from "harfbuzzjs/hb.js";
import hbjs, { type HarfBuzz, type HbFace, type HbFont, type HbGlyph } from "harfbuzzjs/hbjs.js";
import bidiFactory, { type EmbeddingLevels } from "bidi-js";
import LineBreaker from "linebreak";
import { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFOperator, PDFOperatorNames as Ops, PDFString, type PDFPage, type PDFRef } from "pdf-lib";
import { parseFont, type FontInfo } from "./sfnt";

type OperatorArgs = NonNullable<Parameters<typeof PDFOperator.of>[1]>;

export const EMOJI_MARKER = "[emoji]";

// ---------------------------------------------------------------------------------------------
// Assets and runtime
// ---------------------------------------------------------------------------------------------

export interface FontManifest {
  version: string;
  faces: Record<string, { file: string; bytes: number; ranges: Array<[number, number]> }>;
}
/** Where the WebAssembly, the coverage manifest and the fonts come from (fetch in the app). */
export interface ShapingAssets {
  hbWasm(): Promise<ArrayBuffer | Uint8Array>;
  subsetWasm(): Promise<ArrayBuffer | Uint8Array>;
  manifest(): Promise<FontManifest>;
  font(file: string): Promise<Uint8Array>;
}
export interface ShapingProgress {
  stage: "fonts";
  loaded: number;
  total: number;
}

/** No bundled font can draw these characters; nothing was downloaded or drawn. */
export class UnsupportedCharactersError extends Error {
  constructor(readonly characters: string[]) {
    super(`No bundled font can draw ${characters.length} character(s)`);
    this.name = "UnsupportedCharactersError";
  }
}
/** A font (or the coverage manifest) could not be loaded. */
export class FontLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FontLoadError";
  }
}

interface SubsetExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(ptr: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_length(blob: number): number;
  hb_blob_get_data(blob: number, lengthPtr: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_glyph_set(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_set_add(set: number, value: number): void;
  hb_subset_or_fail(face: number, input: number): number;
}

export interface ShapingRuntime {
  hb: HarfBuzz;
  subset: SubsetExports;
  assets: ShapingAssets;
  manifest: FontManifest;
}

export async function createShapingRuntime(assets: ShapingAssets): Promise<ShapingRuntime> {
  const [hbBinary, subsetBinary, manifest] = await Promise.all([
    assets.hbWasm(),
    assets.subsetWasm(),
    assets.manifest().catch((e: unknown) => { throw new FontLoadError(`font manifest: ${String((e as Error)?.message ?? e)}`); }),
  ]);
  const [hbModule, subsetInstance] = await Promise.all([
    createHarfBuzz({ wasmBinary: hbBinary }),
    WebAssembly.instantiate(subsetBinary as BufferSource),
  ]);
  return { hb: hbjs(hbModule), subset: subsetInstance.instance.exports as unknown as SubsetExports, assets, manifest };
}

// ---------------------------------------------------------------------------------------------
// Scripts and font families
// ---------------------------------------------------------------------------------------------

const FAMILY: Record<string, string> = {
  Latin: "NotoSans", Greek: "NotoSans", Cyrillic: "NotoSans", Arabic: "NotoNaskhArabic", Hebrew: "NotoSansHebrew",
  Bengali: "NotoSansBengali", Devanagari: "NotoSansDevanagari", Gurmukhi: "NotoSansGurmukhi", Gujarati: "NotoSansGujarati",
  Tamil: "NotoSansTamil", Telugu: "NotoSansTelugu", Kannada: "NotoSansKannada", Malayalam: "NotoSansMalayalam",
  Sinhala: "NotoSansSinhala", Thai: "NotoSansThai", Lao: "NotoSansLao", Khmer: "NotoSansKhmer", Myanmar: "NotoSansMyanmar",
  Tibetan: "NotoSerifTibetan", Armenian: "NotoSansArmenian", Georgian: "NotoSansGeorgian", Ethiopic: "NotoSansEthiopic",
  Hangul: "NotoSansKR", Hiragana: "NotoSansJP", Katakana: "NotoSansJP",
};
const HB_SCRIPT: Record<string, string> = {
  Latin: "Latn", Greek: "Grek", Cyrillic: "Cyrl", Arabic: "Arab", Hebrew: "Hebr", Bengali: "Beng", Devanagari: "Deva",
  Gurmukhi: "Guru", Gujarati: "Gujr", Tamil: "Taml", Telugu: "Telu", Kannada: "Knda", Malayalam: "Mlym", Sinhala: "Sinh", Thai: "Thai",
  Lao: "Laoo", Khmer: "Khmr", Myanmar: "Mymr", Tibetan: "Tibt", Armenian: "Armn", Georgian: "Geor", Ethiopic: "Ethi", Hangul: "Hang",
  Hiragana: "Hira", Katakana: "Kana", Han: "Hani",
};
const SCRIPT_RE = Object.keys(HB_SCRIPT).map((s) => [s, new RegExp(`\\p{Script=${s}}`, "u")] as const);
const SCX: Array<[RegExp, string | null]> = [
  [/\p{scx=Deva}/u, "NotoSansDevanagari"], [/\p{scx=Beng}/u, "NotoSansBengali"], [/\p{scx=Arab}/u, "NotoNaskhArabic"],
  [/\p{scx=Hani}/u, null], [/\p{scx=Hira}/u, "NotoSansJP"], [/\p{scx=Hang}/u, "NotoSansKR"],
];
const FALLBACK = [...new Set(["NotoSans", "NotoSansDevanagari", "NotoSansBengali", "NotoNaskhArabic", "NotoSansHebrew",
  "NotoSansSC", "NotoSansJP", "NotoSansKR", "NotoSansTC", ...Object.values(FAMILY)])];
/** Invisible characters drawn with the neighbouring font (bidi controls, joiners, variation selectors). */
const IGNORABLE = /[\p{Default_Ignorable_Code_Point}‌‍︎️]/u;
const SA = new Set(["Thai", "Lao", "Khmer", "Myanmar"]);
const CJK_RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯ー]/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL = /\p{Script=Hangul}/u;

function scriptOf(ch: string): string {
  for (const [s, re] of SCRIPT_RE) if (re.test(ch)) return s;
  if (/\p{Script=Inherited}/u.test(ch)) return "Inherited";
  return "Common";
}

/**
 * Han font per CJK run (Han, kana, Hangul and CJK punctuation written together), never from other
 * runs or messages: kana in the run → Japanese; Hangul → Korean; otherwise the reader's locale
 * (zh-TW / zh-HK / zh-MO / zh-Hant / yue → Traditional Chinese, ja → Japanese, ko → Korean);
 * otherwise Simplified Chinese. Without per-message language data this is a guess: Japanese text
 * written only in kanji, or Traditional Chinese read with another locale, gets Simplified Chinese
 * glyph forms (the characters are still drawn).
 */
export function hanFamilyForRun(run: string, locale: string | undefined): string {
  if (KANA.test(run)) return "NotoSansJP";
  if (HANGUL.test(run)) return "NotoSansKR";
  const loc = (locale ?? "").toLowerCase();
  if (/^(zh-(tw|hk|mo|hant)|yue)/.test(loc)) return "NotoSansTC";
  if (/^ja/.test(loc)) return "NotoSansJP";
  if (/^ko/.test(loc)) return "NotoSansKR";
  return "NotoSansSC";
}

// One emoji: pictograph with optional variation selector, skin tone and ZWJ-joined parts, or a flag
// (the same rule as the app's jsPDF text kit).
const EMOJI = /(?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])*(?:‍\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])*)*)/gu;

// ---------------------------------------------------------------------------------------------
// Embedded font
// ---------------------------------------------------------------------------------------------

class EmbeddedFont {
  readonly info: FontInfo;
  readonly upem: number;
  readonly ascent: number;
  readonly descent: number;
  readonly ref: PDFRef;
  private readonly face: HbFace;
  private readonly hbFont: HbFont;
  private readonly used = new Set<number>([0]);
  private readonly widths = new Map<number, number>();
  private readonly toUnicode = new Map<number, string>();

  constructor(private readonly rt: ShapingRuntime, doc: PDFDocument, readonly key: string, readonly file: string, private readonly bytes: Uint8Array) {
    this.info = parseFont(bytes);
    const blob = rt.hb.createBlob(bytes);
    this.face = rt.hb.createFace(blob, 0);
    this.hbFont = rt.hb.createFont(this.face);
    blob.destroy();
    this.upem = this.info.upem;
    this.ascent = this.info.ascent / this.upem;
    this.descent = this.info.descent / this.upem;
    this.ref = doc.context.nextRef();
  }

  shape(text: string, dir: "ltr" | "rtl", script: string | undefined, lang: string | undefined): HbGlyph[] {
    const buf = this.rt.hb.createBuffer();
    try {
      buf.addText(text);
      buf.setDirection(dir);
      if (script) buf.setScript(script);
      if (lang) buf.setLanguage(lang);
      buf.guessSegmentProperties();
      this.rt.hb.shape(this.hbFont, buf);
      return buf.json();
    } finally {
      buf.destroy();
    }
  }

  cmapChar(gid: number): string | null {
    return this.info.charFor(gid);
  }

  /** Marks a glyph as used; ToUnicode is its own cmap character, else `text` (first use wins). */
  use(gid: number, text: string): void {
    this.used.add(gid);
    if (!this.widths.has(gid)) {
      this.widths.set(gid, Math.round((this.info.advance(gid) * 1000) / this.upem));
      const c = this.cmapChar(gid);
      if (c) this.toUnicode.set(gid, c);
    }
    if (text && !this.toUnicode.has(gid)) this.toUnicode.set(gid, text);
  }

  private subsetBytes(): Uint8Array {
    const e = this.rt.subset;
    const ptr = e.malloc(this.bytes.length);
    new Uint8Array(e.memory.buffer, ptr, this.bytes.length).set(this.bytes);
    const blob = e.hb_blob_create(ptr, this.bytes.length, 2, 0, 0);
    const face = e.hb_face_create(blob, 0);
    e.hb_blob_destroy(blob);
    const input = e.hb_subset_input_create_or_fail();
    try {
      const glyphs = e.hb_subset_input_glyph_set(input);
      for (const g of this.used) e.hb_set_add(glyphs, g);
      e.hb_subset_input_set_flags(input, 0x1 /* NO_HINTING */ | 0x2 /* RETAIN_GIDS */);
      const sub = e.hb_subset_or_fail(face, input);
      if (!sub) throw new Error(`font subsetting failed for ${this.file}`);
      const out = e.hb_face_reference_blob(sub);
      const result = new Uint8Array(new Uint8Array(e.memory.buffer, e.hb_blob_get_data(out, 0), e.hb_blob_get_length(out)));
      e.hb_blob_destroy(out);
      e.hb_face_destroy(sub);
      return result;
    } finally {
      e.hb_subset_input_destroy(input);
      e.hb_face_destroy(face);
      e.free(ptr);
    }
  }

  finalize(doc: PDFDocument): void {
    const bytes = this.subsetBytes();
    const ctx = doc.context;
    const idx = Number(this.key.slice(1));
    const tag = Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + (Math.floor(idx / 26 ** i) % 26))).join("");
    const psName = `${tag}+${this.info.postscriptName.replace(/[^A-Za-z0-9-]/g, "")}`;
    const s = (val: number) => Math.round((val * 1000) / this.upem);
    const b = this.info.bbox;
    const descriptor = ctx.obj({
      Type: "FontDescriptor", FontName: psName, Flags: 4, FontBBox: [s(b.minX), s(b.minY), s(b.maxX), s(b.maxY)],
      ItalicAngle: 0, Ascent: s(this.info.ascent), Descent: s(this.info.descent), CapHeight: s(this.info.capHeight), StemV: 80,
      FontFile2: ctx.register(ctx.flateStream(bytes, { Length1: bytes.length })),
    });
    const W: Array<number | number[]> = [];
    for (const [gid, w] of [...this.widths.entries()].sort((x, y) => x[0] - y[0])) W.push(gid, [w]);
    const cid = ctx.obj({
      Type: "Font", Subtype: "CIDFontType2", BaseFont: psName, CIDToGIDMap: "Identity",
      CIDSystemInfo: { Registry: PDFString.of("Adobe"), Ordering: PDFString.of("Identity"), Supplement: 0 },
      FontDescriptor: ctx.register(descriptor), W,
    });
    ctx.assign(this.ref, ctx.obj({
      Type: "Font", Subtype: "Type0", BaseFont: psName, Encoding: "Identity-H",
      DescendantFonts: [ctx.register(cid)], ToUnicode: ctx.register(ctx.flateStream(toUnicodeCMap(this.toUnicode))),
    }));
  }

  release(): void {
    this.hbFont.destroy();
    this.face.destroy();
  }
}

const utf16hex = (t: string) => {
  let h = "";
  for (let i = 0; i < t.length; i++) h += t.charCodeAt(i).toString(16).padStart(4, "0");
  return h.toUpperCase();
};
function toUnicodeCMap(map: Map<number, string>): string {
  const entries = [...map.entries()].filter(([, t]) => t).sort((a, b) => a[0] - b[0]);
  let body = "";
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    body += `${chunk.length} beginbfchar\n${chunk.map(([g, t]) => `<${g.toString(16).padStart(4, "0").toUpperCase()}> <${utf16hex(t)}>`).join("\n")}\nendbfchar\n`;
  }
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${body}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
}

// ---------------------------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------------------------

/** RGB, 0–255. */
export type Rgb = [number, number, number];

/** One laid-out line: its height (pt) and a function drawing it with its top at `top` (pt from the page top). */
export interface ShapedLine {
  height: number;
  ascent: number;
  draw(page: PDFPage, x: number, top: number, color: Rgb): void;
}

export interface ParagraphOptions {
  size: number;
  bold?: boolean;
  /** Box width in pt; right-to-left paragraphs align to its right edge. */
  width: number;
  lang?: string;
  baseDir?: "ltr" | "rtl";
}

const bidi = bidiFactory();
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export class ShapedPdfWriter {
  private readonly fonts = new Map<string, EmbeddedFont>();
  private readonly hanCache = new Map<string, string[]>();
  glyphCount = 0;

  constructor(readonly runtime: ShapingRuntime, readonly doc: PDFDocument, private readonly locale: string | undefined) {}

  static async create(runtime: ShapingRuntime, { title, locale }: { title: string; locale?: string }): Promise<ShapedPdfWriter> {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    doc.setCreator("Solace");
    doc.setProducer("Solace");
    return new ShapedPdfWriter(runtime, doc, locale);
  }

  private face(family: string, bold: boolean) {
    const faces = this.runtime.manifest.faces;
    return faces[`${family}-${bold ? "Bold" : "Regular"}`] ?? faces[`${family}-Regular`];
  }
  private covers(family: string, bold: boolean, cp: number): boolean {
    const f = this.face(family, bold);
    if (!f) return false;
    let lo = 0, hi = f.ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, [a, b] = f.ranges[mid];
      if (cp < a) hi = mid - 1; else if (cp > b) lo = mid + 1; else return true;
    }
    return false;
  }

  /** Script per UTF-16 unit; inherited/common characters take the neighbouring script. */
  private itemize(text: string): string[] {
    const n = text.length, scripts = new Array<string>(n).fill("Common");
    for (let i = 0; i < n;) {
      const ch = String.fromCodePoint(text.codePointAt(i)!);
      const s = IGNORABLE.test(ch) ? "Inherited" : scriptOf(ch);
      for (let k = 0; k < ch.length; k++) scripts[i + k] = s;
      i += ch.length;
    }
    let prev: string | null = null;
    for (let i = 0; i < n; i++) { if (scripts[i] === "Inherited") scripts[i] = prev ?? "Common"; else if (scripts[i] !== "Common") prev = scripts[i]; }
    const first = scripts.find((s) => s !== "Common") ?? "Latin";
    prev = null;
    for (let i = 0; i < n; i++) { if (scripts[i] === "Common") scripts[i] = prev ?? first; else prev = scripts[i]; }
    return scripts;
  }

  /** Han font family for each UTF-16 unit of the paragraph, decided per CJK run. */
  private hanFamilies(text: string): string[] {
    const cached = this.hanCache.get(text);
    if (cached) return cached;
    const out = new Array<string>(text.length).fill("NotoSansSC");
    for (let i = 0; i < text.length;) {
      if (!CJK_RUN.test(text[i])) { i++; continue; }
      let j = i;
      while (j < text.length && (CJK_RUN.test(text[j]) || /[\uD800-\uDFFF]/.test(text[j]))) j++;
      out.fill(hanFamilyForRun(text.slice(i, j), this.locale), i, j);
      i = j;
    }
    this.hanCache.set(text, out);
    return out;
  }

  /** The family that draws a character (decided from the manifest; nothing is downloaded). */
  private familyFor(cp: number, script: string, bold: boolean, han: string): string | null {
    const preferred = script === "Han" ? han : FAMILY[script] ?? "NotoSans";
    if (this.covers(preferred, bold, cp)) return preferred;
    if (this.covers("NotoSans", bold, cp)) return "NotoSans";
    const ch = String.fromCodePoint(cp);
    for (const [re, fam] of SCX) { const f = fam ?? han; if (re.test(ch) && this.covers(f, bold, cp)) return f; }
    for (const f of FALLBACK) if (this.covers(f, bold, cp)) return f;
    return null;
  }

  /** Emoji the text font cannot draw become "[emoji]" (single symbols the font covers are kept). */
  prepareText(text: string): { text: string; emoji: number } {
    let emoji = 0;
    const out = text.replace(EMOJI, (seq) => {
      const simple = Array.from(seq.replace(/️/g, ""));
      if (simple.length === 1 && this.covers("NotoSans", false, simple[0].codePointAt(0)!)) return seq;
      emoji += 1;
      return EMOJI_MARKER;
    });
    return { text: out, emoji };
  }

  /**
   * Downloads every font the strings need (and only those). Throws UnsupportedCharactersError,
   * before any font download, if some character has no bundled font.
   */
  async ensureFonts(regular: string[], bold: string[], onProgress?: (p: ShapingProgress) => void): Promise<void> {
    const files = new Set<string>([this.face("NotoSans", false)!.file]);
    const missing = new Set<string>();
    for (const [list, isBold] of [[regular, false], [bold, true]] as const) {
      for (const s of list) for (const para of s.split("\n")) {
        const scripts = this.itemize(para), han = this.hanFamilies(para);
        for (let i = 0; i < para.length;) {
          const cp = para.codePointAt(i)!, ch = String.fromCodePoint(cp);
          if (!IGNORABLE.test(ch) && !/\s/.test(ch) && !/\p{Cc}/u.test(ch)) {
            const fam = this.familyFor(cp, scripts[i], isBold, han[i]);
            if (fam) files.add(this.face(fam, isBold)!.file); else missing.add(ch);
          }
          i += ch.length;
        }
      }
    }
    if (missing.size) throw new UnsupportedCharactersError([...missing]);
    const pending = [...files].filter((f) => !this.fonts.has(f));
    let loaded = 0;
    onProgress?.({ stage: "fonts", loaded, total: pending.length });
    await Promise.all(pending.map(async (file) => {
      let bytes: Uint8Array;
      try { bytes = await this.runtime.assets.font(file); } catch (e) { throw new FontLoadError(`${file}: ${String((e as Error)?.message ?? e)}`); }
      this.fonts.set(file, new EmbeddedFont(this.runtime, this.doc, `F${this.fonts.size + 1}`, file, bytes));
      loaded += 1;
      onProgress?.({ stage: "fonts", loaded, total: pending.length });
    }));
  }

  private font(family: string, bold: boolean): EmbeddedFont {
    const face = this.face(family, bold);
    const f = face && this.fonts.get(face.file);
    if (!f) throw new Error(`font not loaded: ${family}`);
    return f;
  }

  /** Width of a single-direction Latin label in pt (for right-aligned footers). */
  measure(text: string, size: number, bold = false): number {
    const f = this.font("NotoSans", bold);
    return f.shape(text, "ltr", "Latn", undefined).reduce((s, g) => s + (g.ax * size) / f.upem, 0);
  }

  /** Lays out one paragraph (no "\n") into lines: itemise, bidi, break, shape. */
  layoutParagraph(text: string, o: ParagraphOptions): ShapedLine[] {
    const { size, bold = false, width, lang, baseDir } = o;
    if (!text) return [{ height: size * 1.4, ascent: size, draw: () => undefined }];
    const n = text.length;
    const scripts = this.itemize(text), han = this.hanFamilies(text);
    const fontAt = new Array<EmbeddedFont | null>(n).fill(null);
    for (let i = 0; i < n;) {
      const cp = text.codePointAt(i)!, ch = String.fromCodePoint(cp);
      let f: EmbeddedFont | null = null;
      if (i > 0 && (IGNORABLE.test(ch) || /\s/.test(ch))) f = fontAt[i - 1];
      if (!f) { const fam = this.familyFor(cp, scripts[i], bold, han[i]); f = fam ? this.font(fam, bold) : null; }
      for (let k = 0; k < ch.length; k++) fontAt[i + k] = f;
      i += ch.length;
    }
    for (let i = n - 2; i >= 0; i--) if (!fontAt[i]) fontAt[i] = fontAt[i + 1];
    for (let i = 0; i < n; i++) if (!fontAt[i]) fontAt[i] = this.font("NotoSans", bold);

    const emb: EmbeddingLevels = bidi.getEmbeddingLevels(text, baseDir);
    const levels = emb.levels, paraLevel = emb.paragraphs[0]?.level ?? 0;
    interface Run { start: number; end: number; font: EmbeddedFont; script: string; level: number }
    const runs: Run[] = [];
    for (let i = 0; i < n;) {
      let j = i + 1;
      while (j < n && fontAt[j] === fontAt[i] && scripts[j] === scripts[i] && levels[j] === levels[i]) j++;
      runs.push({ start: i, end: j, font: fontAt[i]!, script: scripts[i], level: levels[i] });
      i = j;
    }
    const runIndex = new Int32Array(n);
    runs.forEach((r, k) => runIndex.fill(k, r.start, r.end));
    const adv = new Float64Array(n);
    for (const r of runs) {
      for (const g of r.font.shape(text.slice(r.start, r.end), r.level % 2 ? "rtl" : "ltr", HB_SCRIPT[r.script], lang)) adv[r.start + g.cl] += (g.ax * size) / r.font.upem;
    }

    // Break opportunities: UAX #14, plus dictionary word boundaries for Thai/Lao/Khmer/Myanmar.
    const breaks = new Set<number>();
    const lb = new LineBreaker(text);
    for (let bk = lb.nextBreak(); bk; bk = lb.nextBreak()) breaks.add(bk.position);
    for (const seg of new Intl.Segmenter(lang || undefined, { granularity: "word" }).segment(text)) {
      if (seg.index > 0 && SA.has(scripts[seg.index]) && SA.has(scripts[seg.index - 1])) breaks.add(seg.index);
    }
    const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((g) => g.index);
    const isSpace = (i: number) => /\s/.test(text[i]);
    const widthOf = (a: number, b: number) => { let e = b; while (e > a && isSpace(e - 1)) e--; let w = 0; for (let i = a; i < e; i++) w += adv[i]; return w; };
    const ranges: Array<[number, number]> = [];
    let start = 0, lastFit = -1;
    for (const p of [...breaks].sort((a, b) => a - b)) {
      if (p <= start) continue;
      if (widthOf(start, p) <= width) { lastFit = p; continue; }
      if (lastFit > start) { ranges.push([start, lastFit]); start = lastFit; }
      while (widthOf(start, p) > width) {
        // A single word wider than the line: split it between graphemes.
        let cut = start;
        for (const gi of graphemes) { if (gi <= start) continue; if (gi > p) break; if (widthOf(start, gi) <= width) cut = gi; else break; }
        if (cut === start) cut = graphemes.find((gi) => gi > start) ?? p;
        ranges.push([start, cut]);
        start = cut;
      }
      lastFit = p;
    }
    if (start < n) ranges.push([start, n]);

    return ranges.map(([a, b]) => {
      let e = b;
      while (e > a && isSpace(e - 1)) e--;
      // Visual order of the line (UAX #9 L2), then pieces of one run with contiguous logical indices.
      const order: number[] = [];
      for (let i = a; i < b; i++) order.push(i);
      if (e > a) for (const [s0, t0] of bidi.getReorderSegments(text, emb, a, b - 1)) {
        const rev = order.slice(s0 - a, t0 - a + 1).reverse();
        order.splice(s0 - a, rev.length, ...rev);
      }
      const pieces: Array<{ run: Run; min: number; max: number }> = [];
      for (const i of order) {
        if (i >= e) continue;
        const r = runs[runIndex[i]], last = pieces[pieces.length - 1];
        if (last && last.run === r && (i === last.max + 1 || i === last.min - 1)) { last.min = Math.min(last.min, i); last.max = Math.max(last.max, i); }
        else pieces.push({ run: r, min: i, max: i });
      }
      const shaped = pieces.map((pc) => {
        const s = text.slice(pc.min, pc.max + 1);
        const glyphs = pc.run.font.shape(s, pc.run.level % 2 ? "rtl" : "ltr", HB_SCRIPT[pc.run.script], lang);
        return { font: pc.run.font, s, glyphs, width: glyphs.reduce((acc, g) => acc + (g.ax * size) / pc.run.font.upem, 0) };
      });
      const lineWidth = shaped.reduce((acc, p) => acc + p.width, 0);
      const used = new Set(shaped.map((p) => p.font));
      const asc = Math.max(0.9, ...[...used].map((f) => f.ascent)) * size;
      const desc = Math.max(0.25, ...[...used].map((f) => -f.descent)) * size;
      const logical = text.slice(a, b);
      return {
        height: asc + desc + size * 0.15,
        ascent: asc,
        draw: (page: PDFPage, x0: number, top: number, color: Rgb) => {
          const baseline = page.getHeight() - (top + asc);
          const ops: PDFOperator[] = [
            // BDC takes an inline property-list dictionary; pdf-lib writes it correctly but its operand type omits dictionaries.
            PDFOperator.of(Ops.BeginMarkedContentSequence, [PDFName.of("Span"), this.doc.context.obj({ ActualText: PDFHexString.fromText(logical) })] as unknown as OperatorArgs),
            PDFOperator.of(Ops.BeginText),
            PDFOperator.of(Ops.NonStrokingColorRgb, color.map((c) => PDFNumber.of(Math.round((c / 255) * 1000) / 1000))),
          ];
          let cx = paraLevel % 2 ? x0 + width - lineWidth : x0;
          for (const p of shaped) {
            const k = p.font.upem;
            ops.push(PDFOperator.of(Ops.SetFontAndSize, [PDFName.of(p.font.key), PDFNumber.of(size)]));
            page.node.setFontDictionary(PDFName.of(p.font.key), p.font.ref);
            // Cluster text (NFD) and which characters each glyph accounts for.
            const starts = [...new Set(p.glyphs.map((g) => g.cl))].sort((x, y) => x - y);
            const clusterText = (cl: number) => p.s.slice(cl, starts[starts.indexOf(cl) + 1] ?? p.s.length).normalize("NFD");
            const pending = new Map(starts.map((cl) => [cl, [...clusterText(cl)]]));
            const placed = p.glyphs.map((g, vi) => {
              const pos = { g, vi, x: cx + (g.dx * size) / k, y: baseline + (g.dy * size) / k, text: "", rank: -1 };
              cx += (g.ax * size) / k;
              return pos;
            });
            for (const pg of placed) {
              const c = p.font.cmapChar(pg.g.g);
              if (!c) continue;
              const nfd = [...c.normalize("NFD")], rest = pending.get(pg.g.cl)!;
              pg.rank = clusterText(pg.g.cl).indexOf(nfd[0]);
              for (const ch of nfd) { const at = rest.indexOf(ch); if (at >= 0) rest.splice(at, 1); }
            }
            for (const pg of placed) {
              if (pg.rank !== -1) continue;
              pg.text = pending.get(pg.g.cl)!.join("");
              pending.set(pg.g.cl, []);
              pg.rank = pg.text ? clusterText(pg.g.cl).indexOf(pg.text[0]) : 1e6;
            }
            // Logical order (cluster, then character) at the visual positions.
            placed.sort((x, y) => x.g.cl - y.g.cl || x.rank - y.rank || x.vi - y.vi);
            for (const pg of placed) {
              p.font.use(pg.g.g, pg.text);
              ops.push(PDFOperator.of(Ops.SetTextMatrix, [1, 0, 0, 1, pg.x, pg.y].map((v) => PDFNumber.of(round3(v)))));
              ops.push(PDFOperator.of(Ops.ShowText, [PDFHexString.of(pg.g.g.toString(16).padStart(4, "0"))]));
              this.glyphCount++;
            }
          }
          ops.push(PDFOperator.of(Ops.EndText), PDFOperator.of(Ops.EndMarkedContent));
          page.pushOperators(...ops);
        },
      };
    });
  }

  async save(): Promise<Uint8Array> {
    for (const f of this.fonts.values()) f.finalize(this.doc);
    const bytes = await this.doc.save({ useObjectStreams: true });
    for (const f of this.fonts.values()) f.release();
    return bytes;
  }

  /** Fonts embedded in this document (file names), for diagnostics and tests. */
  fontFiles(): string[] {
    return [...this.fonts.keys()];
  }
}
