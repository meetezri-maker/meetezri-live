#!/usr/bin/env node
/**
 * Fetches the Noto fonts used by the Session Transcript PDF into public/fonts/pdf/noto/v1/,
 * verifies each file against a pinned SHA-256, saves the licences, and writes manifest.json
 * (per-face Unicode coverage, used to pick fonts before downloading any) and SOURCES.md.
 *
 *   node scripts/pdf-fonts/fetch-pdf-fonts.mjs            download, verify, write manifest
 *   node scripts/pdf-fonts/fetch-pdf-fonts.mjs --verify   verify existing files, rewrite manifest
 *
 * Fonts are OFL 1.1. Upstream "latest" URLs are pinned by checksum: if upstream changes a file,
 * this script fails instead of silently shipping a different font.
 *
 * A version folder is write-once: it is served with immutable caching (vercel.json), so browsers
 * may keep any file in it for a year. Re-running only confirms identical files; a change to any
 * font, licence, manifest.json or SOURCES.md fails here. To change fonts, bump VERSION (and
 * FONT_BASE in sessionTranscriptPdf.worker.ts) so the new files are served from a new path.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "v1";
const OUT = path.resolve(HERE, `../../public/fonts/pdf/noto/${VERSION}`);
const VERIFY_ONLY = process.argv.includes("--verify");

/** Official notofonts builds: the published hinted/unhinted/full variants (the checksum decides which one). */
const notofonts = (repo, family, weight = "Regular") => ["hinted", "unhinted", "full"].flatMap((v) => [
  `https://notofonts.github.io/${repo}/fonts/${family}/${v}/ttf/${family}-${weight}.ttf`,
  `https://raw.githubusercontent.com/notofonts/${repo}/gh-pages/fonts/${family}/${v}/ttf/${family}-${weight}.ttf`,
]);
const ghPages = (repo, family) => notofonts(repo, family).filter((u) => u.includes("gh-pages")).concat(notofonts(repo, family));
const notoOfl = (repo) => `https://raw.githubusercontent.com/notofonts/${repo}/main/OFL.txt`;
const googleOfl = (slug) => `https://github.com/google/fonts/raw/main/ofl/${slug}/OFL.txt`;

/** file -> { url, kind ("ttf" | "woff" | "zip:<entry>"), sha256 (of the final TTF), licence url } */
const FONTS = {
  "NotoSans-Regular.ttf": { url: notofonts("latin-greek-cyrillic", "NotoSans"), sha256: "91b0fb7e7115415ff08251b03b727ae018190a22fd107bd0117d19a54af39464", licence: notoOfl("latin-greek-cyrillic") },
  "NotoSans-Bold.ttf": { url: notofonts("latin-greek-cyrillic", "NotoSans", "Bold"), sha256: "40646054e297b690bf4d18702215556e6a286d7e98227d12cec35e2ebe51adef", licence: notoOfl("latin-greek-cyrillic") },
  "NotoNaskhArabic-Regular.ttf": { url: notofonts("arabic", "NotoNaskhArabic"), sha256: "a87da9e7687b097af15f9dc217fe3e2dd80bcb3d50eccb394a4aece74b1ca4d9", licence: notoOfl("arabic") },
  "NotoSansHebrew-Regular.ttf": { url: notofonts("hebrew", "NotoSansHebrew"), sha256: "a06ece4b9a381fca1f75e141a595dbe20681ceadbbf02b2e0e19b62fc9d8d74d", licence: notoOfl("hebrew") },
  "NotoSansBengali-Regular.ttf": {
    url: "https://github.com/notofonts/bengali/releases/download/NotoSansBengali-v3.011/NotoSansBengali-v3.011.zip",
    kind: "zip:NotoSansBengali/hinted/ttf/NotoSansBengali-Regular.ttf",
    sha256: "b55c62ee531e3214da6c0701daecea89a52ba42db7d8206b92e6b51f397a3193", licence: notoOfl("bengali"),
  },
  "NotoSansDevanagari-Regular.ttf": { url: notofonts("devanagari", "NotoSansDevanagari"), sha256: "6600a318c94f6c7d5d6ea6e0133c017748c6449f426558adb9691747d2165613", licence: notoOfl("devanagari") },
  "NotoSansGurmukhi-Regular.ttf": { url: notofonts("gurmukhi", "NotoSansGurmukhi"), sha256: "0588e0a19811a505fd0388e9a735aa04e0d4f5771d0091abe66e36ad20137ec7", licence: notoOfl("gurmukhi") },
  "NotoSansGujarati-Regular.ttf": { url: notofonts("gujarati", "NotoSansGujarati"), sha256: "20439c87e9a6c795ab19469e9b844f944f842b255f2a19b35fdd14d045cd8336", licence: notoOfl("gujarati") },
  "NotoSansTamil-Regular.ttf": { url: notofonts("tamil", "NotoSansTamil"), sha256: "5f5627d36bee925778d0da732d28a15c0fe1137a4452bc5ee1aa18b1ad885b6a", licence: notoOfl("tamil") },
  "NotoSansTelugu-Regular.ttf": { url: notofonts("telugu", "NotoSansTelugu"), sha256: "8ac23c54f3bc3f88d50e926a0e30b969f6fa6d5a328ae3e5a3c65519de3f5afa", licence: notoOfl("telugu") },
  "NotoSansKannada-Regular.ttf": { url: notofonts("kannada", "NotoSansKannada"), sha256: "82536640a4f7c1200b53e985ad613fb8b6a3b4d9d07da145c2191bfab57a0b5e", licence: notoOfl("kannada") },
  "NotoSansMalayalam-Regular.ttf": { url: notofonts("malayalam", "NotoSansMalayalam"), sha256: "c5c3960e1b87b96b6f9254a1912b10c4d4db18c6ac64f4268d36642e60c30e6b", licence: notoOfl("malayalam") },
  "NotoSansSinhala-Regular.ttf": { url: notofonts("sinhala", "NotoSansSinhala"), sha256: "6b1a8319a236ff81929d22b2693c06668ecabbbc6ab145fefc06fdf0a732a76c", licence: notoOfl("sinhala") },
  "NotoSansThai-Regular.ttf": { url: ghPages("thai", "NotoSansThai"), sha256: "06d73c03228f7678cb5a42dfad5f42b091ac58309040622e7652a3628957fbce", licence: notoOfl("thai") },
  "NotoSansLao-Regular.ttf": { url: notofonts("lao", "NotoSansLao"), sha256: "ebddea479dd4a9b2dfda4a826b9b8664f9ce67255fd8852096a32e937e2e54c0", licence: notoOfl("lao") },
  "NotoSansKhmer-Regular.ttf": { url: notofonts("khmer", "NotoSansKhmer"), sha256: "7a15bfb5bf636f98281e9a739058de8eb4dbc5e98ed9bcb15338d8b9ce516d69", licence: notoOfl("khmer") },
  "NotoSansMyanmar-Regular.ttf": { url: notofonts("myanmar", "NotoSansMyanmar"), sha256: "4de1f5c64e590c5a292eb1116c5dbecf09f2fc6a7aedd6b61f0792a75670d968", licence: notoOfl("myanmar") },
  "NotoSerifTibetan-Regular.ttf": { url: notofonts("tibetan", "NotoSerifTibetan"), sha256: "20821110dee93dcf4dbcc057bb49f106a357d3baa4a17e06b4fe4f17c741d1b0", licence: notoOfl("tibetan") },
  "NotoSansArmenian-Regular.ttf": { url: notofonts("armenian", "NotoSansArmenian"), sha256: "deb78dcd316a59d35a6b537daf5984edc15e2bd3805f7e76b8b90c788c6a8727", licence: notoOfl("armenian") },
  "NotoSansGeorgian-Regular.ttf": { url: notofonts("georgian", "NotoSansGeorgian"), sha256: "260689da581f4c6a9bb1b1c0669826f194031d9c63f500ab82176b17e6657990", licence: notoOfl("georgian") },
  "NotoSansEthiopic-Regular.ttf": { url: notofonts("ethiopic", "NotoSansEthiopic"), sha256: "f5189f5674b01e9e7282973104ddf8e96c13f831bd6a17fa4ddd1660d1ed65d9", licence: notoOfl("ethiopic") },
  // Google Fonts static instances (versioned gstatic URLs), WOFF 1.0 converted losslessly to TTF.
  "NotoSansSC-Regular.ttf": { url: "https://fonts.gstatic.com/s/notosanssc/v41/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnY9NbPzT3HI.woff", kind: "woff", sha256: "6ddebf65b4eeac35d285bc3d394906acb047452628a31ee623ef54103ec08fee", licence: googleOfl("notosanssc") },
  "NotoSansJP-Regular.ttf": { url: "https://fonts.gstatic.com/s/notosansjp/v57/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75jY0rw_mMI.woff", kind: "woff", sha256: "0fa1a7ba2df57e19ab4632a7ccccd53ea872fbc0003fd460544dcd0319e630cb", licence: googleOfl("notosansjp") },
  "NotoSansKR-Regular.ttf": { url: "https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLfq8H4gReI.woff", kind: "woff", sha256: "91300b4194b89b926113b0cb551c6107b015539bab1f9f0d913d65fa135e7f03", licence: googleOfl("notosanskr") },
  "NotoSansTC-Regular.ttf": { url: "https://fonts.gstatic.com/s/notosanstc/v40/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_ClOtma2gNc.woff", kind: "woff", sha256: "2d57d8d3695cf5b81da14119b41bc4dbe2165abd0a924c324aca9dd8bc0f0f61", licence: googleOfl("notosanstc") },
};

const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** WOFF 1.0 -> sfnt (tables sorted by tag, 4-byte padded). */
function woffToTtf(d) {
  if (d.toString("latin1", 0, 4) !== "wOFF") throw new Error("not a WOFF file");
  const flavor = d.readUInt32BE(4), numTables = d.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = d.subarray(o, o + 4), off = d.readUInt32BE(o + 4), compLen = d.readUInt32BE(o + 8), origLen = d.readUInt32BE(o + 12), checksum = d.readUInt32BE(o + 16);
    let data = d.subarray(off, off + compLen);
    if (compLen < origLen) data = zlib.inflateSync(data);
    if (data.length !== origLen) throw new Error(`WOFF table ${tag} length mismatch`);
    tables.push({ tag, checksum, data });
  }
  tables.sort((a, b) => Buffer.compare(a.tag, b.tag));
  let es = 0; while (2 ** (es + 1) <= numTables) es++;
  const searchRange = 2 ** es * 16;
  const head = Buffer.alloc(12);
  head.writeUInt32BE(flavor, 0); head.writeUInt16BE(numTables, 4); head.writeUInt16BE(searchRange, 6); head.writeUInt16BE(es, 8); head.writeUInt16BE(numTables * 16 - searchRange, 10);
  let offset = 12 + 16 * numTables;
  const dir = [], body = [];
  for (const t of tables) {
    const e = Buffer.alloc(16);
    t.tag.copy(e, 0); e.writeUInt32BE(t.checksum, 4); e.writeUInt32BE(offset, 8); e.writeUInt32BE(t.data.length, 12);
    dir.push(e);
    const pad = (4 - (t.data.length % 4)) % 4;
    body.push(t.data, Buffer.alloc(pad));
    offset += t.data.length + pad;
  }
  return Buffer.concat([head, ...dir, ...body]);
}

/** One stored or deflated entry from a ZIP archive. */
function unzipEntry(zip, name) {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a ZIP archive");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10), compSize = zip.readUInt32LE(p + 20), nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30), commentLen = zip.readUInt16LE(p + 32), local = zip.readUInt32LE(p + 42);
    const entry = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (entry.endsWith(name)) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + compSize);
      return method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not found in archive`);
}

/** cmap coverage ranges, version and PostScript name of a TrueType font. */
function describeFont(b) {
  const tables = {};
  for (let i = 0, n = b.readUInt16BE(4); i < n; i++) { const r = 12 + i * 16; tables[b.toString("latin1", r, r + 4)] = b.readUInt32BE(r + 8); }
  const names = {};
  const nm = tables.name;
  for (let i = 0, count = b.readUInt16BE(nm + 2), str = nm + b.readUInt16BE(nm + 4); i < count; i++) {
    const r = nm + 6 + i * 12, platform = b.readUInt16BE(r), id = b.readUInt16BE(r + 6), len = b.readUInt16BE(r + 8), off = str + b.readUInt16BE(r + 10);
    if (platform !== 3 || names[id]) continue;
    let s = ""; for (let k = 0; k < len; k += 2) s += String.fromCharCode(b.readUInt16BE(off + k));
    names[id] = s;
  }
  const cps = new Set();
  const c = tables.cmap, subs = [];
  for (let i = 0, n = b.readUInt16BE(c + 2); i < n; i++) { const r = c + 4 + i * 8; subs.push({ platform: b.readUInt16BE(r), off: c + b.readUInt32BE(r + 4) }); }
  const f12 = subs.find((s) => b.readUInt16BE(s.off) === 12), f4 = subs.find((s) => b.readUInt16BE(s.off) === 4 && (s.platform === 3 || s.platform === 0));
  if (f12) {
    for (let g = 0, n = b.readUInt32BE(f12.off + 12); g < n; g++) { const p = f12.off + 16 + g * 12; for (let cp = b.readUInt32BE(p); cp <= b.readUInt32BE(p + 4); cp++) cps.add(cp); }
  } else if (f4) {
    const off = f4.off, segX2 = b.readUInt16BE(off + 6), ends = off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = b.readUInt16BE(ends + s * 2), start = b.readUInt16BE(starts + s * 2), delta = b.readInt16BE(deltas + s * 2), ro = b.readUInt16BE(ranges + s * 2);
      for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
        let g = ro === 0 ? (cp + delta) & 0xffff : b.readUInt16BE(ranges + s * 2 + ro + (cp - start) * 2);
        if (ro !== 0 && g) g = (g + delta) & 0xffff;
        if (g) cps.add(cp);
      }
    }
  }
  const sorted = [...cps].sort((x, y) => x - y), out = [];
  for (const cp of sorted) { const last = out[out.length - 1]; if (last && cp === last[1] + 1) last[1] = cp; else out.push([cp, cp]); }
  return { version: names[5] ?? "", postscriptName: names[6] ?? "", ranges: out };
}

/** Writes a file into the version folder, refusing to replace an existing file with different content. */
function writeOnce(file, data) {
  const dest = path.join(OUT, file);
  const next = Buffer.from(data);
  if (fs.existsSync(dest)) {
    if (fs.readFileSync(dest).equals(next)) return;
    throw new Error(`${VERSION}/${file} already exists with different content. ${VERSION} is served with immutable caching and must not change; bump VERSION to publish new font assets.`);
  }
  fs.writeFileSync(dest, next);
}

fs.mkdirSync(OUT, { recursive: true });
const MANIFEST = path.join(OUT, "manifest.json");
const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")).faces : {};
const faces = {};
const licences = new Map();
for (const [file, src] of Object.entries(FONTS)) {
  const dest = path.join(OUT, file);
  let bytes = null, source = null;
  const tried = [];
  if (VERIFY_ONLY) { bytes = fs.readFileSync(dest); source = previous[file.replace(/\.ttf$/, "")]?.source ?? null; }
  else {
    for (const url of Array.isArray(src.url) ? src.url : [src.url]) {
      let raw;
      try { raw = await download(url); } catch (e) { tried.push(`${url} (${e.message.split(": ").pop()})`); continue; }
      const candidate = src.kind === "woff" ? woffToTtf(raw) : src.kind?.startsWith("zip:") ? unzipEntry(raw, src.kind.slice(4)) : raw;
      if (sha256(candidate) === src.sha256) { bytes = candidate; source = url; break; }
      tried.push(`${url} (checksum differs)`);
    }
  }
  if (!bytes) throw new Error(`${file}: no source matched the pinned SHA-256:\n  ${tried.join("\n  ")}`);
  const hash = sha256(bytes);
  if (hash !== src.sha256) throw new Error(`${file}: SHA-256 ${hash} does not match the pinned ${src.sha256}`);
  if (!VERIFY_ONLY) writeOnce(file, bytes);
  const info = describeFont(bytes);
  const licenceFile = `OFL-${file.replace(/-(Regular|Bold)\.ttf$/, "")}.txt`;
  licences.set(licenceFile, src.licence);
  faces[file.replace(/\.ttf$/, "")] = { file, bytes: bytes.length, sha256: hash, version: info.version, postscriptName: info.postscriptName, source, licence: licenceFile, ranges: info.ranges };
  console.log(`${file.padEnd(32)} ${String(Math.round(bytes.length / 1024)).padStart(6)} KB  ${info.version.split(";")[0]}  ok`);
}
for (const [file, url] of licences) if (!VERIFY_ONLY || !fs.existsSync(path.join(OUT, file))) writeOnce(file, await download(url));
writeOnce("manifest.json", JSON.stringify({ version: VERSION, faces }));
writeOnce("SOURCES.md", [
  `# Session Transcript PDF fonts (${VERSION})`,
  "",
  "Generated by `scripts/pdf-fonts/fetch-pdf-fonts.mjs`. All fonts are licensed under the SIL Open Font License 1.1 (licence files alongside).",
  "Served from this folder with immutable caching; bump the folder version when any font changes.",
  "",
  "| File | Version | SHA-256 | Source |",
  "|---|---|---|---|",
  ...Object.values(faces).map((f) => `| ${f.file} | ${f.version.split(";")[0]} | ${f.sha256} | ${f.source} |`),
  "",
].join("\n"));
console.log(`${Object.keys(faces).length} fonts, ${licences.size} licences, manifest ${Math.round(fs.statSync(path.join(OUT, "manifest.json")).size / 1024)} KB`);
