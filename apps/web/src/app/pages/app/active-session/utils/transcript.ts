/** Transcript merge utilities for Active Session. */

export interface TranscriptLine {
  role: string;
  content: string;
  timestamp: number;
}

export const USER_TRANSCRIPT_MERGE_WINDOW_MS = 16_000;
export const USER_SAME_SPEECH_BURST_MS = 6200;

function stripUserUtteranceForCompare(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function userUtteranceWordJaccard(a: string, b: string): number {
  const wordSet = (s: string) => {
    const st = stripUserUtteranceForCompare(s);
    return new Set(st.split(" ").filter((w) => w.length >= 3));
  };
  const A = wordSet(a);
  const B = wordSet(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** STT restarted mid-thought — stitch when tail of A equals head of B. */
function glueOverlappingFragments(a: string, b: string): string | null {
  const aa = a.trim();
  const bb = b.trim();
  const maxProbe = Math.min(90, aa.length, bb.length);
  for (let len = maxProbe; len >= 12; len--) {
    const tail = aa.slice(-len).toLowerCase();
    const head = bb.slice(0, len).toLowerCase();
    if (tail === head) return `${aa.slice(0, -len)} ${bb}`.replace(/\s+/g, " ").trim();
  }
  return null;
}

function roughSharedSubstringInStripped(a: string, b: string, minLen = 14): boolean {
  const al = stripUserUtteranceForCompare(a);
  const bl = stripUserUtteranceForCompare(b);
  if (al.length < minLen || bl.length < minLen) return false;
  for (let i = 0; i + minLen <= al.length; i++) {
    const chunk = al.slice(i, i + minLen).trim();
    if (chunk.length >= minLen && bl.includes(chunk)) return true;
  }
  return false;
}

function userUtterancesDuplicate(a: string, b: string): boolean {
  const na = stripUserUtteranceForCompare(a);
  const nb = stripUserUtteranceForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length > nb.length ? na : nb;
  if (short.length >= 10 && long.startsWith(short)) return true;
  if (short.length >= 10 && long.endsWith(short)) return true;
  return false;
}

/** Single merge path for user lines from Web Speech, WS `transcription.user`, and MediaRecorder REST. */
export function mergeUserTranscriptAppend(
  prev: TranscriptLine[],
  newText: string,
  mergeWindowMs = USER_TRANSCRIPT_MERGE_WINDOW_MS,
): TranscriptLine[] {
  const t = newText.trim();
  if (!t) return prev;
  const now = Date.now();
  const last = prev[prev.length - 1];
  const gap = last ? now - last.timestamp : Infinity;

  const canMerge =
    last != null &&
    last.role === "user" &&
    gap < mergeWindowMs;

  if (!canMerge) {
    return [...prev, { role: "user", content: t, timestamp: now }];
  }

  const withinBurst =
    gap < USER_SAME_SPEECH_BURST_MS;

  const a = last.content.trim();
  const al = a.toLowerCase();
  const bl = t.toLowerCase();
  if (bl.startsWith(al) && t.length >= a.length && t !== a) {
    return [...prev.slice(0, -1), { role: "user", content: t, timestamp: now }];
  }
  if (al.startsWith(bl) && a.length > t.length) {
    return prev;
  }
  if (userUtterancesDuplicate(a, t)) {
    const keep = t.length >= a.length ? t : a;
    return [...prev.slice(0, -1), { role: "user", content: keep, timestamp: last.timestamp }];
  }
  if (a === t) return prev;

  // Split STT passes on the same thought (short gap) → one bubble via glue / overlap signals.
  if (withinBurst) {
    const glued = glueOverlappingFragments(a, t);
    if (glued !== null) {
      return [...prev.slice(0, -1), { role: "user", content: glued, timestamp: last.timestamp }];
    }
    const jac = userUtteranceWordJaccard(a, t);
    if (jac >= 0.065 || roughSharedSubstringInStripped(a, t, 12)) {
      const richer = jac >= 0.12 ? (t.length >= a.length ? t : a) : (stripUserUtteranceForCompare(t).length >= stripUserUtteranceForCompare(a).length ? t : a);
      return [...prev.slice(0, -1), { role: "user", content: richer, timestamp: last.timestamp }];
    }
  }

  return [...prev, { role: "user", content: t, timestamp: now }];
}