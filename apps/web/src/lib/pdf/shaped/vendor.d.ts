// Minimal type declarations for the untyped packages used by the shaped PDF writer.

declare module "harfbuzzjs/hb.js" {
  /** The Emscripten module that hosts HarfBuzz's shaping WebAssembly. */
  export interface HarfBuzzModule {
    HEAPU8: Uint8Array;
  }
  const createHarfBuzz: (options?: { wasmBinary?: ArrayBuffer | Uint8Array; locateFile?: (path: string) => string }) => Promise<HarfBuzzModule>;
  export default createHarfBuzz;
}

declare module "harfbuzzjs/hbjs.js" {
  export interface HbBlob { destroy(): void }
  export interface HbFace { upem: number; destroy(): void }
  export interface HbFont { destroy(): void }
  /** One shaped glyph: id, cluster (UTF-16 offset into the buffer text), advances and offsets in font units. */
  export interface HbGlyph { g: number; cl: number; ax: number; ay: number; dx: number; dy: number }
  export interface HbBuffer {
    addText(text: string): void;
    setDirection(direction: "ltr" | "rtl" | "ttb" | "btt"): void;
    setScript(script: string): void;
    setLanguage(language: string): void;
    guessSegmentProperties(): void;
    json(): HbGlyph[];
    destroy(): void;
  }
  export interface HarfBuzz {
    createBlob(data: ArrayBuffer | Uint8Array): HbBlob;
    createFace(blob: HbBlob, index: number): HbFace;
    createFont(face: HbFace): HbFont;
    createBuffer(): HbBuffer;
    shape(font: HbFont, buffer: HbBuffer, features?: string): void;
  }
  const hbjs: (module: unknown) => HarfBuzz;
  export default hbjs;
}

declare module "bidi-js" {
  export interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }
  export interface Bidi {
    getEmbeddingLevels(text: string, direction?: "ltr" | "rtl"): EmbeddingLevels;
    /** Ranges (inclusive) to reverse, in order, to get the visual order of [start, end]. */
    getReorderSegments(text: string, levels: EmbeddingLevels, start?: number, end?: number): Array<[number, number]>;
  }
  const bidiFactory: () => Bidi;
  export default bidiFactory;
}

declare module "linebreak" {
  /** UAX #14 line breaking. */
  export default class LineBreaker {
    constructor(text: string);
    nextBreak(): { position: number; required: boolean } | null;
  }
}
