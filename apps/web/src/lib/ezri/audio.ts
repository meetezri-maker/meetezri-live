export type EzriAudioSource =
  | { kind: "url"; url: string }
  | { kind: "base64"; base64: string; mimeType?: string }
  | { kind: "blob"; blob: Blob };

export function looksLikeBase64(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.startsWith("data:audio/")) return true;
  // Heuristic: base64 is usually long and only base64 charset (plus =)
  if (trimmed.length < 64) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
}

export function sniffMimeFromBytes(bytes: Uint8Array): string {
  // Magic bytes:
  // WAV: "RIFF" .... "WAVE"
  // OGG: "OggS"
  // MP3: "ID3" or frame sync 0xFF 0xFB/0xF3/0xF2
  // MP4/M4A: "....ftyp"
  if (bytes.length >= 12) {
    const b0 = bytes[0], b1 = bytes[1], b2 = bytes[2], b3 = bytes[3];
    if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) return "audio/wav"; // RIFF
    if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) return "audio/ogg"; // OggS
    if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) return "audio/mpeg"; // ID3
    // ftyp at offset 4
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "audio/mp4";
  }
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)) return "audio/mpeg";
  }
  return "audio/mpeg";
}

function sniffMimeFromBase64(base64: string): string {
  const t = base64.trim();
  // Ignore data: urls; caller already extracts mime from header.
  if (t.startsWith("data:")) return "audio/mpeg";

  // Common magic prefixes (base64):
  // WAV/RIFF: "RIFF" -> "UklGR"
  // OGG: "OggS" -> "T2dnUw"
  // MP3: "ID3" -> "SUQz" or frame sync 0xFFFB -> often starts with "//uQ"
  // M4A/MP4: "ftyp" is harder; we treat as audio/mp4 if we see "ZnR5cA"
  if (t.startsWith("UklGR")) return "audio/wav";
  if (t.startsWith("T2dnUw")) return "audio/ogg";
  if (t.startsWith("SUQz") || t.startsWith("//uQ")) return "audio/mpeg";
  if (t.includes("ZnR5cA")) return "audio/mp4";
  return "audio/mpeg";
}

export function base64ToBlob(base64: string, mimeType = "audio/mpeg"): Blob {
  const trimmed = base64.trim();
  if (trimmed.startsWith("data:")) {
    const commaIdx = trimmed.indexOf(",");
    const header = trimmed.slice(0, commaIdx);
    const data = trimmed.slice(commaIdx + 1);
    const match = /data:([^;]+);base64/i.exec(header);
    const inferred = match?.[1] || mimeType;
    return base64ToBlob(data, inferred);
  }

  const binaryString = atob(trimmed);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  const finalMime = mimeType || sniffMimeFromBase64(trimmed);
  return new Blob([bytes], { type: finalMime });
}

/** Re-sniff magic bytes when Blob has no useful type (fixes REST `octet-stream` or empty). */
export async function normalizeAudioSource(source: EzriAudioSource): Promise<EzriAudioSource> {
  if (source.kind !== "blob") return source;
  const b = source.blob;
  if (b.size < 32) return source;
  const t = (b.type || "").trim().toLowerCase();
  if (t && t !== "application/octet-stream") return source;
  const buf = await b.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const mime = sniffMimeFromBytes(bytes);
  return { kind: "blob", blob: new Blob([bytes], { type: mime }) };
}

export function toObjectUrl(source: EzriAudioSource): { url: string; revoke?: () => void } {
  if (source.kind === "url") return { url: source.url };
  const blob =
    source.kind === "blob"
      ? source.blob
      : base64ToBlob(source.base64, source.mimeType || "audio/mpeg");
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

