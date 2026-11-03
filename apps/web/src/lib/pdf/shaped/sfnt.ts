/**
 * Minimal TrueType table reader for the shaped PDF writer: character map (both directions),
 * horizontal metrics and the names the PDF font dictionaries need. No dependencies.
 */
export interface FontInfo {
  upem: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  ascent: number;
  descent: number;
  capHeight: number;
  postscriptName: string;
  has(codePoint: number): boolean;
  /** The character the font's cmap maps to this glyph, if any. */
  charFor(glyphId: number): string | null;
  /** Advance width in font units. */
  advance(glyphId: number): number;
}

export function parseFont(bytes: Uint8Array): FontInfo {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables: Record<string, number> = {};
  for (let i = 0, n = v.getUint16(4); i < n; i++) {
    const r = 12 + i * 16;
    tables[String.fromCharCode(bytes[r], bytes[r + 1], bytes[r + 2], bytes[r + 3])] = v.getUint32(r + 8);
  }
  const table = (tag: string): number => {
    const off = tables[tag];
    if (off === undefined) throw new Error(`font has no ${tag} table`);
    return off;
  };
  const head = table("head"), hhea = table("hhea"), hmtx = table("hmtx");
  const upem = v.getUint16(head + 18);
  const bbox = { minX: v.getInt16(head + 36), minY: v.getInt16(head + 38), maxX: v.getInt16(head + 40), maxY: v.getInt16(head + 42) };
  const ascent = v.getInt16(hhea + 4), descent = v.getInt16(hhea + 6), numHMetrics = v.getUint16(hhea + 34);
  let capHeight = ascent;
  const os2 = tables["OS/2"];
  if (os2 !== undefined && v.getUint16(os2) >= 2) capHeight = v.getInt16(os2 + 88);

  let postscriptName = "Font";
  const name = tables.name;
  if (name !== undefined) {
    const strings = name + v.getUint16(name + 4);
    for (let i = 0, count = v.getUint16(name + 2); i < count; i++) {
      const r = name + 6 + i * 12;
      if (v.getUint16(r) !== 3 || v.getUint16(r + 6) !== 6) continue;
      const len = v.getUint16(r + 8), off = strings + v.getUint16(r + 10);
      let s = "";
      for (let k = 0; k < len; k += 2) s += String.fromCharCode(v.getUint16(off + k));
      postscriptName = s;
      break;
    }
  }

  // cmap: format 12 if present, else format 4 (Unicode platform).
  const cmap = new Map<number, number>();
  const c = table("cmap");
  const subtables: Array<{ platform: number; off: number }> = [];
  for (let i = 0, n = v.getUint16(c + 2); i < n; i++) {
    const r = c + 4 + i * 8;
    subtables.push({ platform: v.getUint16(r), off: c + v.getUint32(r + 4) });
  }
  const f12 = subtables.find((s) => v.getUint16(s.off) === 12);
  const f4 = subtables.find((s) => v.getUint16(s.off) === 4 && (s.platform === 3 || s.platform === 0));
  if (f12) {
    for (let g = 0, n = v.getUint32(f12.off + 12); g < n; g++) {
      const p = f12.off + 16 + g * 12, start = v.getUint32(p), end = v.getUint32(p + 4), gid0 = v.getUint32(p + 8);
      for (let cp = start; cp <= end; cp++) cmap.set(cp, gid0 + (cp - start));
    }
  } else if (f4) {
    const off = f4.off, segX2 = v.getUint16(off + 6);
    const ends = off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = v.getUint16(ends + s * 2), start = v.getUint16(starts + s * 2), delta = v.getInt16(deltas + s * 2), ro = v.getUint16(ranges + s * 2);
      for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
        let g = ro === 0 ? (cp + delta) & 0xffff : v.getUint16(ranges + s * 2 + ro + (cp - start) * 2);
        if (ro !== 0 && g) g = (g + delta) & 0xffff;
        if (g) cmap.set(cp, g);
      }
    }
  }
  const reverse = new Map<number, number>();
  for (const [cp, g] of cmap) if (!reverse.has(g)) reverse.set(g, cp);

  return {
    upem, bbox, ascent, descent, capHeight, postscriptName,
    has: (cp) => cmap.has(cp),
    charFor: (gid) => (reverse.has(gid) ? String.fromCodePoint(reverse.get(gid)!) : null),
    advance: (gid) => v.getUint16(hmtx + Math.min(gid, numHMetrics - 1) * 4),
  };
}
