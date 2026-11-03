/**
 * Test helper: reads a shaped PDF back from its content streams — each line's /ActualText (the
 * text as stored) with the glyphs drawn for it (positions, font BaseFont), per page.
 */
import zlib from 'zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';

export interface ShapedSpan { text: string; glyphs: Array<{ x: number; y: number; gid: number; font: string }> }

export async function readShapedPdf(bytes: Uint8Array): Promise<Array<{ spans: ShapedSpan[]; text: string[] }>> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const fonts = new Map<string, string>();
    const res = page.node.Resources();
    const fontDict = res?.lookupMaybe(PDFName.of('Font'), PDFDict);
    for (const [key, ref] of fontDict?.entries() ?? []) {
      const f = pdf.context.lookup(ref as PDFRef, PDFDict);
      fonts.set(key.decodeText(), f.lookup(PDFName.of('BaseFont'), PDFName).decodeText());
    }
    const contents = page.node.get(PDFName.of('Contents'));
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    let ops = '';
    for (const r of refs) {
      const s = pdf.context.lookup(r as PDFRef) as PDFRawStream;
      const raw = Buffer.from(s.contents);
      try { ops += zlib.inflateSync(raw).toString('latin1'); } catch { ops += raw.toString('latin1'); }
    }
    const spans: ShapedSpan[] = [];
    const re = /\/ActualText <FEFF([0-9A-F]*)>[\s\S]*?BDC([\s\S]*?)EMC/g;
    for (let m = re.exec(ops); m; m = re.exec(ops)) {
      let text = '';
      for (let i = 0; i < m[1].length; i += 4) text += String.fromCharCode(parseInt(m[1].slice(i, i + 4), 16));
      const glyphs: ShapedSpan['glyphs'] = [];
      let font = '';
      for (const g of m[2].matchAll(/\/(F\d+) [\d.]+ Tf|1 0 0 1 ([\d.-]+) ([\d.-]+) Tm\s*<([0-9a-f]{4})> Tj/gi)) {
        if (g[1]) font = fonts.get(g[1]) ?? g[1];
        else glyphs.push({ x: Number(g[2]), y: Number(g[3]), gid: parseInt(g[4], 16), font });
      }
      spans.push({ text, glyphs });
    }
    return { spans, text: spans.map((s) => s.text) };
  });
}
