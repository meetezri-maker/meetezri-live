/**
 * Journal Export PDF — tests against the real jsPDF engine and the bundled fonts. Text is read
 * back from the content streams (glyph IDs mapped through the embedded fonts), so assertions see
 * exactly what is drawn, left to right.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import type { jsPDF } from "jspdf";
import { buildJournalPdf, formatJournalRange, journalNeedsArabicFont, type JournalPdfInput } from "./journalExportPdf";
import {
  PDF_ARABIC_FONT_FAMILY,
  PDF_FONT_FAMILY,
  PdfUnsupportedTextError,
  type PdfFontFiles,
} from "@/app/features/goals/progress-report/progress-report.pdf-text";
import type { JournalExportEntry } from "./journalExport";

const FONT_DIR = path.resolve(process.cwd(), "public/fonts/pdf");
const readFont = (f: string) => fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
let fonts: PdfFontFiles;
beforeAll(() => {
  fonts = {
    latin: { regular: readFont("DejaVuSans.ttf"), bold: readFont("DejaVuSans-Bold.ttf") },
    arabic: { regular: readFont("Amiri-Regular.ttf"), bold: readFont("Amiri-Bold.ttf") },
  };
});

const entry = (id: string, over: Partial<JournalExportEntry> = {}): JournalExportEntry => ({
  id, title: `Entry ${id}`, content: "<div>A quiet day.</div>", mood_tags: ["calm"], is_private: false, location: null,
  created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", ...over,
});

const input = (entries: JournalExportEntry[], over: Partial<JournalPdfInput> = {}): JournalPdfInput => ({
  entries, dateFrom: "2026-10-01", dateTo: "2026-10-28", generatedAt: new Date("2026-10-28T10:00:00.000Z"), timeZone: "Asia/Karachi", ...over,
});

type Internal = { pages: string[][]; getFont(): { id: string; metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } } };
const rev = (s: string) => Array.from(s).reverse().join("");

function drawnPages(doc: jsPDF): string[][] {
  const internal = doc.internal as unknown as Internal;
  const byFont = new Map<string, Map<number, string>>();
  const families = Object.keys(doc.getFontList()).filter((f) => f === PDF_FONT_FAMILY || f === PDF_ARABIC_FONT_FAMILY);
  for (const [family, style] of families.flatMap((f) => (["normal", "bold"] as const).map((s) => [f, s] as const))) {
    doc.setFont(family, style);
    const font = internal.getFont();
    const map = new Map<number, string>();
    for (const [cp, gid] of Object.entries(font.metadata.cmap.unicode.codeMap)) {
      const c = Number(cp);
      if (!map.has(gid) || c < 0xfb50) map.set(gid, String.fromCodePoint(c));
    }
    byFont.set(font.id, map);
  }
  return internal.pages.slice(1).map((ops) => {
    const lines: string[] = [];
    const re = /\/(F\d+)\s+[\d.]+\s+Tf[\s\S]*?<([0-9A-Fa-f]+)>\s*Tj/g;
    const body = ops.join("\n");
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const map = byFont.get(m[1]);
      let s = "";
      for (let i = 0; i < m[2].length; i += 4) {
        const ch = map?.get(parseInt(m[2].slice(i, i + 4), 16)) ?? "�";
        s += /[ﻵ-ﻼ]/.test(ch) ? rev(ch.normalize("NFKC")) : ch;
      }
      lines.push(s.normalize("NFKC").replace(/ /g, " "));
    }
    return lines;
  });
}

/** Left-to-right drawing order of a right-to-left line (digit runs kept, brackets mirrored). */
const rtlVisual = (s: string) =>
  rev(s).replace(/[0-9]+/g, (d) => rev(d)).replace(/[()[\]]/g, (c) => ({ "(": ")", ")": "(", "[": "]", "]": "[" })[c]!);

async function build(i: JournalPdfInput, f: PdfFontFiles = fonts) {
  const built = await buildJournalPdf(i, { fonts: f, logo: null });
  return { ...built, pages: drawnPages(built.doc) };
}

describe("journal PDF content", () => {
  it("states the selection, generation time, time zone and count, with page numbers", async () => {
    const { pages } = await build(input([entry("a"), entry("b"), entry("c")]));
    const all = pages.flat();
    expect(all).toContain("Journal Export");
    expect(all).toContain("Dates: 1 Oct 2026 – 28 Oct 2026 (inclusive)");
    expect(all).toContain("Generated: 28 Oct 2026, 15:00 (Asia/Karachi)");
    expect(all).toContain("3 entries");
    pages.forEach((lines, i) => expect(lines).toContain(`Page ${i + 1} of ${pages.length}`));
  });

  it("labels partial ranges and no range", () => {
    expect(formatJournalRange("2026-10-01", "").replace(/ /g, " ")).toBe("From 1 Oct 2026 (inclusive)");
    expect(formatJournalRange("", "2026-10-28").replace(/ /g, " ")).toBe("Up to and including 28 Oct 2026");
    expect(formatJournalRange("", "")).toBe("All dates");
  });

  it("shows each entry's title, recorded time, mood labels and favorite, newest first", async () => {
    const all = (
      await build(input([
        entry("older", { title: "Older", created_at: "2026-10-01T04:00:00.000Z" }),
        entry("newer", { title: "Newer", mood_tags: ["calm", "😊"], favorite: true }),
      ]))
    ).pages.flat();
    expect(all.indexOf("Newer")).toBeLessThan(all.indexOf("Older"));
    expect(all).toContain("2 Oct 2026, 17:00  ·  Mood: Calm, Happy  ·  Favorite");
    expect(all).toContain("1 Oct 2026, 09:00  ·  Mood: Calm");
  });

  it("keeps headings, paragraphs, line breaks and lists", async () => {
    const html = "<h2>Morning</h2><p>Slept well.</p><div>Line one<br>Line two</div><ul><li>Tea</li><li>Walk<ul><li>Park</li></ul></li></ul><ol><li>First</li></ol>";
    const all = (await build(input([entry("a", { content: html })]))).pages.flat();
    for (const text of ["Morning", "Slept well.", "Line one", "Line two", "Tea", "Walk", "Park", "First", "1.", "•", "–"]) {
      expect(all).toContain(text);
    }
  });

  it("uses honest placeholders for missing titles and empty entries", async () => {
    const all = (await build(input([entry("a", { title: null, content: "", mood_tags: [] })]))).pages.flat();
    expect(all).toContain("Untitled entry");
    expect(all).toContain("This entry has no text.");
  });

  it("says so when nothing is selected", async () => {
    const all = (await build(input([]))).pages.flat();
    expect(all).toContain("0 entries");
    expect(all).toContain("No journal entries in this selection.");
  });

  it("splits a long entry across pages without losing text, with a continuation label", async () => {
    const paras = Array.from({ length: 90 }, (_, i) => `<p>Paragraph ${i + 1}: ${"steady words ".repeat(18)}end.</p>`).join("");
    const { pages } = await build(input([entry("long", { title: "A long reflection", content: paras })]));
    expect(pages.length).toBeGreaterThanOrEqual(4);
    const all = pages.flat();
    const starts = all.filter((l) => /^Paragraph \d+:/.test(l)).map((l) => Number(/^Paragraph (\d+):/.exec(l)![1]));
    expect(starts).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
    for (const lines of pages.slice(1)) expect(lines).toContain("A long reflection (continued)");
    expect(pages[0]).not.toContain("A long reflection (continued)");
  });

  it("wraps long titles and unbroken text inside the page", async () => {
    const unbroken = "x".repeat(400);
    const longTitle = `${"A very long title ".repeat(10)}end`;
    const { pages, doc } = await build(input([entry("a", { title: longTitle, content: `<div>${unbroken}</div>` })]));
    const all = pages.flat();
    expect(all.filter((l) => /^x+$/.test(l)).join("")).toBe(unbroken);
    expect(all.join(" ").replace(/\s+/g, " ")).toContain(longTitle);
    for (const ops of (doc.internal as unknown as Internal).pages.slice(1)) {
      for (const m of ops.join("\n").matchAll(/([\d.-]+)\s+([\d.-]+)\s+Td/g)) {
        const fromTop = (841.89 - Number(m[2])) * 0.3528;
        expect(fromTop).toBeGreaterThan(8);
        expect(fromTop).toBeLessThan(290);
      }
    }
  });
});

describe("journal PDF multilingual text", () => {
  it("draws Urdu completely in right-to-left order, alone and mixed with English", async () => {
    const urdu = "آج میں نے بہت سکون محسوس کیا۔";
    const mixed = "آج Calm رہا، 3 بار walk کی۔";
    const brackets = "میں نے (3) کتابیں پڑھیں [ہفتہ 2]۔";
    const { pages } = await build(input([entry("u", { title: "Goal: روزانہ چہل قدمی", content: `<div>${urdu}</div><div>${mixed}</div><div>${brackets}</div>` })]));
    const all = pages.flat();
    expect(all).toContain(rtlVisual(urdu));
    // English words keep their own order inside the right-to-left line.
    expect(all).toContain(`۔${rev("کی")} walk ${rev("بار")} 3 ،${rev("رہا")} Calm ${rev("آج")}`);
    expect(all).toContain(rtlVisual(brackets));
    expect(all).toContain(`Goal: ${rev("قدمی")} ${rev("چہل")} ${rev("روزانہ")}`);
  });

  it("marks emoji and images, explaining the markers once", async () => {
    const { pages, emojiReplacedCount, imageCount } = await build(input([entry("e", { content: '<div>Great day 😊 with family 👨‍👩‍👧!</div><div><img src="data:x"></div>' })]));
    const all = pages.flat();
    expect(all).toContain("Great day [emoji] with family [emoji]!");
    expect(all).toContain("[image]");
    expect(emojiReplacedCount).toBe(2);
    expect(imageCount).toBe(1);
    expect(all.some((l) => l.startsWith("Emoji can't be shown in this PDF; each appears as [emoji]."))).toBe(true);
  });

  it("adds no marker note when nothing is replaced", async () => {
    const all = (await build(input([entry("a")]))).pages.flat();
    expect(all.some((l) => /Emoji can't|Images aren't/.test(l))).toBe(false);
  });

  it("stops with an error instead of dropping characters it cannot draw", async () => {
    const err = await build(input([entry("c", { content: "<div>Learning 你好 today</div>" })])).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PdfUnsupportedTextError);
    expect((err as PdfUnsupportedTextError).characters).toEqual(["你", "好"]);
  });

  it("fails without a PDF when the Urdu font is unavailable, and falls back to Helvetica for English", async () => {
    const urduEntry = entry("u", { content: "<div>میں 25 منٹ پڑھا</div>" });
    for (const f of [{ latin: null, arabic: null }, { latin: fonts.latin, arabic: null }]) {
      const err = await buildJournalPdf(input([urduEntry]), { fonts: f, logo: null }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PdfUnsupportedTextError);
      expect((err as PdfUnsupportedTextError).reason).toBe("font-unavailable");
    }
    const english = await buildJournalPdf(input([entry("a")]), { fonts: { latin: null, arabic: null }, logo: null });
    expect(english.usedUnicodeFont).toBe(false);
    expect(english.doc.output()).toContain("A quiet day.");
  });

  it("loads the Urdu font only when entries need it", () => {
    expect(journalNeedsArabicFont([entry("a")])).toBe(false);
    expect(journalNeedsArabicFont([entry("a", { content: "<p>&#1605;&#1740;&#1722;</p>" })])).toBe(true);
    expect(journalNeedsArabicFont([entry("a", { title: "سکون" })])).toBe(true);
  });
});
